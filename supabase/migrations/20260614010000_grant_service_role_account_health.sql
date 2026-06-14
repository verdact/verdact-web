-- The account-health writer (Inngest job, lib/inngest/functions/account-health-recompute.ts)
-- runs as service_role and was failing every run with "permission denied for table
-- vamp_snapshots". service_role bypasses RLS but still needs table privileges, which were
-- never granted. Grant exactly what the recompute + daily fan-out + the authenticated UI
-- read path require. (Applied to verdact-dev 2026-06-14 via MCP; file kept for repo parity.)

grant select, insert, update on public.vamp_snapshots to service_role;
grant select on public.processor_connections to service_role;
grant select on public.disputes to service_role;
grant select on public.efw_alerts to service_role;

-- The account-health gauge reads vamp_snapshots via the authenticated client; its RLS
-- SELECT policy needs a matching table grant to actually return rows.
grant select on public.vamp_snapshots to authenticated;
