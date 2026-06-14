import { NextResponse } from 'next/server';
import { waitlistSignupSchema } from '@/lib/waitlist/schema';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/audit/rate-limit';
import { createServiceClient } from '@/lib/supabase/server';

// Node runtime: uses node:crypto (rate-limit) and the service-role client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4_000; // tiny — this endpoint only ever receives an email

/**
 * PUBLIC, no-auth waitlist capture for the "launching soon" sign-up gate.
 *
 * Mirrors /audit/api/score:
 *  1. Rate-limit by salted IP hash (best-effort, shared limiter).
 *  2. Size-guard + JSON parse + Zod validate (never trust the body).
 *  3. Insert via the service-role client (bypasses RLS; no anon/auth path).
 *  4. Treat a duplicate email as success — joining twice is not an error.
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

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Could not read the request.' }, { status: 400 });
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 });
  }

  const parsed = waitlistSignupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 422 },
    );
  }

  const { email, source } = parsed.data;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('waitlist_signups').insert({
      email,
      source: source ?? 'launching_soon',
      ip_hash: clientKey,
      user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    });

    if (error) {
      // 23505 = unique_violation. Already on the list is a success, not an error.
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, alreadyOnList: true });
      }
      // Table may be unmigrated in some environments — that is expected pre-apply.
      console.error('[api/waitlist] insert failed:', error.message);
      return NextResponse.json(
        { error: 'We could not add you just now. Please try again shortly.' },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/waitlist] insert threw:', message);
    return NextResponse.json(
      { error: 'We could not add you just now. Please try again shortly.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
