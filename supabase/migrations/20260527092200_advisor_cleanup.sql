-- Supabase advisor cleanup after initial schema apply.
-- Keep this after the 20260527090000-20260527092100 baseline migrations.

-- 1. Lock trigger/helper functions to an explicit search_path.
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = '';

create or replace function public.require_jsonb_schema_version(payload jsonb, column_name text)
returns void as $$
begin
  if payload is null then return; end if;
  if not (payload ? 'schema_version') then
    raise exception 'JSONB column % missing required top-level "schema_version" key', column_name;
  end if;
end;
$$ language plpgsql immutable set search_path = '';

create or replace function public.require_schema_version_on_jsonb_columns()
returns trigger as $$
declare
  cols text[];
  col text;
  val jsonb;
begin
  cols := case tg_table_name
    when 'processor_connections' then array['metadata']
    when 'webhook_events'        then array['payload']
    when 'disputes'              then array['evidence_draft', 'evidence_submitted_payload', 'ce3_check_payload', 'processor_submission_response']
    when 'submission_attempts'   then array['evidence_payload', 'merchant_profile_snapshot', 'processor_file_ids', 'processor_response', 'processor_error']
    when 'dispute_pii'           then array['billing_address', 'shipping_address']
    when 'dispute_events'        then array['payload']
    when 'audit_log'             then array['metadata']
    when 'vamp_snapshots'        then array['raw_components']
    else array[]::text[]
  end;

  foreach col in array cols loop
    val := to_jsonb(new) -> col;
    if val is not null and not (val ? 'schema_version') then
      raise exception 'Column %.% requires top-level "schema_version" key in JSONB payload', tg_table_name, col;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql set search_path = '';

create or replace function public.guard_submitted_payload()
returns trigger as $$
begin
  if old.evidence_submitted_payload is not null
     and new.evidence_submitted_payload is distinct from old.evidence_submitted_payload then
    raise exception 'evidence_submitted_payload is immutable after submission';
  end if;
  if old.evidence_submitted_signature is not null
     and new.evidence_submitted_signature is distinct from old.evidence_submitted_signature then
    raise exception 'evidence_submitted_signature is immutable after submission';
  end if;
  if old.evidence_submitted_payload_sha256 is not null
     and new.evidence_submitted_payload_sha256 is distinct from old.evidence_submitted_payload_sha256 then
    raise exception 'evidence_submitted_payload_sha256 is immutable after submission';
  end if;
  if old.evidence_submitted_signed_at is not null
     and new.evidence_submitted_signed_at is distinct from old.evidence_submitted_signed_at then
    raise exception 'evidence_submitted_signed_at is immutable after submission';
  end if;
  if old.signing_key_version is not null
     and new.signing_key_version is distinct from old.signing_key_version then
    raise exception 'signing_key_version is immutable after submission';
  end if;
  return new;
end;
$$ language plpgsql set search_path = '';

create or replace function public.guard_single_submission()
returns trigger as $$
begin
  if old.submitted_at is not null and new.submitted_at is not null
     and new.submitted_at != old.submitted_at then
    raise exception 'dispute has already been submitted';
  end if;
  return new;
end;
$$ language plpgsql set search_path = '';

create or replace function public.guard_submission_attempt_immutability()
returns trigger as $$
begin
  if old.status in ('succeeded', 'failed') and new.status != old.status then
    raise exception 'submission_attempt is immutable in status=%', old.status;
  end if;
  if old.status = 'unknown' and new.status in ('succeeded', 'failed') then
    if new.reconciled_at is null then
      raise exception 'transition unknown -> % requires reconciled_at to be set', new.status;
    end if;
  end if;
  if old.evidence_payload is distinct from new.evidence_payload then
    raise exception 'submission_attempt.evidence_payload is frozen at attempt start';
  end if;
  if old.idempotency_key is distinct from new.idempotency_key then
    raise exception 'submission_attempt.idempotency_key is frozen';
  end if;
  return new;
end;
$$ language plpgsql set search_path = '';

