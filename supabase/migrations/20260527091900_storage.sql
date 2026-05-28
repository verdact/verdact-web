-- Create evidence-files bucket (suppress error if already exists in target environment)
insert into storage.buckets (id, name, public)
values ('evidence-files', 'evidence-files', false)
on conflict (id) do nothing;

-- Returns NULL instead of raising if a storage path does not start with a UUID.
create or replace function app_private.storage_object_merchant_id(object_name text)
returns uuid as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$ language sql immutable set search_path = '';

revoke all on function app_private.storage_object_merchant_id(text) from public;
grant execute on function app_private.storage_object_merchant_id(text) to authenticated, service_role;

-- RLS on storage objects — first path segment is the merchant_id (uuid string)
create policy "evidence_files_select_member"
  on storage.objects for select
  using (
    bucket_id = 'evidence-files'
    and app_private.storage_object_merchant_id(name) in (select app_private.merchant_ids_for_user())
  );

create policy "evidence_files_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'evidence-files'
    and app_private.user_has_merchant_role(app_private.storage_object_merchant_id(name), 'member')
  );

create policy "evidence_files_update_member"
  on storage.objects for update
  using (
    bucket_id = 'evidence-files'
    and app_private.user_has_merchant_role(app_private.storage_object_merchant_id(name), 'member')
  );

create policy "evidence_files_delete_member"
  on storage.objects for delete
  using (
    bucket_id = 'evidence-files'
    and app_private.user_has_merchant_role(app_private.storage_object_merchant_id(name), 'member')
  );
