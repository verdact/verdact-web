#!/usr/bin/env node
/**
 * Required-env presence check.
 *
 * Prevents the silent-no-op / fail-closed-500 class of bug: a guard that depends
 * on an env var (e.g. AUDIT_IP_SALT) silently breaks a whole surface in prod when
 * the var is unset. This asserts the load-bearing vars are present in a DEPLOYED
 * context (Vercel production/preview, or CI), and is a NO-OP in local dev so
 * `npm run dev` is never blocked.
 *
 * Variable names below were taken from a repo-wide `process.env.*` sweep — keep
 * them in sync if env usage changes.
 *
 * Intentionally NOT wired into `build`: it ships as a standalone `npm run check:env`
 * so CI can adopt it after validating the list against the real Vercel env. Wiring
 * it into the deploy build prematurely could fail a deploy on a name mismatch.
 */

const isDeployed =
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.CI === 'true' ||
  process.env.CI === '1';

// Hard-required: absence breaks a core merchant flow or 500s a live surface.
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL', // supabase client/server everywhere
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', // supabase browser/server client
  'SUPABASE_SERVICE_ROLE_KEY', // webhook + inngest + admission service client
  'STRIPE_SECRET_KEY', // lib/stripe.ts
  'STRIPE_WEBHOOK_SECRET', // /api/stripe/webhook signature verify
  'STRIPE_CONNECT_CLIENT_ID', // Connect OAuth start
  'NEXT_PUBLIC_APP_URL', // auth redirects + email links
  'AUDIT_IP_SALT', // rate-limit fail-closed (the lesson: unset → 500s)
];

// Recommended: degraded-but-not-broken if missing (email, durable jobs, analytics,
// optional integrations). Warn only.
const RECOMMENDED = [
  'RESEND_API_KEY', // transactional email (degrades silently if missing)
  'EMAIL_FROM',
  'INNGEST_EVENT_KEY', // read by the Inngest SDK directly; needed for durable jobs
  'INNGEST_SIGNING_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY', // analytics (inert if unset)
  'SLACK_CLIENT_ID', // Slack evidence import (inert if unset)
  'SLACK_CLIENT_SECRET',
];

function present(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

if (!isDeployed) {
  console.log('[check-env] local/dev context (no VERCEL_ENV/CI) — skipping required-env check.');
  process.exit(0);
}

const missingRequired = REQUIRED.filter((name) => !present(name));
const missingRecommended = RECOMMENDED.filter((name) => !present(name));

for (const name of missingRecommended) {
  console.warn(`[check-env] WARN: recommended env var not set: ${name}`);
}

if (missingRequired.length > 0) {
  console.error('[check-env] FAIL: required env vars are missing:');
  for (const name of missingRequired) console.error(`  - ${name}`);
  process.exit(1);
}

console.log(`[check-env] OK: all ${REQUIRED.length} required env vars present.`);
process.exit(0);
