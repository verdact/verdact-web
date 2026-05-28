create table submission_attempts (
  id                          uuid primary key default gen_random_uuid(),
  merchant_id                 uuid not null references merchants(id) on delete cascade,
  dispute_id                  uuid not null references disputes(id) on delete cascade,
  processor                   processor_kind not null,
  processor_api_version       text,
  idempotency_key             text not null,
  attempt_number              integer not null default 1,
  status                      text not null default 'in_progress' check (
                                status in ('in_progress', 'succeeded', 'failed', 'unknown')
                              ),
  evidence_payload            jsonb not null,
  evidence_payload_sha256     text,
  merchant_profile_snapshot   jsonb not null,
  processor_file_ids          jsonb,
  processor_request_id        text,
  processor_response          jsonb,
  processor_error             jsonb,
  http_status                 integer,
  sign_off_text_version       text not null,
  sign_off_at                 timestamptz not null,
  signed_off_by_user_id       uuid not null references auth.users(id) on delete restrict,
  submission_ip               text not null,
  submission_user_agent       text,
  started_at                  timestamptz not null default now(),
  finished_at                 timestamptz,
  reconciled_at               timestamptz,
  created_at                  timestamptz not null default now(),

  constraint submission_attempts_idempotency_key_key unique (idempotency_key),
  constraint submission_attempts_dispute_attempt_key unique (dispute_id, attempt_number)
);
