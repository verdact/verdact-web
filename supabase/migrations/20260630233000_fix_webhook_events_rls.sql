-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL FIX: Enable RLS on webhook_events
--
-- The webhook_events table was created in 20260527090600 but was never included
-- in the RLS-enable block of 20260527091700_rls_policies.sql. The advisor_cleanup
-- migration (20260527092200) added a service_role policy but without RLS enabled,
-- the policy had no effect — the table was publicly accessible to anyone with the
-- project URL via the Data API.
--
-- This migration:
--   1. Enables RLS (the dormant service_role policy from advisor_cleanup now takes
--      effect, blocking anon + authenticated).
--   2. Explicitly revokes all privileges from anon + authenticated as defense in
--      depth (webhook payloads contain raw Stripe event data and should never be
--      queryable from the client).
--   3. Ensures service_role retains full access (it already has grants from
--      20260617000000_grant_service_role_operational.sql).
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable RLS (makes the existing service_role-only policy active)
alter table public.webhook_events enable row level security;

-- 2. Defense in depth: revoke any residual privileges from public-facing roles
revoke all on table public.webhook_events from anon;
revoke all on table public.webhook_events from authenticated;

-- 3. Confirm service_role has the grants it needs (idempotent)
grant select, insert, update on public.webhook_events to service_role;
