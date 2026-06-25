import 'server-only';

import { createHash, createHmac } from 'crypto';
import Stripe from 'stripe';
import type { User } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { createStripeClient } from '@/lib/stripe';
import { can } from '@/lib/entitlements/can';
import { writePreActionAudit } from '@/lib/entitlements/audit';
import { isSubmissionEnabled } from './submission-flag';
import { loadAndBuildPacket } from './packet-loader';
import { prepareStripeEvidence } from './submission';
import { uploadDisputeFilesToStripe } from './stripe-files';

/**
 * Manual "submit evidence to Stripe" path. Built fail-closed, modeled on
 * evaluateAutoSubmit (lib/entitlements/auto-submit.ts): every branch that is not a
 * fully satisfied allow returns a typed reason and performs NO Stripe write.
 *
 * Gate ladder (outermost first):
 *   1. kill switch  — VERDACT_SUBMISSION_ENABLED must be exactly "true"
 *   2. opt-in       — merchant_profiles.submission_opt_in (default false)
 *   3. approval     — disputes.evidence_approved_at + _by + sign_off_at (DB CHECK)
 *   4. entitlement  — can(user, 'submit_to_stripe')
 *   5. edge cases   — already-submitted / not-submittable status / past deadline /
 *                     not-connected / wrong-account / evidence incomplete
 *   6. pre-action audit (fail closed) -> submission_attempts(in_progress) ->
 *      stripe.disputes.update({submit:true}) -> success/failure persistence
 *
 * Runs entirely under the service-role client (it writes evidence_files /
 * submission_attempts / disputes / dispute_events / audit_log, all of which only
 * the service role can write on the backend path). The packet is re-derived
 * SERVER-SIDE from disputeId via the shared loadAndBuildPacket — never from any
 * client-supplied payload — so what is filed equals what was approved.
 */

export type SubmitReason =
  | 'submitted'
  | 'kill_switch_off'
  | 'not_found'
  | 'load_error'
  | 'not_opted_in'
  | 'not_approved'
  | 'no_entitlement'
  | 'already_submitted'
  | 'dispute_not_submittable'
  | 'past_deadline'
  | 'not_connected'
  | 'account_mismatch'
  | 'evidence_incomplete'
  | 'audit_write_failed'
  | 'attempt_conflict'
  | 'stripe_error';

export interface SubmitResult {
  ok: boolean;
  reason: SubmitReason;
  message?: string;
  missing?: number;
}

export interface SubmitContext {
  user: User;
  merchantId: string;
  disputeId: string;
  requestIp?: string | null;
  requestUserAgent?: string | null;
}

const SCHEMA_VERSION = 'v1';
// Statuses from which a merchant may still file evidence. Allowlist, not denylist:
// under_review (already with the bank), won/lost/warning_closed (closed), and
// submitted are all excluded.
const SUBMITTABLE_STATUS = 'needs_response';

