create table processor_connections (
  id                          uuid primary key default gen_random_uuid(),
  merchant_id                 uuid not null references merchants(id) on delete cascade,
  processor                   processor_kind not null,
  processor_account_id        text not null,
  connection_status           text not null check (
                                connection_status in ('connected', 'disconnected', 'error')
                              ),
  livemode                    boolean not null default false,
  processor_api_version       text,
  connected_at                timestamptz,
  disconnected_at             timestamptz,
  last_event_seen_at          timestamptz,
  metadata                    jsonb not null default '{"schema_version":"v1"}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint processor_connections_processor_account_key unique (processor, processor_account_id)
);
