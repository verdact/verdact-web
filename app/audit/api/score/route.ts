import { NextResponse } from 'next/server';
import { auditSubmissionSchema } from '@/lib/audit/schema';
import { computeAuditScore } from '@/lib/audit/scoring';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/audit/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';
import { readEdgeGeo, geoColumns } from '@/lib/geo/edge';
import { sendAuditRecapEmail, isEmailEnabled } from '@/lib/email';
import type { AuditDispute } from '@/lib/audit/types';

// Node runtime: uses node:crypto (rate-limit) and the service-role client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1_200_000; // 1.2 MB cap on the JSON envelope

/**
 * PUBLIC, no-auth scoring endpoint for the /audit funnel.
 *
 * Flow:
 *  1. Rate-limit by salted IP hash (best-effort).
 *  2. Size-guard + JSON parse + Zod validate (never trust the body).
 *  3. Compute the authoritative score server-side.
 *  4. Capture the lead via the service-role client (best-effort; never blocks).
 *  5. Return the score.
 */
export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);
  const limit = checkRateLimit(clientKey);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  // Size guard before reading the whole body into memory where possible.
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Submission is too large.' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Could not read the request.' }, { status: 400 });
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Submission is too large.' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 });
  }

  const parsed = auditSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Some of the submitted numbers were not valid. Please review and resubmit.' },
      { status: 422 },
    );
  }

  const submission = parsed.data;

  const score = computeAuditScore(submission.disputes as AuditDispute[], {
    settledTransactionCount: submission.settledTransactionCount,
    windowDays: submission.windowDays,
  });

  // ── Capture the lead (best-effort). A storage failure must NOT break the
  // user's result — they still get their score. We await it only to learn the
  // row id, which the result page uses to hand off to /signup?from=audit&lead=
  // WITHOUT putting the email in the URL. A null id (failure / unmigrated table)
  // is fine: the handoff falls back to /signup?from=audit and the email-keyed
  // backfill still links at signup. captureLead never throws. ────────────────
  const leadId = await captureLead({
    submission,
    score,
    ipHash: clientKey,
    userAgent: request.headers.get('user-agent'),
    headers: request.headers,
  });

  // `emailed` reflects whether transactional email is configured, so the result
  // page can claim "we emailed a copy" only when that is true. It is not a
  // delivery receipt: the recap is dispatched fire-and-forget inside captureLead.
  return NextResponse.json({ score, emailed: isEmailEnabled(), leadId });
}

async function captureLead({
  submission,
  score,
  ipHash,
  userAgent,
  headers,
}: {
  submission: import('@/lib/audit/schema').AuditSubmission;
  score: ReturnType<typeof computeAuditScore>;
  ipHash: string;
  userAgent: string | null;
  headers: Headers;
}): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    // Env-gated coarse geo (off until ADMIN_GEO_CAPTURE='on' + migration applied).
    const geo = process.env.ADMIN_GEO_CAPTURE === 'on' ? geoColumns(readEdgeGeo(headers)) : {};
    // estimated_dispute_rate is stored as a FRACTION (e.g. 0.0042), matching
    // vamp_snapshots.estimated_vamp_ratio. score.rate.ratioPercent is a percent,
    // so divide by 100 here. Never store the percent in the fraction column.
    const ratioFraction =
      score.rate.ratioPercent == null ? null : score.rate.ratioPercent / 100;

    const { data, error } = await supabase
      .from('audit_leads')
      .insert({
      email: submission.email,
      business_name: submission.businessName ?? null,
      settled_transaction_count: submission.settledTransactionCount,
      window_days: submission.windowDays,
      total_disputes: score.summary.totalDisputes,
      lost_disputes: score.summary.lostDisputes,
      should_have_won_count: score.summary.shouldHaveWonCount,
      comms_hinged_count: score.summary.commsHingedCount,
      estimated_dispute_rate: ratioFraction,
      standing_band: score.rate.band,
      raw_submission: {
        settledTransactionCount: submission.settledTransactionCount,
        windowDays: submission.windowDays,
        disputes: submission.disputes,
      },
      computed_score: score,
      source: 'audit_funnel',
      ip_hash: ipHash,
      user_agent: userAgent?.slice(0, 400) ?? null,
      ...geo,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // Table may be unmigrated in some environments — that is expected pre-apply.
      console.error('[audit/score] lead capture failed:', error.message);
      return null;
    }

    // Fire-and-forget the recap email. The lead is stored, so the result page's
    // "we emailed a copy" claim is honest when a key is configured; when it is
    // not, sendAuditRecapEmail no-ops and the UI softens to "we saved a copy".
    void sendAuditRecapEmail(submission.email, {
      totalDisputes: score.summary.totalDisputes,
      shouldHaveWonCount: score.summary.shouldHaveWonCount,
      commsHingedCount: score.summary.commsHingedCount,
    });

    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[audit/score] lead capture threw:', message);
    return null;
  }
}
