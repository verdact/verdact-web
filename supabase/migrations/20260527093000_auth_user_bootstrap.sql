-- Auto-create a merchant workspace and owner membership when a user signs up
-- via Supabase Auth (email/password, magic link, or OAuth).
--
-- Flow on auth.users INSERT:
--   1. This trigger creates a public.merchants row.
--   2. The existing bootstrap_merchant trigger fires on that insert and creates
--      a merchant_profiles row. It skips merchant_users because auth.uid() is
--      null in this trigger context.
--   3. This trigger then creates the merchant_users row, passing new.id as the
--      owner explicitly (no auth.uid() dependency).
--
-- All inserts run as security definer so RLS does not block them.

create or replace function app_private.handle_new_auth_user()
returns trigger as $$
declare
  new_merchant_id uuid;
  derived_business_name text;
begin
  derived_business_name := coalesce(
    nullif(new.raw_user_meta_data->>'business_name', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.merchants (business_name)
  values (nullif(derived_business_name, ''))
  returning id into new_merchant_id;

  insert into public.merchant_users (
    merchant_id, user_id, role, status, accepted_at
  )
  values (
    new_merchant_id, new.id, 'owner', 'active', now()
  )
  on conflict (merchant_id, user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function app_private.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();
