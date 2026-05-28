-- PostgREST requires table privileges in addition to RLS policies.
-- RLS remains the row-level enforcement layer; these narrow grants only allow
-- Stage 1A/1B authenticated app code to reach the existing policies.

grant select on public.merchants to authenticated;
grant select on public.merchant_users to authenticated;

grant select, insert, update
  on public.processor_connections
  to authenticated;
