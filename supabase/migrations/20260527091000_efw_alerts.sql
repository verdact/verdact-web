create table efw_alerts (
  id                    uuid primary key default gen_random_uuid(),
  merchant_id           uuid not null references merchants(id) on delete cascade,
  processor_connection_id uuid references processor_connections(id) on delete set null,
  processor             processor_kind not null,
  processor_account_id  text,
  processor_alert_id    text not null,
  processor_charge_id   text,
  network_guess         text check (
                          network_guess in ('visa', 'mastercard', 'amex', 'discover', 'unknown')
                        ),
  fraud_type            text,
  actionable            boolean default true,
  merchant_decision     text not null default 'pending' check (
                          merchant_decision in ('refund', 'fight', 'pending')
                        ),
  linked_dispute_id     uuid references disputes(id) on delete set null,
  vamp_ratio_at_alert   numeric(10, 6),
  decision_outcome      text check (
                          decision_outcome in (
                            'refunded', 'dispute_won', 'dispute_lost', 'no_action'
                          )
                        ),
  refunded_at           timestamptz,
  created_at            timestamptz not null default now(),

  constraint efw_alerts_processor_alert_id_key unique (processor, processor_alert_id)
);
