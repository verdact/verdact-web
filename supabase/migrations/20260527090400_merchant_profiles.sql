create table merchant_profiles (
  id                                  uuid primary key default gen_random_uuid(),
  merchant_id                         uuid not null references merchants(id) on delete cascade,
  product_description                 text,
  delivery_method                     text check (
                                        delivery_method in ('app', 'email', 'download', 'combination')
                                      ),
  customer_type                       text check (
                                        customer_type in ('b2b', 'b2c', 'both')
                                      ),
  refund_policy_text                  text,
  refund_policy_url                   text,
  refund_policy_supabase_path         text,           -- canonical copy; Stripe file uploaded fresh per submission
  cancellation_policy_text            text,
  cancellation_policy_url             text,
  cancellation_policy_supabase_path   text,           -- canonical copy; Stripe file uploaded fresh per submission
  tos_url                             text,
  policy_disclosure_location          text check (
                                        policy_disclosure_location in (
                                          'checkout', 'email', 'in_app', 'all'
                                        )
                                      ),
  transaction_description_template    text,
  logs_user_activity                  text check (
                                        logs_user_activity in ('yes', 'no', 'sometimes')
                                      ),
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),

  constraint merchant_profiles_merchant_id_key unique (merchant_id)
);
