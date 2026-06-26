-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL FIX — require_schema_version_on_jsonb_columns() rejected NULL JSONB.
--
-- `to_jsonb(new) -> col` for a SQL NULL jsonb column returns the JSON value
-- `null` (jsonb 'null'), which is NOT SQL NULL. The original guard
--   if val is not null and not (val ? 'schema_version')
-- therefore treated a null column as "present but missing schema_version" and
-- raised — rejecting ANY insert/update that left a tracked JSONB column null.
--
-- Effect (latent, never hit because no real dispute ever flowed — the test
-- connected account was never chargeable): the webhook + backfill `disputes`
-- upsert (no evidence_draft / ce3_check_payload / evidence_submitted_payload /
-- processor_submission_response) and the `dispute_pii` enrichment (no
-- shipping_address) would BOTH fail on the first genuine dispute, silently
-- breaking ingestion. Surfaced 2026-06-26 by a dispute_pii insert tripping on a
-- null shipping_address.
--
-- Fix: skip the check when the extracted value is JSON null (jsonb_typeof =
-- 'null'); only a populated JSONB object/array must carry schema_version. This
-- only LOOSENS the constraint (existing rows are not re-validated) and is safe.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function require_schema_version_on_jsonb_columns()
returns trigger as $$
declare
  cols text[];
  col text;
  val jsonb;
begin
  cols := case tg_table_name
    when 'processor_connections' then array['metadata']
    when 'webhook_events'        then array['payload']
    when 'disputes'              then array['evidence_draft', 'evidence_submitted_payload', 'ce3_check_payload', 'processor_submission_response']
    when 'submission_attempts'   then array['evidence_payload', 'merchant_profile_snapshot', 'processor_file_ids', 'processor_response', 'processor_error']
    when 'dispute_pii'           then array['billing_address', 'shipping_address']
    when 'dispute_events'        then array['payload']
    when 'audit_log'             then array['metadata']
    when 'vamp_snapshots'        then array['raw_components']
    else array[]::text[]
  end;

  foreach col in array cols loop
    val := to_jsonb(new) -> col;
    -- Treat SQL NULL and JSON null alike: a null column (jsonb 'null') is fine;
    -- only a populated JSONB value must carry a top-level "schema_version".
    if val is not null and jsonb_typeof(val) <> 'null' and not (val ? 'schema_version') then
      raise exception 'Column %.% requires top-level "schema_version" key in JSONB payload', tg_table_name, col;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql;
