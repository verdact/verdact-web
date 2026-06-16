-- ─────────────────────────────────────────────────────────────────────────────
-- Admin console rework — founder-console support (UNAPPLIED pending review).
--
-- This migration backs the reworked founder/admin console. It is split into five
-- blocks, each independently idempotent (add column / create table IF NOT EXISTS)
-- so it is safe to re-run:
--
--   1. merchant_profiles category — lets the founder classify a merchant
--      (freelancer / agency / saas / other) and records WHERE that label came
--      from (admin override, explicit persona, Stripe inference, heuristic, or
--      uncategorized) plus who/when for an admin override. All nullable, no
--      default: an unset category means "uncategorized" without writing a value.
--   2. waitlist_signups geo — coarse country/region of a waitlist lead plus the
--      source of that geo signal, for funnel geography. Nullable.
--   3. audit_leads geo — same coarse geo columns on the public audit funnel.
--      Nullable.
--   4. merchant_vamp_notifications — a founder-drafted, manually-sent VAMP
--      outreach record (one row per drafted notification). There is NO send
--      pipeline yet, so sent_at stays NULL until a human marks it sent.
--   5. platform_financial_scenarios — named, pinnable snapshots of a full
--      FinancialInputs payload so the founder can save and compare economics
--      scenarios (base / upside / risk / custom).
--
-- SECURITY MODEL:
--   - The two NEW tables (merchant_vamp_notifications, platform_financial_scenarios)
--     are founder/service-role-only and mirror platform_financials EXACTLY:
--     RLS enabled, NO anon/authenticated policies, privileges revoked from
--     anon + authenticated, granted to service_role. Only the server-only
--     service-role client (behind the founder gate) reads or writes them.
--   - The new columns on merchant_profiles / waitlist_signups / audit_leads
--     INHERIT those tables' existing grants and RLS, so no extra grant is needed.
--
-- NOT APPLIED automatically — left for review per the multi-agent build rule.
-- Apply with the rest of the migrations after Rishi's review.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Block 1: merchant_profiles category ──────────────────────────────────────
-- Founder-set business classification + provenance. All nullable, no default:
-- the new columns inherit merchant_profiles' existing RLS + grants, so no extra
-- grant is required here.
alter table merchant_profiles
  add column if not exists category text
    check (category in ('freelancer', 'agency', 'saas', 'other')),
  add column if not exists category_source text
    check (category_source in (
      'admin_override',
      'explicit_persona',
      'stripe_inferred',
      'heuristic',
      'uncategorized'
    )),
  add column if not exists category_overridden_by uuid
    references auth.users(id) on delete set null,
  add column if not exists category_set_at timestamptz;

-- ── Block 2: waitlist_signups geo ────────────────────────────────────────────
-- Coarse geography of a waitlist lead + the source of that signal. Nullable;
-- inherits waitlist_signups' existing RLS + grants.
alter table waitlist_signups
  add column if not exists geo_country text,
  add column if not exists geo_region  text,
  add column if not exists geo_source  text;

-- ── Block 3: audit_leads geo ─────────────────────────────────────────────────
-- Same coarse geography columns on the public audit funnel. Nullable; inherits
-- audit_leads' existing RLS + grants.
alter table audit_leads
  add column if not exists geo_country text,
  add column if not exists geo_region  text,
  add column if not exists geo_source  text;

-- ── Block 4: merchant_vamp_notifications ─────────────────────────────────────
-- Founder-drafted VAMP outreach records. One row per drafted notification.
-- There is NO send pipeline yet: sent_at stays NULL until a human marks it sent.
-- Founder/service-role-only — mirrors platform_financials' security model.
create table if not exists merchant_vamp_notifications (
  id                    uuid primary key default gen_random_uuid(),
  merchant_id           uuid not null references merchants(id) on delete cascade,

  -- Snapshot of the standing that prompted the outreach.
  estimated_vamp_ratio  numeric(10, 6),
  band                  text check (band in ('healthy', 'close', 'atRisk', 'unknown')),
  over_line_since       timestamptz,

  -- Drafting provenance (who/when). sent_at is intentionally left NULL.
  drafted_at            timestamptz,
  drafted_by            uuid references auth.users(id) on delete set null,
  channel               text,
  sent_at               timestamptz,                    -- stays NULL: no send pipeline yet
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists merchant_vamp_notifications_merchant_created_idx
  on merchant_vamp_notifications (merchant_id, created_at desc);

-- RLS on, no policies: only the service-role client (which bypasses RLS) can
-- read or write. anon + authenticated get nothing.
alter table merchant_vamp_notifications enable row level security;

revoke all on table merchant_vamp_notifications from anon;
revoke all on table merchant_vamp_notifications from authenticated;
grant all on table merchant_vamp_notifications to service_role;

-- ── Block 5: platform_financial_scenarios ────────────────────────────────────
-- Named, pinnable snapshots of a full FinancialInputs payload so the founder can
-- save and compare economics scenarios. Founder/service-role-only — mirrors
-- platform_financials' security model.
create table if not exists platform_financial_scenarios (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text check (kind in ('base', 'upside', 'risk', 'custom')) default 'custom',

  -- Full FinancialInputs snapshot captured when the scenario was saved.
  inputs        jsonb not null,
  notes         text,

  is_pinned     boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists platform_financial_scenarios_pinned_created_idx
  on platform_financial_scenarios (is_pinned desc, created_at desc);

-- RLS on, no policies: only the service-role client (which bypasses RLS) can
-- read or write. anon + authenticated get nothing.
alter table platform_financial_scenarios enable row level security;

revoke all on table platform_financial_scenarios from anon;
revoke all on table platform_financial_scenarios from authenticated;
grant all on table platform_financial_scenarios to service_role;

-- ── Block 6: service-role read grants the console loaders need ────────────────
-- The founder-console loaders read merchant_profiles (category / persona) and
-- merchant_users (owner-email resolution) through the service-role client, which
-- needs an explicit table grant (it bypasses RLS but not table privileges).
-- 20260616040000_grant_service_role_admin_queries granted merchants / disputes /
-- vamp_snapshots / etc. to service_role but MISSED these two, so without this the
-- merchants / leads / command loaders get "permission denied" on them. Idempotent.
grant select on table merchant_profiles to service_role;
grant select on table merchant_users   to service_role;
