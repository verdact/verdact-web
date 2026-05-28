create table vamp_snapshots (
  id                              uuid primary key default gen_random_uuid(),
  merchant_id                     uuid not null references merchants(id) on delete cascade,
  calculation_window_start        timestamptz not null,
  calculation_window_end          timestamptz not null,
  visa_settled_transaction_count  integer not null default 0,
  visa_dispute_count              integer not null default 0,
  visa_efw_count                  integer not null default 0,
  excluded_pre_dispute_count      integer not null default 0,
  excluded_ce3_qualified_count    integer not null default 0,
  double_count_removed            integer not null default 0,
  estimated_vamp_ratio            numeric(10, 6),
  confidence_level                text check (
                                    confidence_level in ('low', 'medium', 'high')
                                  ),
  raw_components                  jsonb,
  calculated_at                   timestamptz not null default now()
);
