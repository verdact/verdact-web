-- -----------------------------------------------------------------------------
-- Platform admin portal foundation.
--
-- SECURITY MODEL:
--   - `platform_admins` is the founder/admin allowlist for /admin.
--   - `platform_admin_events` is the audit trail for admin writes.
--   - Both tables are service-role-only: RLS enabled, no anon/auth policies,
--     anon/authenticated privileges revoked.
--   - App code checks the signed-in Supabase auth user first, then reads this
--     allowlist with the server-only service-role client.
-- -----------------------------------------------------------------------------

create table if not exists platform_admins (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  email             text not null,
  email_normalized  text generated always as (lower(btrim(email))) stored,
  role              text not null default 'admin' check (role in ('owner', 'admin')),
  status            text not null default 'active' check (status in ('active', 'revoked')),
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_seen_at      timestamptz
);

create unique index if not exists platform_admins_email_normalized_key
  on platform_admins (email_normalized);

create index if not exists platform_admins_user_id_idx
  on platform_admins (user_id)
  where user_id is not null;

create index if not exists platform_admins_status_role_idx
  on platform_admins (status, role);

create index if not exists platform_admins_created_by_idx
  on platform_admins (created_by)
  where created_by is not null;

create table if not exists platform_admin_events (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid references auth.users(id) on delete set null,
  admin_email    text,
  action         text not null,
  target_type    text not null,
  target_id      text,
  metadata       jsonb not null default '{"schema_version":"v1"}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists platform_admin_events_created_at_idx
  on platform_admin_events (created_at desc);

create index if not exists platform_admin_events_admin_user_id_idx
  on platform_admin_events (admin_user_id)
  where admin_user_id is not null;

create index if not exists platform_admin_events_action_idx
  on platform_admin_events (action, created_at desc);

alter table platform_admins enable row level security;
alter table platform_admin_events enable row level security;

revoke all on table platform_admins from anon;
revoke all on table platform_admins from authenticated;
revoke all on table platform_admin_events from anon;
revoke all on table platform_admin_events from authenticated;

grant all on table platform_admins to service_role;
grant all on table platform_admin_events to service_role;

-- Bootstrap the founder accounts that already exist in Supabase Auth. The app
-- also supports VERDACT_ADMIN_EMAILS as an emergency env allowlist, but the DB
-- allowlist is the durable source of truth.
insert into platform_admins (email, role, status, notes)
values
  ('rishi@verdact.io', 'owner', 'active', 'Bootstrap founder account'),
  ('admin@verdact.io', 'owner', 'active', 'Bootstrap founder account'),
  ('rishindra19@gmail.com', 'owner', 'active', 'Bootstrap founder account')
on conflict (email_normalized) do update
set
  role = 'owner',
  status = 'active',
  notes = coalesce(platform_admins.notes, excluded.notes),
  updated_at = now();
