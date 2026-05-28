create table slack_connections (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references merchants(id) on delete cascade,
  slack_team_id   text not null,
  slack_team_name text,
  access_token_encrypted text not null,
  token_key_version text not null default 'v1',
  token_scope     text,
  connected_at    timestamptz not null default now(),
  status          text not null default 'connected' check (
                    status in ('connected', 'revoked')
                  ),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint slack_connections_merchant_team_key unique (merchant_id, slack_team_id)
);

comment on column slack_connections.access_token_encrypted is 'AES-256-GCM encrypted token envelope produced by the application layer.';
comment on column slack_connections.token_key_version is 'Application encryption key version used for OAuth token envelopes.';
