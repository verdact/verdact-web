# Verdact Web

Next.js app for Verdact, the Stripe-first chargeback evidence and dispute-risk platform for SaaS and service businesses.

## Current State

This app currently includes the landing page, privacy policy, a narrow Google reviewer path for Gmail OAuth verification, the Inngest route foundation, and the applied Supabase dev schema. It is not yet the MVP dashboard.

Before implementation, read:

1. `../SESSION_HANDOFF.md`
2. `../CHARGEBACKIQ_STRATEGY_SNAPSHOT_v2.md`
3. `../06_Build/Verdact_Codex_Implementation_Readiness_2026-05-23.md`

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values. `.env.example` is the
canonical, commented list of every variable the app reads; the table below summarises
the launch set. Production and preview values live in the Vercel project and are never
committed. `NEXT_PUBLIC_`-prefixed vars are exposed to the browser — never put secrets there.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public base URL used for OAuth redirect/return URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only, bypasses RLS) |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect client id for the Standard OAuth flow |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SLACK_CLIENT_ID` | Slack OAuth client id |
| `SLACK_CLIENT_SECRET` | Slack OAuth client secret |
| `NEXTAUTH_SECRET` | Secret for encrypting the reviewer/Gmail cookie |
| `GOOGLE_CLIENT_ID` | Google OAuth client id (Gmail path) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (Gmail path) |
| `RESEND_API_KEY` | Resend API key (transactional email, not yet wired) |
| `EMAIL_FROM` | From address for transactional email (not yet wired) |
| `ANTHROPIC_API_KEY` | Anthropic API key (AI guidance, not yet wired) |
| `INNGEST_EVENT_KEY` | Inngest event key (read automatically by the client) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (read automatically by the client) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (analytics is inert without it) |
| `AUDIT_IP_SALT` | Salt for hashing client IPs (required in production) |
| `REVIEWER_ACCESS_CODE` | Optional code gating the reviewer sign-in path |
| `VERDACT_ADMIN_EMAILS` | Emergency admin email allowlist (DB is source of truth) |
| `ADMIN_GEO_CAPTURE` | Set `on` to enable best-effort geo capture (off by default) |
| `VERDACT_BETA_ALL_UNLOCKED` | Master beta flag; anything but `false`/`0` unlocks gated actions |
| `VERDACT_AUTO_SUBMIT_ENABLED` | Auto-submit kill switch; hard-off unless exactly `true` |
| `VERDACT_SUBMISSION_ENABLED` | LIVE Stripe filing kill switch; hard-off unless exactly `true` (default off — the submission flow ships inert; flip only after the legal gates close) |
| `VERDACT_SUBMISSION_SIGNING_KEY` | Optional HMAC key signing the immutable submitted payload (a sha256 is still recorded if unset) |

## Google OAuth Reviewer Path

Reviewer URL:

```text
https://www.verdact.io/signin
```

Reviewer instructions for Google:

```text
1. Go to https://www.verdact.io/signin.
2. Continue through the reviewer sign-in path. No 2FA is required on this reviewer path.
3. Open Settings > Connections.
4. Click Connect Gmail.
5. Approve the Google OAuth consent screen.
6. On return to Verdact, search Gmail using a query such as newer_than:30d.
7. Select Preview on any result to inspect the selected message before import.
```

This reviewer path requires `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`,
and `GOOGLE_CLIENT_SECRET`, plus the optional `REVIEWER_ACCESS_CODE` gate. See the
[Environment Variables](#environment-variables) section for the full list.

## Analytics (PostHog)

PostHog is wired in via `app/_components/posthog-provider.tsx`. It is **inert until
`NEXT_PUBLIC_POSTHOG_KEY` is set** — with no key the provider and `lib/analytics/track.ts`
no-op, so local dev and key-less previews send nothing. To activate, set
`NEXT_PUBLIC_POSTHOG_KEY` (US Cloud project key) on Vercel; no host var is needed because
events are reverse-proxied through `/ingest` (see `next.config.ts` rewrites → US Cloud) to
avoid ad-blockers.

Privacy posture (Verdact handles dispute PII): session replay is **private by default**
(`maskAllInputs` + `maskTextSelector: '*'` mask every input and all text), person profiles
are `identified_only`, and a `before_send` guard strips autocaptured element text on
`/dashboard|/settings|/onboarding` and query strings on auth routes. Replay records in
production/preview only, never local dev.

Google Cloud OAuth redirect URI:

```text
https://www.verdact.io/api/google/callback
```

The reviewer flow uses `gmail.readonly`, starts only after a user clicks Connect Gmail, stores the temporary OAuth access token in an encrypted HTTP-only cookie, and does not persist Gmail data to a database.

## Next Build Steps

1. Build Supabase Auth and merchant bootstrap against the applied `verdact-dev` schema.
2. Build Stripe Standard OAuth connect/disconnect.
3. Build webhook raw insert plus Inngest handoff.
4. Expand the temporary Google reviewer path into the production Gmail import flow with persistent encrypted token storage, audit logging, and merchant-controlled evidence selection.
5. Add local Docker/Supabase validation before the next schema change when Docker Desktop is available.

Do not implement live billing or live dispute submission before the legal/company gates in the handoff are closed.
