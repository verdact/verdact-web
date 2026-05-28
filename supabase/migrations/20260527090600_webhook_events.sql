create table webhook_events (
  id                    uuid primary key default gen_random_uuid(),
  processor             processor_kind not null,
  processor_event_id    text not null,                  -- evt_xxx for stripe; equivalent for others
  processor_account_id  text,                           -- acct_xxx for stripe
  processor_api_version text,                           -- e.g. '2024-06-20' for stripe
  merchant_id           uuid references merchants(id) on delete set null,
  event_type            text not null,
  payload               jsonb not null,                  -- must include "schema_version"
  processing_status     text not null default 'received' check (
                          processing_status in (
                            'received', 'processing', 'processed', 'failed', 'unresolved'
                          )
                        ),
  processing_error      text,
  retry_count           integer not null default 0,
  processed_at          timestamptz,
  created_at            timestamptz not null default now(),

  -- Event IDs are unique per-processor, not globally
  constraint webhook_events_processor_event_id_key unique (processor, processor_event_id)
);
