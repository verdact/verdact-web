-- ─────────────────────────────────────────────────────────────────────────────
-- Beta admission lock.
--
-- Goal: Verdact stays private while the app is still in closed beta, but can be
-- opened later without removing the guardrails. The singleton policy row starts
-- in invite_only mode. When Rishi is ready for open beta, flip it with:
--
--   update platform_admission_policy
--   set mode = 'open_beta', updated_at = now()
--   where id = true;
--
-- SECURITY MODEL:
--   - `platform_invites` is the allowlist for closed beta.
--   - `platform_admission_policy.mode = open_beta` admits everyone.
--   - RLS is enabled and no anon/authenticated policies exist, so only
--     service-role/admin tooling can inspect or change admission state.
--   - The auth.users bootstrap trigger checks admission before creating a
--     merchant workspace. Unapproved users cannot bootstrap a usable workspace
--     through email/password, OAuth, or a stale server action.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists platform_admission_policy (
  id          boolean primary key default true check (id),
  mode        text not null default 'invite_only' check (mode in ('invite_only', 'open_beta')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

insert into platform_admission_policy (id, mode)
values (true, 'invite_only')
on conflict (id) do nothing;

create table if not exists platform_invites (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  email_normalized  text generated always as (lower(btrim(email))) stored,
  status            text not null default 'approved' check (status in ('approved', 'revoked')),
  source            text,
  notes             text,
  expires_at        timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists platform_invites_email_normalized_key
  on platform_invites (email_normalized);

create index if not exists platform_invites_status_idx
  on platform_invites (status, expires_at);

create index if not exists platform_admission_policy_updated_by_idx
  on platform_admission_policy (updated_by)
  where updated_by is not null;

create index if not exists platform_invites_created_by_idx
  on platform_invites (created_by)
  where created_by is not null;

alter table platform_admission_policy enable row level security;
alter table platform_invites enable row level security;

revoke all on table platform_admission_policy from anon;
revoke all on table platform_admission_policy from authenticated;
revoke all on table platform_invites from anon;
revoke all on table platform_invites from authenticated;

grant all on table platform_admission_policy to service_role;
grant all on table platform_invites to service_role;

create or replace function app_private.email_has_beta_access(candidate_email text)
returns boolean as $$
  select
    coalesce(
      (select mode = 'open_beta' from public.platform_admission_policy where id = true),
      false
    )
    or exists (
      select 1
      from public.platform_invites pi
      where pi.email_normalized = lower(btrim(candidate_email))
        and pi.status = 'approved'
        and (pi.expires_at is null or pi.expires_at > now())
    );
$$ language sql stable security definer set search_path = '';

revoke all on function app_private.email_has_beta_access(text) from public;
grant execute on function app_private.email_has_beta_access(text) to service_role;

create or replace function app_private.handle_new_auth_user()
returns trigger as $$
declare
  new_merchant_id uuid;
  derived_business_name text;
begin
  if not app_private.email_has_beta_access(new.email) then
    raise exception 'Verdact beta access is invite-only right now.'
      using errcode = 'P0001';
  end if;

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
