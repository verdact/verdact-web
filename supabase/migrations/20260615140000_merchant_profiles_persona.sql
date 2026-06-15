-- ─────────────────────────────────────────────────────────────────────────────
-- merchant_profiles.persona — the merchant's self-selected "kind of business"
-- used to weight which guidance tips rank first (Persona + Tip Cadence build,
-- 2026-06-15; plan 06_Build/Stage_Docs/Verdact_Personas_and_Tip_Cadence_Build_Plan_2026-06-14.md).
--
-- ASK-ONLY (founder sign-off §0): persona is set from a skippable onboarding
-- question and the Settings → Business control. There is NO inference and NO
-- default — when persona is null the engine applies no multiplier (generic
-- ranking). The id maps 1:1 onto GuidancePersona (lib/guidance/types.ts).
--   persona_source distinguishes a clean self-selected label from a future
--   inferred one (kept for the eventual training dataset; only 'self_select'
--   is written today).
--
-- No new grant / RLS: merchant_profiles is already RLS-protected and granted to
-- `authenticated` (20260527090400 + 20260613060000_grant_settings_writes); a
-- table-level GRANT UPDATE covers new columns. persona is NULLABLE and is NOT
-- part of the profile-completeness check, so it never fires "complete your
-- profile".
--
-- NOT APPLIED automatically — left for review per the multi-agent build rule.
-- ─────────────────────────────────────────────────────────────────────────────

alter table merchant_profiles
  add column if not exists persona text
    check (persona in ('marcus', 'priya', 'david', 'aisha')),
  add column if not exists persona_source text
    check (persona_source in ('self_select', 'inferred'));
