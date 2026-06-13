-- The merchant Settings page (/settings) lets a merchant edit its own business
-- profile and rename its workspace. PostgREST needs table-level privileges in
-- addition to RLS. RLS remains the row-level enforcement layer:
--   merchant_profiles_write  -> requires role >= member (own merchant only)
--   merchants_update_admin   -> requires role >= admin  (own merchant only)
-- These grants only let authenticated app code reach those existing policies.

grant select, insert, update on public.merchant_profiles to authenticated;
grant update on public.merchants to authenticated;
