# Verdact Web

Next.js app for Verdact, the Stripe-first chargeback evidence and dispute-risk platform for SaaS and service businesses.

## Current State

This app currently includes the landing page, privacy policy, and a narrow Google reviewer path for Gmail OAuth verification. It is not yet the MVP dashboard.

Before implementation, read:

1. `../SESSION_HANDOFF.md`
2. `../CHARGEBACKIQ_STRATEGY_SNAPSHOT_v2.md`
3. `../06_Build/Verdact_Codex_Implementation_Readiness_2026-05-23.md`

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Google OAuth Reviewer Path

Reviewer URL:

```text
https://verdact.io/signin
```

Reviewer instructions for Google:

```text
1. Go to https://verdact.io/signin.
2. Continue through the reviewer sign-in path. No 2FA is required on this reviewer path.
3. Open Settings > Connections.
4. Click Connect Gmail.
5. Approve the Google OAuth consent screen.
6. On return to Verdact, search Gmail using a query such as newer_than:30d.
7. Select Preview on any result to inspect the selected message before import.
```

Required deployment environment variables:

```text
NEXT_PUBLIC_APP_URL=https://verdact.io
NEXTAUTH_SECRET=<random production secret>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
REVIEWER_ACCESS_CODE=<optional reviewer gate code>
```

Google Cloud OAuth redirect URI:

```text
https://verdact.io/api/google/callback
```

The reviewer flow uses `gmail.readonly`, starts only after a user clicks Connect Gmail, stores the temporary OAuth access token in an encrypted HTTP-only cookie, and does not persist Gmail data to a database.

## Next Build Steps

1. Add missing env keys: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `STRIPE_API_VERSION`, `VERDACT_SIGNING_KEY_V1`.
2. Install runtime SDKs for Supabase, Stripe, Inngest, Resend, Anthropic, and validation.
3. Build Supabase migrations, starting with `merchants`, `merchant_users`, and `processor_connections`.
4. Build Supabase Auth and merchant bootstrap.
5. Build Stripe Standard OAuth connect/disconnect.
6. Build webhook raw insert plus Inngest handoff.
7. Expand the temporary Google reviewer path into the production Gmail import flow with persistent encrypted token storage, audit logging, and merchant-controlled evidence selection.

Do not implement live billing or live dispute submission before the legal/company gates in the handoff are closed.
