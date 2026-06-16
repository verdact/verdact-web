-- Ensure service_role has necessary permissions for the Admin Portal queries.
-- service_role bypasses RLS but still needs explicit table grants if they were
-- previously revoked or missed during table creation.

grant all on public.platform_admission_policy to service_role;
grant all on public.waitlist_signups to service_role;
grant all on public.audit_leads to service_role;
grant all on public.merchants to service_role;
grant all on public.processor_connections to service_role;
grant all on public.disputes to service_role;
grant all on public.vamp_snapshots to service_role;
grant all on public.platform_admin_events to service_role;
grant all on public.platform_admins to service_role;
grant all on public.platform_invites to service_role;
