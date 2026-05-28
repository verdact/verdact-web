create table dispute_events (
  id                  uuid primary key default gen_random_uuid(),
  merchant_id         uuid not null references merchants(id) on delete cascade,
  dispute_id          uuid not null references disputes(id) on delete cascade,
  event_type          text not null check (
                        event_type in (
                          'created',
                          'status_changed',
                          'pii_attached',
                          'pii_redacted',
                          'draft_started',
                          'draft_updated',
                          'ce3_evaluated',
                          'submission_attempted',
                          'submission_succeeded',
                          'submission_failed',
                          'submission_unknown',
                          'submission_reconciled',
                          'outcome_recorded',
                          'file_attached',
                          'file_removed',
                          'note_added'
                        )
                      ),
  from_status         text,
  to_status           text,
  actor_kind          text not null check (
                        actor_kind in ('user', 'system', 'webhook', 'reconciler', 'admin')
                      ),
  actor_user_id       uuid references auth.users(id) on delete set null,
  payload             jsonb,
  occurred_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
