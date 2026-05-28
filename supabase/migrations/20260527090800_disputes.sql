create table disputes (
  id                                  uuid primary key default gen_random_uuid(),
  merchant_id                         uuid not null references merchants(id) on delete cascade,
  processor_connection_id             uuid references processor_connections(id) on delete set null,
  processor                           processor_kind not null,
  processor_account_id                text,
  processor_dispute_id                text not null,
  processor_charge_id                 text,
  pii_id                              uuid references dispute_pii(id) on delete set null,
  amount                              integer,                        -- cents
  currency                            text,
  reason                              text,
  network                             text check (
                                        network in ('visa', 'mastercard', 'amex', 'discover', 'unknown')
                                      ),
  status                              text not null default 'needs_response' check (
                                        status in (
                                          'needs_response', 'under_review', 'won', 'lost',
                                          'warning_closed', 'submitted'
                                        )
                                      ),
  due_by                              timestamptz,
  ce3_eligible                        boolean default false,
  ce3_check_payload                   jsonb,                          -- inputs used to compute ce3_eligible; must include "schema_version"
  ce3_checked_at                      timestamptz,
  evidence_draft                      jsonb,                          -- mutable until sign-off; must include "schema_version"
  evidence_submitted_payload          jsonb,                          -- immutable after submission; must include "schema_version"
  evidence_submitted_payload_sha256   text,                           -- SHA-256 of canonical JSON of evidence_submitted_payload
  evidence_submitted_signature        text,                           -- HMAC-SHA256(server_signing_key, canonical_json_payload)
  signing_key_version                 text,                           -- which signing key version produced the signature
  evidence_submitted_signed_at        timestamptz,                    -- when the signature was computed
  processor_submission_response       jsonb,                          -- last successful processor response; full attempt history in submission_attempts
  sign_off_at                         timestamptz,
  sign_off_text_version               text,
  submission_ip                       text,
  submitted_at                        timestamptz,                    -- set only after a submission_attempt succeeds
  outcome                             text check (
                                        outcome in ('won', 'lost', 'warning_closed')
                                      ),
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),

  -- Dispute IDs are unique per-processor
  constraint disputes_processor_dispute_id_key unique (processor, processor_dispute_id)
);
