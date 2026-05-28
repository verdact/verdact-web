alter table evidence_files
  add column source_kind text check (source_kind in ('gmail', 'slack', 'upload')),
  add column gmail_connection_id uuid references gmail_connections(id) on delete set null,
  add column slack_connection_id uuid references slack_connections(id) on delete set null,
  add column source_message_id text,
  add column source_thread_id text,
  add constraint evidence_files_source_consistency check (
    source_kind is null
    or (
      source_kind = 'gmail'
      and gmail_connection_id is not null
      and slack_connection_id is null
    )
    or (
      source_kind = 'slack'
      and slack_connection_id is not null
      and gmail_connection_id is null
    )
    or (
      source_kind = 'upload'
      and gmail_connection_id is null
      and slack_connection_id is null
    )
  );

create index idx_evidence_files_gmail_connection on evidence_files(gmail_connection_id);
create index idx_evidence_files_slack_connection on evidence_files(slack_connection_id);
