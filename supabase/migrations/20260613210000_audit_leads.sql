-- ─────────────────────────────────────────────────────────────────────────────
-- audit_leads — captures submissions from the PUBLIC, no-login /audit funnel.
--
-- These are PRE-signup leads (no merchant_id yet). A prospect uploads or types
-- their last ~90 days of disputes + Stripe volume; we score it, capture their
-- email, and store the raw submission + computed score so the data can be
-- carried forward as historical backfill when they sign up.
--
-- SECURITY MODEL:
--   - Written ONLY by the public API route using the service-role client, which
--     bypasses RLS. There is NO authenticated/anon access path to this table.
--   - RLS is enabled and NO policies are created, so PostgREST exposes nothing
--     to anon/authenticated. Privileges are revoked from anon + authenticated.
--   - File contents are never stored verbatim as files; only the parsed/derived
--     dispute rows (already sanitized by the scoring brain) live in JSONB.
--
-- NOT APPLIED automatically — left for review per the build instruction. Apply
-- with the rest of the migrations after Rishi's review.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists audit_leads (
  id                          uuid primary key default gen_random_uuid(),
  email                       text not null,
  business_name               text,

  -- Window inputs supplied by the merchant.
  settled_transaction_count   integer not null default 0,
  window_days                 integer not null default 90,

  -- Roll-up of the scored result (denormalized for quick lead triage).
  total_disputes              integer not null default 0,
  lost_disputes               integer not null default 0,
  should_have_won_count       integer not null default 0,
  comms_hinged_count          integer not null default 0,
  estimated_dispute_rate      numeric(10, 6),                 -- FRACTION (e.g. 0.0042), never the 100x percent
  standing_band               text check (
                                standing_band in ('tooEarly', 'healthy', 'close', 'atRisk', 'unknown')
                              ),

  -- Full untrusted-but-sanitized submission + computed score, for backfill.
  raw_submission              jsonb,                          -- { settledTransactionCount, windowDays, disputes[] }
  computed_score              jsonb,                          -- AuditScore output

  -- Provenance / abuse signals (never user-controlled content).
  source                      text not null default 'audit_funnel',
  ip_hash                     text,                           -- salted hash, not raw IP
  user_agent                  text,

  -- Set once the lead signs up and we attach the backfill.
  converted_merchant_id       uuid references merchants(id) on delete set null,
  converted_at                timestamptz,

  created_at                  timestamptz not null default now()
);

create index if not exists audit_leads_email_idx       on audit_leads (lower(email));
create index if not exists audit_leads_created_at_idx   on audit_leads (created_at desc);
create index if not exists audit_leads_converted_idx    on audit_leads (converted_merchant_id)
  where converted_merchant_id is not null;

-- RLS on, no policies: only the service-role client (which bypasses RLS) can
-- read or write. anon + authenticated get nothing.
alter table audit_leads enable row level security;

revoke all on table audit_leads from anon;
revoke all on table audit_leads from authenticated;
grant all on table audit_leads to service_role;
