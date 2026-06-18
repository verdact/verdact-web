import { NextResponse } from 'next/server';
import { feedbackInputSchema } from '@/lib/feedback/schema';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/audit/rate-limit';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Node runtime: uses node:crypto (rate-limit) and the service-role client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Generous ceiling: message is capped at 4000 chars, plus small context fields.
const MAX_BODY_BYTES = 8_000;
const USER_AGENT_MAX = 400;

/**
 * PUBLIC, no-auth write-feedback capture ("send feedback from anywhere").
 *
 * Mirrors /api/waitlist:
 *  1. Rate-limit by salted IP hash (best-effort, shared limiter).
 *  2. Size-guard + JSON parse + Zod validate (never trust the body).
 *  3. Honeypot: a filled "website" field is a bot — succeed silently, save nothing.
 *  4. Server SETS user_agent (from the header), merchant_id (from the session if
 *     any, else null), created_at, and status — NEVER from the client body.
 *  5. Insert via the service-role client (bypasses RLS; no anon table write path
 *     is relied upon here — the public RLS policy is the fallback shape).
 *  6. Return { ok: true } or a safe 4xx/5xx with no internal detail leaked.
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

  // Honeypot: a real user never fills the hidden "website" field. Treat a filled
  // honeypot as success so bots are not tipped off, but persist nothing.
  if (isHoneypotFilled(json)) {
    return NextResponse.json({ ok: true });
  }

  const parsed = feedbackInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please add a short message before sending.' },
      { status: 422 },
    );
  }

  const input = parsed.data;

  // Resolve merchant_id from the SESSION, never the body. Best-effort: a failure
  // to read the session must not block anonymous feedback — it just stays null.
  const merchantId = await resolveMerchantId();

  const userAgent = request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX) ?? null;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('feedback').insert({
      surface: input.surface,
      category: input.category,
      message: input.message,
      route: input.route ?? null,
      screen: input.screen ?? null,
      activity: input.activity ?? null,
      email: input.email ?? null,
      has_screenshot: input.has_screenshot ?? false,
      // Server-controlled — clients cannot influence these.
      merchant_id: merchantId,
      user_agent: userAgent,
      status: 'new',
    });

    if (error) {
      // Table may be unmigrated in some environments — expected pre-apply.
      console.error('[api/feedback] insert failed:', error.message);
      return NextResponse.json(
        { error: 'We could not send that just now. Please try again shortly.' },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/feedback] insert threw:', message);
    return NextResponse.json(
      { error: 'We could not send that just now. Please try again shortly.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * The signed-in user's first merchant, or null when signed-out / no merchant.
 * Read from the auth session + merchant_users; never from the request body, so a
 * caller cannot attribute feedback to a merchant they do not belong to.
 */
async function resolveMerchantId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('merchant_users')
      .select('merchant_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return (data as { merchant_id: string | null }).merchant_id ?? null;
  } catch {
    return null;
  }
}

function isHoneypotFilled(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const website = (json as Record<string, unknown>).website;
  return typeof website === 'string' && website.trim().length > 0;
}
