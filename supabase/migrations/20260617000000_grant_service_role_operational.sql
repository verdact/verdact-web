-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL FIX — service_role operational grants for the dispute-ingestion pipeline.
--
-- Confirmed 2026-06-17 via has_table_privilege() against verdact-dev: the
-- service_role (the trusted backend role used by the Stripe webhook route and the
-- stripe-webhook-received Inngest processor) had NO INSERT on the dispute-
-- ingestion tables. service_role bypasses RLS but STILL needs explicit table
-- privileges (GRANTs) — and these were never granted at table-creation time.
--
-- Effect of the gap: every Stripe webhook delivery 500'd at the very first
-- `webhook_events` INSERT (that table has 0 rows — it has NEVER persisted an
-- event), and the downstream `disputes` upsert / `dispute_events` insert would
-- also throw. The pipeline only appeared healthy because the test connected
-- account has charges disabled, so no real dispute has ever exercised it.
-- (Only vamp_snapshots was granted, via 20260614010000_grant_service_role_
-- account_health — which is why Account Health worked while ingestion silently
-- did not.)
--
-- This is the same recurring grant-gap bug class already hit on slack_connections
-- and dispute_pii (see 20260616000000). Here we grant the backend role the
-- operational DML it genuinely owns across the dispute lifecycle. RLS is
-- unaffected (service_role bypasses it by design); these are pure table grants.
-- DELETE is intentionally NOT granted (the ingestion path never deletes; rows
-- are upserted/updated only).
-- ─────────────────────────────────────────────────────────────────────────────

-- Dispute-ingestion lifecycle — written by app/api/stripe/webhook/route.ts and
-- lib/inngest/functions/stripe-webhook-received.ts (both service-role clients):
grant select, insert, update on public.webhook_events to service_role;
grant select, insert, update on public.disputes       to service_role;
grant select, insert, update on public.dispute_events to service_role;
grant select, insert, update on public.dispute_pii    to service_role;
grant select, insert, update on public.efw_alerts     to service_role;

-- Connection liveness — the webhook updates processor_connections.last_event_seen_at
-- (it already had SELECT; it lacked UPDATE):
grant update on public.processor_connections to service_role;

-- Read access the packet / account-health / future submission-recording paths
-- need (merchant writes to these stay on the authenticated/RLS path):
grant select on public.evidence_files      to service_role;
grant select on public.submission_attempts to service_role;
