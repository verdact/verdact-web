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

-- Double-file guard (security review 2026-06-25): at most ONE active (in_progress)
-- or succeeded attempt per dispute. A second concurrent OR sequential submit's
-- in_progress insert violates this partial unique index and is surfaced as
-- attempt_conflict before any Stripe call — closing the read-then-write race on
-- attempt_number. A retry after a FAILED attempt is still allowed (failed/unknown
-- rows are excluded). Ops note: a row stuck 'in_progress' (crash mid-flight) blocks
-- new attempts until reconciled to 'failed'/'unknown' — intentional: prefer
-- blocking over double-filing real evidence.
create unique index if not exists submission_attempts_one_active_per_dispute
  on public.submission_attempts (dispute_id)
  where status in ('in_progress', 'succeeded');
