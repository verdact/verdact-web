-- ─────────────────────────────────────────────────────────────────────────────
-- guidance_impressions — per-merchant tip history powering the tip cadence and
-- the future training dataset (Persona + Tip Cadence build, 2026-06-15; plan
-- 06_Build/Stage_Docs/Verdact_Personas_and_Tip_Cadence_Build_Plan_2026-06-14.md §2.2).
--
-- One row per (merchant, tip, render occurrence). The dashboard records a "shown"
-- row for each guidance band item it renders (once per merchant/rule/UTC-day, so
-- refreshes don't spam rows or move the cooldown clock). The cadence wrapper reads
-- recent rows to suppress non-urgent tips inside their rest window:
--   - non-urgent shown tip rests ~24h after being shown (carried over to the next
--     day; same-day refreshes keep showing it);
--   - dismissed tip rests 7d from dismissal;
--   - urgent tips (deadline / account-risk) are EXEMPT and keep showing until the
--     underlying issue resolves.
-- dismissed_at / acted_at are set by the dashboard server actions (P5). persona /
-- is_urgent / target_ref are persisted so the recorder never re-derives them and
-- the dataset is complete for future tuning (ML is out of scope now).
--
-- SECURITY MODEL: merchant-scoped RLS mirroring the other app tables (app_private
-- helpers from 20260527091700_rls_policies.sql). Members read; the 'member' role
-- writes. service_role full. PostgREST table grants IN ADDITION to RLS — without
-- them the authenticated INSERT/UPDATE fail with 42501 even though RLS would allow
-- the row (the lesson in 20260614040000_grant_evidence_intake.sql).
--
-- NOT APPLIED automatically — left for review per the multi-agent build rule.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists guidance_impressions (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references merchants(id) on delete cascade,
  rule_id       text not null,                    -- GuidanceRule.id, e.g. 'health-watch'
  -- CHECKs mirror the TS contracts (GuidanceTarget / GuidanceSeverity /
  -- GuidancePersona) so the schema guarantees clean enum labels even if a row is
  -- ever written outside the validated app path (e.g. a service_role job).
  target        text not null
    check (target in ('dashboard', 'account-health', 'disputes', 'settings', 'workbench')),
  severity      text not null
    check (severity in ('neutral', 'gap', 'verified')),
  is_urgent     boolean not null default false,   -- persisted so cadence never re-derives it
  target_ref    text,                             -- dispute/EFW id this instance pointed at (nullable)
  persona       text                              -- self-selected persona at render time (nullable)
    check (persona in ('marcus', 'priya', 'david', 'aisha')),
  shown_at      timestamptz not null default now(),
  dismissed_at  timestamptz,                      -- set on dismiss (rests longer)
  acted_at      timestamptz                       -- set on action click (future Step-3 label)
);

create index if not exists guidance_impressions_cadence_idx
  on guidance_impressions (merchant_id, rule_id, shown_at desc);

alter table guidance_impressions enable row level security;

create policy "guidance_impressions_select"
  on guidance_impressions for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "guidance_impressions_write"
  on guidance_impressions for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

grant select, insert, update, delete on guidance_impressions to authenticated;
grant all on guidance_impressions to service_role;
