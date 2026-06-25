-- ─────────────────────────────────────────────────────────────────────────────
-- service_role operational grants for the MANUAL Stripe submission path
-- (lib/evidence/stripe-submit.ts + lib/evidence/stripe-files.ts) + the per-merchant
-- submission opt-in column.
--
-- Same recurring grant-gap class as 20260617000000: service_role bypasses RLS but
-- STILL needs explicit table GRANTs. The submit path runs under the service-role
-- client and writes:
--   - evidence_files       UPDATE  (persist processor_file_id after Stripe File Upload)
--   - submission_attempts  INSERT/UPDATE (immutable attempt log; UPDATE only for the
--                          in_progress -> succeeded/failed/unknown transition)
--   - audit_log            INSERT  (immutable pre-action audit; the fail-closed gate
--                          in lib/entitlements/audit.ts — without this, every submit
--                          returns audit_write_failed and refuses)
-- disputes + dispute_events already have insert/update from 20260617000000.
-- No DELETE anywhere: audit_log / submission_attempts are append-only; evidence_files
-- update-only on this path.
-- ─────────────────────────────────────────────────────────────────────────────

grant insert, update on public.evidence_files      to service_role;
grant insert, update on public.submission_attempts to service_role;
grant insert         on public.audit_log           to service_role;

-- Per-merchant submission opt-in (default OFF). Gate 2 of the submit ladder reads
-- this: a merchant must explicitly turn filing on in Settings before any submit is
-- even considered (the kill switch + entitlement gate still apply on top).
alter table public.merchant_profiles
  add column if not exists submission_opt_in boolean not null default false;
