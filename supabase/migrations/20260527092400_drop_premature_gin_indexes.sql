-- Migration: 20260527092400_drop_premature_gin_indexes.sql
-- Description: Remove GIN indexes added prematurely on JSONB columns.
-- Rationale: These impose a write penalty on every INSERT/UPDATE to
-- high-write tables like `disputes` (evidence_draft is updated frequently
-- during the drafting workflow). The database has zero rows and zero
-- established query patterns. Re-add targeted indexes later when real
-- slow-query logs justify them.

drop index if exists public.idx_disputes_evidence_draft_gin;
drop index if exists public.idx_submission_attempts_evidence_payload_gin;
drop index if exists public.idx_processor_connections_metadata_gin;
drop index if exists public.idx_audit_log_metadata_gin;
