alter table disputes
  add column evidence_approved_at timestamptz,
  add column evidence_approved_by uuid references auth.users(id) on delete restrict;

alter table disputes
  add constraint disputes_submission_requires_approval check (
    submitted_at is null
    or (
      evidence_approved_at is not null
      and evidence_approved_by is not null
      and sign_off_at is not null
    )
  );

alter table dispute_events
  drop constraint dispute_events_event_type_check,
  add constraint dispute_events_event_type_check check (
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
      'note_added',
      'evidence_approved'
    )
  );