export async function submitEvidenceToStripe(ctx: SubmitContext): Promise<SubmitResult> {
  // Gate 1 — global kill switch (outermost, independent of all per-merchant state).
  if (!isSubmissionEnabled()) {
    return { ok: false, reason: 'kill_switch_off' };
  }

  const supabase = createServiceClient();

  // Opt-in + the merchant profile snapshot (one fetch).
  const { data: profile } = await supabase
    .from('merchant_profiles')
    .select(
      'product_description, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, submission_opt_in',
    )
    .eq('merchant_id', ctx.merchantId)
    .maybeSingle();

  // Gate 2 — merchant opt-in (default OFF / missing profile = denied).
  if (!profile || (profile as { submission_opt_in?: boolean }).submission_opt_in !== true) {
    return { ok: false, reason: 'not_opted_in' };
  }

  // Load the packet + record (server-side, shared assembly).
  const loaded = await loadAndBuildPacket(supabase, ctx.disputeId, ctx.merchantId);
  if (loaded.status === 'error') return { ok: false, reason: 'load_error' };
  if (loaded.status !== 'ok' || !loaded.record || !loaded.packet) {
    return { ok: false, reason: 'not_found' };
  }
  const record = loaded.record;

  // Gate 3 — explicit approval / sign-off (mirrors the DB CHECK).
  if (!record.evidence_approved_at || !record.evidence_approved_by || !record.sign_off_at) {
    return { ok: false, reason: 'not_approved' };
  }

  // Gate 4 — paid entitlement.
  const entitlement = await can(ctx.user, 'submit_to_stripe');
  if (!entitlement.allowed) return { ok: false, reason: 'no_entitlement' };

  // Gate 5 — edge cases (each refuses before any Stripe write).
  if (record.submitted_at) return { ok: false, reason: 'already_submitted' };
  if (record.status !== SUBMITTABLE_STATUS) return { ok: false, reason: 'dispute_not_submittable' };
  if (record.due_by && Date.parse(record.due_by) < Date.now()) {
    return { ok: false, reason: 'past_deadline' };
  }
  const stripeAccountId = loaded.stripeAccountId;
  if (!stripeAccountId) return { ok: false, reason: 'not_connected' };
  // Wrong-account guard: the dispute was ingested under one Stripe account; refuse
  // to file it against a different currently-connected account (e.g. after a
  // reconnect to a new Stripe account).
  if (record.processor_account_id && record.processor_account_id !== stripeAccountId) {
    return { ok: false, reason: 'account_mismatch' };
  }

  // Upload any evidence files that lack a Stripe file id, then RE-DERIVE the packet
  // so the exhibits carry their new processor_file_ids.
  try {
    await uploadDisputeFilesToStripe({
      supabase,
      disputeId: ctx.disputeId,
      merchantId: ctx.merchantId,
      stripeAccountId,
    });
  } catch (err) {
    console.error('[stripe-submit] file upload phase failed:', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'evidence_incomplete', message: 'Some evidence files could not be uploaded to Stripe.' };
  }

  const reloaded = await loadAndBuildPacket(supabase, ctx.disputeId, ctx.merchantId);
  if (reloaded.status !== 'ok' || !reloaded.packet) return { ok: false, reason: 'load_error' };
  const prepared = prepareStripeEvidence(reloaded.packet);
  if (prepared.blockedReasons.length > 0 || prepared.missingStripeUploads.length > 0) {
    return {
      ok: false,
      reason: 'evidence_incomplete',
      missing: prepared.missingStripeUploads.length,
      message: prepared.blockedReasons[0],
    };
  }

  // Idempotency. attempt_number = max(existing)+1; the Stripe idempotency key is
  // deterministic over (dispute, attempt, payload) so a true network retry of the
  // SAME attempt dedupes at Stripe, while a fresh user re-submit gets a new key.
  const payloadCanonical = canonicalJson(prepared.evidence);
  const payloadSha256 = sha256Hex(payloadCanonical);
  const { data: lastAttempt } = await supabase
    .from('submission_attempts')
    .select('attempt_number')
    .eq('dispute_id', ctx.disputeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const attemptNumber = ((lastAttempt as { attempt_number?: number } | null)?.attempt_number ?? 0) + 1;
  const idempotencyKey = sha256Hex(`${ctx.disputeId}:${attemptNumber}:${payloadSha256}`);

  // Gate 6 — immutable pre-action audit. Fail closed if the write fails.
  const auditId = await writePreActionAudit({
    merchantId: ctx.merchantId,
    userId: record.evidence_approved_by,
    action: 'submit_to_stripe.attempt',
    resource: ctx.disputeId,
    metadata: {
      attempt_number: attemptNumber,
      payload_sha256: payloadSha256,
      stripe_account: stripeAccountId,
    },
    requestIp: ctx.requestIp ?? null,
    requestUserAgent: ctx.requestUserAgent ?? null,
  });
  if (!auditId) return { ok: false, reason: 'audit_write_failed' };

  const submissionIp = ctx.requestIp ?? 'unknown';
  const profileSnapshot = {
    schema_version: SCHEMA_VERSION,
    product_description: (profile as { product_description?: string | null }).product_description ?? null,
    refund_policy_text: (profile as { refund_policy_text?: string | null }).refund_policy_text ?? null,
    refund_policy_url: (profile as { refund_policy_url?: string | null }).refund_policy_url ?? null,
    cancellation_policy_text: (profile as { cancellation_policy_text?: string | null }).cancellation_policy_text ?? null,
    cancellation_policy_url: (profile as { cancellation_policy_url?: string | null }).cancellation_policy_url ?? null,
  };

  // Insert the attempt row BEFORE the Stripe call (status in_progress). All NOT
  // NULL columns are populated; every JSONB carries schema_version.
  const { data: attempt, error: attemptError } = await supabase
    .from('submission_attempts')
    .insert({
      merchant_id: ctx.merchantId,
      dispute_id: ctx.disputeId,
      processor: 'stripe',
      processor_api_version: '2023-10-16',
      idempotency_key: idempotencyKey,
      attempt_number: attemptNumber,
      status: 'in_progress',
      evidence_payload: { schema_version: SCHEMA_VERSION, evidence: prepared.evidence },
      evidence_payload_sha256: payloadSha256,
      merchant_profile_snapshot: profileSnapshot,
      sign_off_text_version: record.sign_off_text_version ?? SCHEMA_VERSION,
      sign_off_at: record.sign_off_at,
      signed_off_by_user_id: record.evidence_approved_by,
      submission_ip: submissionIp,
      submission_user_agent: ctx.requestUserAgent ?? null,
    })
    .select('id')
    .single();

  if (attemptError || !attempt) {
    // A unique-violation here means a concurrent submit already claimed this
    // attempt_number / idempotency key. Refuse rather than racing a second file.
    console.error('[stripe-submit] attempt insert failed:', attemptError?.message);
    return { ok: false, reason: 'attempt_conflict' };
  }
  const attemptId = (attempt as { id: string }).id;

  // The Stripe write. submit:true only ever runs here, behind the kill switch.
  const stripe = createStripeClient();
  try {
    const response = await stripe.disputes.update(
      record.processor_dispute_id,
      { evidence: prepared.evidence, submit: true },
      { stripeAccount: stripeAccountId, idempotencyKey },
    );

    const now = new Date().toISOString();
    const signature = signPayload(payloadCanonical);

    await supabase
      .from('disputes')
      .update({
        status: 'submitted',
        submitted_at: now,
        submission_ip: submissionIp,
        evidence_submitted_payload: { schema_version: SCHEMA_VERSION, evidence: prepared.evidence },
        evidence_submitted_payload_sha256: payloadSha256,
        evidence_submitted_signature: signature?.value ?? null,
        signing_key_version: signature?.version ?? null,
        evidence_submitted_signed_at: signature ? now : null,
        processor_submission_response: {
          schema_version: SCHEMA_VERSION,
          id: response.id,
          status: response.status,
        },
      })
      .eq('id', ctx.disputeId)
      .eq('merchant_id', ctx.merchantId);

    await supabase
      .from('submission_attempts')
      .update({
        status: 'succeeded',
        processor_request_id: response.lastResponse?.requestId ?? null,
        http_status: response.lastResponse?.statusCode ?? null,
        processor_response: { schema_version: SCHEMA_VERSION, id: response.id, status: response.status },
        finished_at: now,
      })
      .eq('id', attemptId);

    await insertDisputeEvent(supabase, ctx, 'submission_succeeded', {
      schema_version: SCHEMA_VERSION,
      attempt_id: attemptId,
      stripe_dispute_id: response.id,
    });

    return { ok: true, reason: 'submitted' };
  } catch (err) {
    const stripeErr = err instanceof Stripe.errors.StripeError ? err : null;
    const message = stripeErr?.message ?? (err instanceof Error ? err.message : 'unknown Stripe error');
    console.error('[stripe-submit] disputes.update failed:', message);

    await supabase
      .from('submission_attempts')
      .update({
        status: 'failed',
        http_status: stripeErr?.statusCode ?? null,
        processor_request_id: stripeErr?.requestId ?? null,
        processor_error: {
          schema_version: SCHEMA_VERSION,
          message,
          type: stripeErr?.type ?? 'unknown',
          code: stripeErr?.code ?? null,
        },
        finished_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    await insertDisputeEvent(supabase, ctx, 'submission_failed', {
      schema_version: SCHEMA_VERSION,
      attempt_id: attemptId,
      error: message,
    });

    return { ok: false, reason: 'stripe_error', message };
  }
}

// Service-role client type is inferred; keep the event insert append-only-safe.
async function insertDisputeEvent(
  supabase: ReturnType<typeof createServiceClient>,
  ctx: SubmitContext,
  eventType: 'submission_succeeded' | 'submission_failed',
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('dispute_events').insert({
      merchant_id: ctx.merchantId,
      dispute_id: ctx.disputeId,
      event_type: eventType,
      actor_kind: 'user',
      payload,
    });
  } catch (err) {
    console.error(`[stripe-submit] dispute_events ${eventType} insert failed:`, err instanceof Error ? err.message : err);
  }
}

// Stable JSON serialization (sorted keys) so the sha256 / signature are reproducible.
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// HMAC signature over the canonical payload, IF a signing key is configured. The
// disputes signature columns are nullable, so an unset key leaves them null rather
// than failing the submission (the sha256 is always recorded).
function signPayload(canonical: string): { value: string; version: string } | null {
  const key = process.env.VERDACT_SUBMISSION_SIGNING_KEY?.trim();
  if (!key) return null;
  return { value: createHmac('sha256', key).update(canonical, 'utf8').digest('hex'), version: 'v1' };
}
