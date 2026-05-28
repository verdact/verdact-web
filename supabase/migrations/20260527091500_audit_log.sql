create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid references merchants(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  action        text not null,
  resource      text,
  metadata      jsonb,
  request_ip    text,
  request_user_agent text,
  created_at    timestamptz not null default now()
);
