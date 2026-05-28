create table dispute_pii (
  id                  uuid primary key default gen_random_uuid(),
  merchant_id         uuid not null references merchants(id) on delete cascade,
  customer_name       text,
  customer_email      text,
  customer_phone      text,
  customer_ip_address text,
  billing_address     jsonb,                          -- {schema_version, line1, line2, city, ...}
  shipping_address    jsonb,                          -- digital merchants typically null
  customer_signature  text,
  redacted_at         timestamptz,                    -- non-null when customer requested erasure
  redaction_reason    text,                           -- 'customer_request' / 'data_retention_policy' / 'admin'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
