-- ─────────────────────────────────────────────────────────────────────────────
-- Platform financials — founder economics inputs.
--
-- Goal: power the /admin/economics cost + unit-economics engine without
-- hardcoding numbers in source. This singleton row holds the cost assumptions,
-- pricing, and business inputs the founder tunes from the UI. Real revenue and
-- dispute data is read from the operational tables; this table holds only the
-- inputs the database cannot derive (infra spend, cash on hand, CAC spend,
-- churn/lifetime assumptions).
--
-- CONVENTIONS:
--   - Money columns are stored in WHOLE DOLLARS (numeric), not cents.
--   - Percentage columns are stored as PERCENT NUMBERS (e.g. 25 = 25%, 2.9 = 2.9%).
--     The economics engine converts percent -> fraction exactly once.
--
-- SECURITY MODEL:
--   - Singleton row (id = true), mirrors platform_admission_policy.
--   - RLS enabled, no anon/authenticated policies, privileges revoked.
--   - Only the server-only service-role client (behind the founder gate) reads
--     or writes this table.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists platform_financials (
  id                                  boolean primary key default true check (id),

  -- Fixed monthly infrastructure / SaaS costs (USD per month).
  cost_vercel                         numeric not null default 20,
  cost_supabase                       numeric not null default 25,
  cost_inngest                        numeric not null default 0,
  cost_resend                         numeric not null default 0,
  cost_posthog                        numeric not null default 0,
  cost_anthropic_fixed                numeric not null default 0,
  cost_domains                        numeric not null default 5,
  cost_other_fixed                    numeric not null default 0,

  -- Variable / per-unit cost assumptions.
  ai_cost_per_dispute                 numeric not null default 0.50,   -- USD, LLM tokens per evidence packet
  variable_cost_per_dispute_other     numeric not null default 0,      -- USD, storage/email per dispute
  support_cost_per_customer           numeric not null default 0,      -- USD per customer per month
  processing_fee_pct                  numeric not null default 2.9,    -- % on revenue we collect
  processing_fee_fixed                numeric not null default 0.30,   -- USD per collected transaction

  -- Pricing (locked two-tier model; editable for scenario work).
  price_monitoring_monthly            numeric not null default 19,     -- USD/mo subscription
  success_fee_pct                     numeric not null default 25,     -- % of recovered amount
  flat_fee                            numeric not null default 49,     -- USD flat per won dispute

  -- Go-to-market / business inputs.
  marketing_spend_monthly             numeric not null default 0,      -- USD/mo
  acquisition_spend_total             numeric not null default 0,      -- USD cumulative, blended CAC
  cash_on_hand                        numeric not null default 0,      -- USD, for runway
  prior_period_mrr                    numeric not null default 0,      -- USD, last month's MRR (growth, Rule of 40, burn multiple)
  monthly_churn_pct                   numeric not null default 5,      -- % monthly logo churn (assumption)
  avg_disputes_per_customer_monthly   numeric not null default 2,      -- assumption
  assumed_win_rate_pct                numeric not null default 65,     -- % fallback when no real outcomes
  assumed_avg_dispute_amount          numeric not null default 120,    -- USD fallback when no real disputes
  paying_customers_override           integer,                         -- nullable: force paying-sub count

  currency                            text not null default 'USD',
  updated_at                          timestamptz not null default now(),
  updated_by                          uuid references auth.users(id) on delete set null
);

insert into platform_financials (id)
values (true)
on conflict (id) do nothing;

create index if not exists platform_financials_updated_by_idx
  on platform_financials (updated_by)
  where updated_by is not null;

alter table platform_financials enable row level security;

revoke all on table platform_financials from anon;
revoke all on table platform_financials from authenticated;

grant all on table platform_financials to service_role;
