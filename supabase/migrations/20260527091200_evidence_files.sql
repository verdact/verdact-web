create table evidence_files (
  id                    uuid primary key default gen_random_uuid(),
  merchant_id           uuid not null references merchants(id) on delete cascade,
  dispute_id            uuid references disputes(id) on delete cascade,
  purpose               text not null check (
                          purpose in (
                            'refund_policy',
                            'cancellation_policy',
                            'communication',
                            'service_documentation',
                            'uncategorized'
                          )
                        ),
  supabase_path         text,
  content_sha256        text,
  content_size_bytes    bigint,
  mime_type             text,
  page_count            integer,
  processor             processor_kind,
  processor_file_id     text,
  processor_uploaded_at timestamptz,
  upload_status         text not null default 'pending' check (
                          upload_status in ('pending', 'uploaded_local', 'uploaded_to_processor', 'failed')
                        ),
  created_at            timestamptz not null default now()
);
