-- 1. auto-update updated_at on all relevant tables
create trigger merchants_updated_at
  before update on merchants
  for each row execute function update_updated_at_column();

create trigger merchant_users_updated_at
  before update on merchant_users
  for each row execute function update_updated_at_column();

create trigger processor_connections_updated_at
  before update on processor_connections
  for each row execute function update_updated_at_column();

create trigger merchant_profiles_updated_at
  before update on merchant_profiles
  for each row execute function update_updated_at_column();

create trigger disputes_updated_at
  before update on disputes
  for each row execute function update_updated_at_column();

create trigger dispute_pii_updated_at
  before update on dispute_pii
  for each row execute function update_updated_at_column();

create trigger slack_connections_updated_at
  before update on slack_connections
  for each row execute function update_updated_at_column();

create trigger gmail_connections_updated_at
  before update on gmail_connections
  for each row execute function update_updated_at_column();


-- 2. JSONB schema_version enforcement
create or replace function require_schema_version_on_jsonb_columns()
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
$$ language plpgsql;

create trigger webhook_events_schema_version
  before insert or update on webhook_events
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger processor_connections_schema_version
  before insert or update on processor_connections
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger disputes_schema_version
  before insert or update on disputes
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger submission_attempts_schema_version
  before insert or update on submission_attempts
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger dispute_pii_schema_version
  before insert or update on dispute_pii
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger dispute_events_schema_version
  before insert or update on dispute_events
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger audit_log_schema_version
  before insert or update on audit_log
  for each row execute function require_schema_version_on_jsonb_columns();

create trigger vamp_snapshots_schema_version
  before insert or update on vamp_snapshots
  for each row execute function require_schema_version_on_jsonb_columns();


-- 3. Immutable submitted payload + signature guard
create or replace function guard_submitted_payload()
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
$$ language plpgsql;

create trigger disputes_guard_submitted_payload
  before update on disputes
  for each row execute function guard_submitted_payload();


-- 4. One-submission guard
create or replace function guard_single_submission()
returns trigger as $$
begin
  if old.submitted_at is not null and new.submitted_at is not null
     and new.submitted_at != old.submitted_at then
    raise exception 'dispute has already been submitted';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger disputes_guard_single_submission
  before update on disputes
  for each row execute function guard_single_submission();


-- 5. submission_attempts immutability
create or replace function guard_submission_attempt_immutability()
returns trigger as $$
begin
  if old.status in ('succeeded', 'failed') and new.status != old.status then
    raise exception 'submission_attempt is immutable in status=%', old.status;
  end if;
  if old.status = 'unknown' and new.status in ('succeeded', 'failed') then
    if new.reconciled_at is null then
      raise exception 'transition unknown → % requires reconciled_at to be set', new.status;
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
$$ language plpgsql;

create trigger submission_attempts_guard_immutability
  before update on submission_attempts
  for each row execute function guard_submission_attempt_immutability();


-- 6. dispute_events and audit_log append-only enforcement
create or replace function guard_dispute_events_append_only()
returns trigger as $$
begin
  raise exception 'dispute_events and audit_log are append-only';
end;
$$ language plpgsql;

create trigger dispute_events_no_update
  before update on dispute_events
  for each row execute function guard_dispute_events_append_only();

create trigger dispute_events_no_delete
  before delete on dispute_events
  for each row execute function guard_dispute_events_append_only();

create trigger audit_log_no_update
  before update on audit_log
  for each row execute function guard_dispute_events_append_only();

create trigger audit_log_no_delete
  before delete on audit_log
  for each row execute function guard_dispute_events_append_only();


-- 7. Last-owner protection on merchant_users
create or replace function guard_last_owner()
returns trigger as $$
declare
  remaining_owners integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into remaining_owners
      from merchant_users
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
      from merchant_users
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
end;
$$ language plpgsql;

create trigger merchant_users_protect_last_owner
  before update or delete on merchant_users
  for each row execute function guard_last_owner();


-- 8. New merchant auto-bootstrap
create or replace function app_private.bootstrap_merchant()
returns trigger as $$
begin
  insert into public.merchant_profiles (merchant_id) values (new.id);

  if (select auth.uid()) is not null then
    insert into public.merchant_users (merchant_id, user_id, role, status, accepted_at)
    values (new.id, (select auth.uid()), 'owner', 'active', now());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function app_private.bootstrap_merchant() from public;

create trigger merchants_bootstrap
  after insert on merchants
  for each row execute function app_private.bootstrap_merchant();


-- 9. PII redaction-tracking trigger
create or replace function emit_pii_redacted_event()
returns trigger as $$
begin
  if old.redacted_at is null and new.redacted_at is not null then
    insert into dispute_events (merchant_id, dispute_id, event_type, actor_kind, payload)
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
    from disputes d
    where d.pii_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger dispute_pii_emit_redaction
  after update on dispute_pii
  for each row execute function emit_pii_redacted_event();
