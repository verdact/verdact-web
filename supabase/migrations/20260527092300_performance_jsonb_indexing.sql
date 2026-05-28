-- Migration: 20260527092300_performance_jsonb_indexing.sql
-- Description: Add GIN indexes to key JSONB columns to optimize subkey queries.

-- Index for searching arbitrary evidence items, status flags, and fields inside evidence drafts.
create index if not exists idx_disputes_evidence_draft_gin
  on public.disputes using gin (evidence_draft);

-- Index for searching structured payloads, customer details, or errors in submission attempts.
create index if not exists idx_submission_attempts_evidence_payload_gin
  on public.submission_attempts using gin (evidence_payload);

-- Index for searching custom settings or metadata on processor connections.
create index if not exists idx_processor_connections_metadata_gin
  on public.processor_connections using gin (metadata);

-- Index for searching audit log details or context metadata.
create index if not exists idx_audit_log_metadata_gin
  on public.audit_log using gin (metadata);
