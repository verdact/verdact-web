-- ─────────────────────────────────────────────────────────────────────────────
-- waitlist_signups — captures emails from the PUBLIC "launching soon" gate.
--
-- Public sign-up is gated while the app is being finished. New visitors who hit
-- /signup land on a launching-soon panel and can leave an email so the team can
-- reach out when Verdact opens. These are PRE-account leads (no merchant_id yet).
--
-- SECURITY MODEL (mirrors audit_leads):
--   - Written ONLY by the public API route using the service-role client, which
--     bypasses RLS. There is NO authenticated/anon access path to this table.
--   - RLS is enabled and NO policies are created, so PostgREST exposes nothing
--     to anon/authenticated. Privileges are revoked from anon + authenticated.
--   - email is UNIQUE so a repeat submission is a graceful no-op, not a dup row.
--
-- NOT APPLIED automatically — left for review per the build instruction. Apply
-- with the rest of the migrations after Rishi's review.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists waitlist_signups (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,

  -- Where the visitor was when they joined (e.g. 'launching_soon').
  source        text,

  -- Provenance / abuse signals (never user-controlled content).
  ip_hash       text,                           -- salted hash, not raw IP
  user_agent    text,

  created_at    timestamptz not null default now()
);

create index if not exists waitlist_signups_email_idx       on waitlist_signups (lower(email));
create index if not exists waitlist_signups_created_at_idx   on waitlist_signups (created_at desc);

-- RLS on, no policies: only the service-role client (which bypasses RLS) can
-- read or write. anon + authenticated get nothing.
alter table waitlist_signups enable row level security;

revoke all on table waitlist_signups from anon;
revoke all on table waitlist_signups from authenticated;
grant all on table waitlist_signups to service_role;
