create table merchant_users (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references merchants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'owner' check (
                  role in ('owner', 'admin', 'member', 'viewer')
                ),
  invited_by    uuid references auth.users(id) on delete set null,
  invited_at    timestamptz,
  accepted_at   timestamptz,
  status        text not null default 'active' check (
                  status in ('invited', 'active', 'revoked')
                ),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint merchant_users_merchant_user_key unique (merchant_id, user_id)
);
