-- processor_connections
create index idx_processor_connections_merchant_id on processor_connections(merchant_id);
create index idx_processor_connections_account on processor_connections(processor, processor_account_id);

-- merchant_users (access path: user → all merchants they belong to)
create index idx_merchant_users_user_id on merchant_users(user_id);
create index idx_merchant_users_merchant_id on merchant_users(merchant_id);
create index idx_merchant_users_status on merchant_users(status);

-- merchant_profiles
create index idx_merchant_profiles_merchant_id on merchant_profiles(merchant_id);

-- vamp_snapshots
create index idx_vamp_snapshots_merchant_id on vamp_snapshots(merchant_id);
create index idx_vamp_snapshots_calculated_at on vamp_snapshots(calculated_at desc);

-- Cap snapshots to one per merchant per UTC day.
create unique index idx_vamp_snapshots_merchant_day
  on vamp_snapshots(merchant_id, ((calculated_at AT TIME ZONE 'UTC')::date));

-- webhook_events
create index idx_webhook_events_processor_event on webhook_events(processor, processor_event_id);
create index idx_webhook_events_processor_account on webhook_events(processor, processor_account_id);
create index idx_webhook_events_processing_status on webhook_events(processing_status);
create index idx_webhook_events_merchant_id on webhook_events(merchant_id);
create index idx_webhook_events_created_at on webhook_events(created_at desc);

-- disputes
create index idx_disputes_merchant_id on disputes(merchant_id);
create index idx_disputes_processor_dispute on disputes(processor, processor_dispute_id);
create index idx_disputes_processor_charge on disputes(processor, processor_charge_id);
create index idx_disputes_status on disputes(status);
create index idx_disputes_due_by on disputes(due_by asc nulls last);
create index idx_disputes_submitted_at on disputes(submitted_at);
create index idx_disputes_pii_id on disputes(pii_id);

-- dispute_pii
create index idx_dispute_pii_merchant_id on dispute_pii(merchant_id);
create index idx_dispute_pii_redacted_at on dispute_pii(redacted_at) where redacted_at is not null;

-- dispute_events (heavy read pattern: dispute timeline, audit queries by actor)
create index idx_dispute_events_dispute_id on dispute_events(dispute_id, occurred_at);
create index idx_dispute_events_merchant_id on dispute_events(merchant_id, occurred_at desc);
create index idx_dispute_events_event_type on dispute_events(event_type);
create index idx_dispute_events_actor on dispute_events(actor_user_id) where actor_user_id is not null;

-- efw_alerts
create index idx_efw_alerts_merchant_id on efw_alerts(merchant_id);
create index idx_efw_alerts_processor_alert on efw_alerts(processor, processor_alert_id);
create index idx_efw_alerts_linked_dispute_id on efw_alerts(linked_dispute_id);
create index idx_efw_alerts_merchant_decision on efw_alerts(merchant_decision);

-- submission_attempts
create index idx_submission_attempts_merchant_id on submission_attempts(merchant_id);
create index idx_submission_attempts_dispute_id on submission_attempts(dispute_id);
create index idx_submission_attempts_status on submission_attempts(status);
create index idx_submission_attempts_idempotency_key on submission_attempts(idempotency_key);
-- Reconciler scans this index every 15 minutes
create index idx_submission_attempts_unknown_stuck
  on submission_attempts(status, finished_at)
  where status = 'unknown';

-- evidence_files
create index idx_evidence_files_merchant_id on evidence_files(merchant_id);
create index idx_evidence_files_dispute_id on evidence_files(dispute_id);
create index idx_evidence_files_upload_status on evidence_files(upload_status);
create index idx_evidence_files_content_sha256 on evidence_files(content_sha256);

-- slack_connections
create index idx_slack_connections_merchant_id on slack_connections(merchant_id);

-- gmail_connections
create index idx_gmail_connections_merchant_id on gmail_connections(merchant_id);

-- audit_log
create index idx_audit_log_merchant_id on audit_log(merchant_id, created_at desc);
create index idx_audit_log_user_id on audit_log(user_id) where user_id is not null;
create index idx_audit_log_action on audit_log(action);