create or replace function public.guard_dispute_events_append_only()
returns trigger as $$
begin
  raise exception 'dispute_events and audit_log are append-only';
end;
$$ language plpgsql set search_path = '';

create or replace function public.guard_last_owner()
returns trigger as $$
declare
  remaining_owners integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into remaining_owners
      from public.merchant_users
      where merchant_id = old.merchant_id
        and role = 'owner'
        and status = 'active'
        and id != old.id;
      if remaining_owners = 0 then
        raise exception 'cannot remove last owner of merchant %', old.merchant_id;
      end if;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role != 'owner' then
      select count(*) into remaining_owners
      from public.merchant_users
      where merchant_id = old.merchant_id
        and role = 'owner'
        and status = 'active'
        and id != old.id;
      if remaining_owners = 0 then
        raise exception 'cannot demote last owner of merchant %', old.merchant_id;
      end if;
    end if;
    return new;
  end if;

  raise exception 'unsupported trigger operation %', tg_op;
end;
$$ language plpgsql set search_path = '';

create or replace function public.emit_pii_redacted_event()
returns trigger as $$
begin
  if old.redacted_at is null and new.redacted_at is not null then
    insert into public.dispute_events (merchant_id, dispute_id, event_type, actor_kind, payload)
    select
      d.merchant_id,
      d.id,
      'pii_redacted',
      'admin',
      jsonb_build_object(
        'schema_version', 'v1',
        'pii_id', new.id,
        'reason', new.redaction_reason
      )
    from public.disputes d
    where d.pii_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql set search_path = '';

-- 2. Add missing FK indexes surfaced by the performance advisor.
create index if not exists idx_merchant_users_invited_by
  on public.merchant_users(invited_by)
  where invited_by is not null;

create index if not exists idx_disputes_processor_connection_id
  on public.disputes(processor_connection_id)
  where processor_connection_id is not null;

create index if not exists idx_disputes_evidence_approved_by
  on public.disputes(evidence_approved_by)
  where evidence_approved_by is not null;

create index if not exists idx_efw_alerts_processor_connection_id
  on public.efw_alerts(processor_connection_id)
  where processor_connection_id is not null;

create index if not exists idx_submission_attempts_signed_off_by_user_id
  on public.submission_attempts(signed_off_by_user_id);

-- 3. Make user-facing RLS policies authenticated-only and avoid FOR ALL
-- policies overlapping SELECT policies.
drop policy if exists "merchants_select_member" on public.merchants;
drop policy if exists "merchants_insert_authed" on public.merchants;
drop policy if exists "merchants_update_admin" on public.merchants;
drop policy if exists "merchants_delete_owner" on public.merchants;

create policy "merchants_select_member"
  on public.merchants for select to authenticated
  using (id in (select app_private.merchant_ids_for_user()));

create policy "merchants_insert_authed"
  on public.merchants for insert to authenticated
  with check ((select auth.uid()) is not null);

create policy "merchants_update_admin"
  on public.merchants for update to authenticated
  using (app_private.user_has_merchant_role(id, 'admin'))
  with check (app_private.user_has_merchant_role(id, 'admin'));

create policy "merchants_delete_owner"
  on public.merchants for delete to authenticated
  using (app_private.user_has_merchant_role(id, 'owner'));

drop policy if exists "merchant_users_select" on public.merchant_users;
drop policy if exists "merchant_users_invite" on public.merchant_users;
drop policy if exists "merchant_users_update" on public.merchant_users;
drop policy if exists "merchant_users_delete" on public.merchant_users;

create policy "merchant_users_select"
  on public.merchant_users for select to authenticated
  using (
    user_id = (select auth.uid())
    or merchant_id in (select app_private.merchant_ids_for_user())
  );

create policy "merchant_users_invite"
  on public.merchant_users for insert to authenticated
  with check (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  );

create policy "merchant_users_update"
  on public.merchant_users for update to authenticated
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
  on public.merchant_users for delete to authenticated
  using (
    app_private.user_has_merchant_role(merchant_id, 'owner')
    or (
      app_private.user_has_merchant_role(merchant_id, 'admin')
      and role in ('member', 'viewer')
    )
  );

