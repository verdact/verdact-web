-- ─────────────────────────────────────────────────────────────────────────────
-- Perf: redundant multiple-permissive-policy cleanup (advisor 0006).
--
-- The Supabase performance advisor flags 0006_multiple_permissive_policies on
-- public.customer_identity_links and public.guidance_impressions: each table has
-- TWO permissive policies that both cover SELECT for the same role
-- (`authenticated`). Postgres must evaluate every permissive policy that matches a
-- command and OR their predicates, so a redundant SELECT-covering policy is extra
-- per-row work on every read.
--
-- Both tables were created (2026-06-14 / 2026-06-15) AFTER the original advisor
-- cleanup (20260527092200_advisor_cleanup.sql) split the rest of the app's
-- FOR ALL policies, so they still carry the old `_select` + `_write` (FOR ALL)
-- shape that re-introduces the overlap. This migration brings them in line.
--
-- BEFORE (per table):
--   "<table>_select"  FOR SELECT  USING merchant_ids_for_user()        -- any active role reads
--   "<table>_write"   FOR ALL     USING/CHECK user_has_merchant_role('member')
--     → FOR ALL implicitly includes SELECT, so SELECT is covered by BOTH policies.
--
-- AFTER (per table) — one permissive policy per (role, action), mirroring the
-- per-command split already used by disputes / dispute_pii / merchant_profiles in
-- 20260527092200_advisor_cleanup.sql:
--   "<table>_select"  FOR SELECT  USING merchant_ids_for_user()        -- unchanged
--   "<table>_insert"  FOR INSERT  WITH CHECK user_has_merchant_role('member')
--   "<table>_update"  FOR UPDATE  USING/CHECK user_has_merchant_role('member')
--   "<table>_delete"  FOR DELETE  USING       user_has_merchant_role('member')
--
-- EFFECTIVE ACCESS IS UNCHANGED. The previous FOR ALL policy granted INSERT,
-- UPDATE and DELETE at the 'member' role; the three new per-command policies keep
-- DELETE at 'member' to preserve that exactly. (Note: the original advisor cleanup
-- narrowed DELETE to 'admin' on some tables; we intentionally do NOT do that here
-- because the goal is a behaviour-preserving perf cleanup, not a privilege change.)
-- SELECT remains the single merchant-scoped read policy for any active role.
-- Table grants (authenticated / service_role) and service_role bypass are untouched.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE so a re-run is safe.
--
-- NOT APPLIED automatically — left for review per the multi-agent build rule.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── customer_identity_links ──────────────────────────────────────────────────
drop policy if exists "customer_identity_links_select" on public.customer_identity_links;
drop policy if exists "customer_identity_links_write"  on public.customer_identity_links;

create policy "customer_identity_links_select"
  on public.customer_identity_links for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "customer_identity_links_insert"
  on public.customer_identity_links for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "customer_identity_links_update"
  on public.customer_identity_links for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "customer_identity_links_delete"
  on public.customer_identity_links for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'));

-- ── guidance_impressions ─────────────────────────────────────────────────────
drop policy if exists "guidance_impressions_select" on public.guidance_impressions;
drop policy if exists "guidance_impressions_write"  on public.guidance_impressions;

create policy "guidance_impressions_select"
  on public.guidance_impressions for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "guidance_impressions_insert"
  on public.guidance_impressions for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "guidance_impressions_update"
  on public.guidance_impressions for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "guidance_impressions_delete"
  on public.guidance_impressions for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'));
