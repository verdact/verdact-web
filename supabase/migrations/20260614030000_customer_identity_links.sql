-- ─────────────────────────────────────────────────────────────────────────────
-- customer_identity_links — the merchant's CONFIRMED customer-identity decisions
-- (R8 smart customer-merge, build plan / strategy doc §R8, 2026-06-13).
--
-- Verdact groups disputes by exact customer email (clean subscription/repeat
-- linkage). For the remaining pairs (Rishi decision 2026-06-14): when the engine
-- is SURE it AUTO-MERGES (recorded here with source='auto'); only DOUBTFUL pairs
-- are surfaced as a "possible same customer" suggestion the merchant confirms.
-- Auto-merge is internal grouping only — reversible with a one-click split, never
-- an outward/irreversible action. Every decision is recorded:
--   - decision='merge' → treat linked_key as the same customer as primary_key.
--   - decision='split' → NOT the same (suppresses the suggestion / undoes a merge;
--                        a split with source='auto' is a corrected auto-merge).
-- The recorded decisions + corrections are the training signal toward full
-- automation (lifting the auto-merge bar to more kinds over time).
--
-- KEYS: primary_key / linked_key are the normalized customer email keys used by
-- the grouping layer (lib/dal getDisputesByCustomer). No new PII is stored here.
--
-- SECURITY MODEL: merchant-scoped RLS mirroring the other app tables
-- (app_private helpers from 20260527091700_rls_policies.sql). Members read; the
-- 'member' role writes. service_role full.
--
-- NOT APPLIED automatically — left for review per the multi-agent build rule.
-- Apply after Rishi's review (this is Codex's backend lane).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists customer_identity_links (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references merchants(id) on delete cascade,

  -- Canonical (kept) customer key and the identity folded into / split from it.
  primary_key     text not null,
  linked_key      text not null,

  decision        text not null check (decision in ('merge', 'split')),

  -- How the pair was surfaced + the engine's confidence (training signal).
  source          text not null default 'suggested' check (source in ('suggested', 'manual', 'auto')),
  suggestion_kind text,                      -- 'normalized_email' | 'same_name' | ...
  confidence      numeric(4, 3),             -- 0.000..1.000 the engine assigned
  reason          text,                      -- human-readable why

  created_by      uuid,                      -- auth.uid() of the confirming user
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One decision per (merchant, ordered pair). Re-deciding updates the row.
  constraint customer_identity_links_pair_key unique (merchant_id, primary_key, linked_key),
  constraint customer_identity_links_distinct check (primary_key <> linked_key)
);

create index if not exists customer_identity_links_merchant_idx
  on customer_identity_links (merchant_id);

alter table customer_identity_links enable row level security;

create policy "customer_identity_links_select"
  on customer_identity_links for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "customer_identity_links_write"
  on customer_identity_links for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

grant select, insert, update, delete on customer_identity_links to authenticated;
grant all on customer_identity_links to service_role;
