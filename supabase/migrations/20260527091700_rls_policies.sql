-- Enable RLS on all tables
alter table merchants enable row level security;
alter table merchant_users enable row level security;
alter table processor_connections enable row level security;
alter table merchant_profiles enable row level security;
alter table vamp_snapshots enable row level security;
alter table disputes enable row level security;
alter table dispute_pii enable row level security;
alter table dispute_events enable row level security;
alter table efw_alerts enable row level security;
alter table submission_attempts enable row level security;
alter table evidence_files enable row level security;
alter table slack_connections enable row level security;
alter table gmail_connections enable row level security;
alter table audit_log enable row level security;

-- Core Access Helpers (Security Definer to bypass RLS loops)
-- These live outside public so Supabase does not expose them as RPC endpoints.

-- Returns true if the authenticated user has the given role (or higher) for the merchant.
-- Role precedence: owner > admin > member > viewer
create or replace function app_private.user_has_merchant_role(
  target_merchant_id uuid,
  min_role text default 'viewer'
)
returns boolean as $$
  select exists (
    select 1
    from public.merchant_users mu
    where mu.merchant_id = target_merchant_id
      and mu.user_id = (select auth.uid())
      and mu.status = 'active'
      and (
        case mu.role
          when 'owner'  then 4
          when 'admin'  then 3
          when 'member' then 2
          when 'viewer' then 1
        end
      ) >= (
        case min_role
          when 'owner'  then 4
          when 'admin'  then 3
          when 'member' then 2
          when 'viewer' then 1
        end
      )
  );
$$ language sql stable security definer set search_path = '';

revoke all on function app_private.user_has_merchant_role(uuid, text) from public;
grant execute on function app_private.user_has_merchant_role(uuid, text) to authenticated, service_role;

-- Returns all merchant_ids the authenticated user can access (any active role)
create or replace function app_private.merchant_ids_for_user()
returns setof uuid as $$
  select merchant_id from public.merchant_users
  where user_id = (select auth.uid()) and status = 'active';
$$ language sql stable security definer set search_path = '';

revoke all on function app_private.merchant_ids_for_user() from public;
grant execute on function app_private.merchant_ids_for_user() to authenticated, service_role;


-- 1. merchants
create policy "merchants_select_member"
  on merchants for select
  using (id in (select app_private.merchant_ids_for_user()));

create policy "merchants_insert_authed"
  on merchants for insert
  with check (auth.uid() is not null);

create policy "merchants_update_admin"
  on merchants for update
  using (app_private.user_has_merchant_role(id, 'admin'));

create policy "merchants_delete_owner"
  on merchants for delete
  using (app_private.user_has_merchant_role(id, 'owner'));


-- 2. merchant_users
create policy "merchant_users_select"
  on merchant_users for select
  using (
    user_id = (select auth.uid())
    or merchant_id in (select app_private.merchant_ids_for_user())
  );

create policy "merchant_users_invite"
  on merchant_users for insert
  with check (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  );

create policy "merchant_users_update"
  on merchant_users for update
  using (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  )
  with check (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  );

create policy "merchant_users_delete"
  on merchant_users for delete
  using (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  );


-- 3. processor_connections
create policy "processor_connections_select"
  on processor_connections for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "processor_connections_write"
  on processor_connections for all
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));


-- 4. merchant_profiles
create policy "merchant_profiles_select"
  on merchant_profiles for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "merchant_profiles_write"
  on merchant_profiles for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));


-- 5. vamp_snapshots
create policy "vamp_snapshots_select"
  on vamp_snapshots for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));


-- 6. disputes
create policy "disputes_select"
  on disputes for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "disputes_write"
  on disputes for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));


-- 7. dispute_pii
create policy "dispute_pii_select"
  on dispute_pii for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "dispute_pii_write"
  on dispute_pii for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));


-- 8. dispute_events
create policy "dispute_events_select"
  on dispute_events for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));


-- 9. efw_alerts
create policy "efw_alerts_select"
  on efw_alerts for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "efw_alerts_write"
  on efw_alerts for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));


-- 10. submission_attempts
create policy "submission_attempts_select"
  on submission_attempts for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));


-- 11. evidence_files
create policy "evidence_files_select"
  on evidence_files for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "evidence_files_write"
  on evidence_files for all
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));


-- 12. slack_connections
create policy "slack_connections_select"
  on slack_connections for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "slack_connections_write"
  on slack_connections for all
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));


-- 13. gmail_connections
create policy "gmail_connections_select"
  on gmail_connections for select
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "gmail_connections_write"
  on gmail_connections for all
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));


-- 14. audit_log
create policy "audit_log_select"
  on audit_log for select
  using (
    (merchant_id is not null and merchant_id in (select app_private.merchant_ids_for_user()))
    or user_id = (select auth.uid())
  );