drop policy if exists "processor_connections_select" on public.processor_connections;
drop policy if exists "processor_connections_write" on public.processor_connections;

create policy "processor_connections_select"
  on public.processor_connections for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "processor_connections_insert"
  on public.processor_connections for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "processor_connections_update"
  on public.processor_connections for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "processor_connections_delete"
  on public.processor_connections for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "merchant_profiles_select" on public.merchant_profiles;
drop policy if exists "merchant_profiles_write" on public.merchant_profiles;

create policy "merchant_profiles_select"
  on public.merchant_profiles for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "merchant_profiles_insert"
  on public.merchant_profiles for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "merchant_profiles_update"
  on public.merchant_profiles for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "merchant_profiles_delete"
  on public.merchant_profiles for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "vamp_snapshots_select" on public.vamp_snapshots;
create policy "vamp_snapshots_select"
  on public.vamp_snapshots for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

drop policy if exists "disputes_select" on public.disputes;
drop policy if exists "disputes_write" on public.disputes;

create policy "disputes_select"
  on public.disputes for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "disputes_insert"
  on public.disputes for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "disputes_update"
  on public.disputes for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "disputes_delete"
  on public.disputes for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "dispute_pii_select" on public.dispute_pii;
drop policy if exists "dispute_pii_write" on public.dispute_pii;

create policy "dispute_pii_select"
  on public.dispute_pii for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "dispute_pii_insert"
  on public.dispute_pii for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "dispute_pii_update"
  on public.dispute_pii for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "dispute_pii_delete"
  on public.dispute_pii for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "dispute_events_select" on public.dispute_events;
create policy "dispute_events_select"
  on public.dispute_events for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

drop policy if exists "efw_alerts_select" on public.efw_alerts;
drop policy if exists "efw_alerts_write" on public.efw_alerts;

create policy "efw_alerts_select"
  on public.efw_alerts for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "efw_alerts_insert"
  on public.efw_alerts for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "efw_alerts_update"
  on public.efw_alerts for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "efw_alerts_delete"
  on public.efw_alerts for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "submission_attempts_select" on public.submission_attempts;
create policy "submission_attempts_select"
  on public.submission_attempts for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

drop policy if exists "evidence_files_select" on public.evidence_files;
drop policy if exists "evidence_files_write" on public.evidence_files;

create policy "evidence_files_select"
  on public.evidence_files for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "evidence_files_insert"
  on public.evidence_files for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "evidence_files_update"
  on public.evidence_files for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'member'))
  with check (app_private.user_has_merchant_role(merchant_id, 'member'));

create policy "evidence_files_delete"
  on public.evidence_files for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "slack_connections_select" on public.slack_connections;
drop policy if exists "slack_connections_write" on public.slack_connections;

create policy "slack_connections_select"
  on public.slack_connections for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "slack_connections_insert"
  on public.slack_connections for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "slack_connections_update"
  on public.slack_connections for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "slack_connections_delete"
  on public.slack_connections for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "gmail_connections_select" on public.gmail_connections;
drop policy if exists "gmail_connections_write" on public.gmail_connections;

create policy "gmail_connections_select"
  on public.gmail_connections for select to authenticated
  using (merchant_id in (select app_private.merchant_ids_for_user()));

create policy "gmail_connections_insert"
  on public.gmail_connections for insert to authenticated
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "gmail_connections_update"
  on public.gmail_connections for update to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'))
  with check (app_private.user_has_merchant_role(merchant_id, 'admin'));

create policy "gmail_connections_delete"
  on public.gmail_connections for delete to authenticated
  using (app_private.user_has_merchant_role(merchant_id, 'admin'));

drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select"
  on public.audit_log for select to authenticated
  using (
    (merchant_id is not null and merchant_id in (select app_private.merchant_ids_for_user()))
    or user_id = (select auth.uid())
  );

-- Webhook events are internal. Authenticated users should not query raw webhook payloads.
create policy "webhook_events_service_role_all"
  on public.webhook_events for all to service_role
  using (true)
  with check (true);
