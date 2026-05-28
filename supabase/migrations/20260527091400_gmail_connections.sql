create table gmail_connections (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references merchants(id) on delete cascade,
  google_user_id   text not null,
  email_address    text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_key_version text not null default 'v1',
  token_expiry     timestamptz,
  connected_at     timestamptz not null default now(),
  status           text not null default 'connected' check (
                     status in ('connected', 'revoked')
                   ),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint gmail_connections_merchant_google_key unique (merchant_id, google_user_id)
);

comment on column gmail_connections.access_token_encrypted is 'AES-256-GCM encrypted token envelope produced by the application layer.';
comment on column gmail_connections.refresh_token_encrypted is 'AES-256-GCM encrypted token envelope produced by the application layer.';
comment on column gmail_connections.token_key_version is 'Application encryption key version used for OAuth token envelopes.';
