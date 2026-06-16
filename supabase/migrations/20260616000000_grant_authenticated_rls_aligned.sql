-- Align table GRANTs with existing RLS policies for the `authenticated` role.
--
-- Recurring bug class (already hit on slack_connections + dispute_pii): a table
-- has a correct merchant-scoped RLS policy for an operation, but the
-- `authenticated` role was never GRANTed that table privilege. PostgREST checks
-- BOTH the grant and the policy, so the policy is unreachable and the op returns
-- 403 (permission denied) -> supabase-js {data:null,error} -> a silent 404 /
-- masked failure. A full grant-matrix-vs-policy sweep found the remaining gaps
-- below. Each grant is safe: the existing RLS policy still scopes every row to
-- the caller's own merchant (and to the role the policy requires).
--
-- Reads (pure SELECT, scoped by the existing *_select policies):
grant select on public.submission_attempts to authenticated;
grant select on public.audit_log to authenticated;

-- Writes for owner/admin/member-gated features that are built or imminent. The
-- existing write policies (merchant_users_invite/update/delete = owner/admin;
-- efw_alerts_write = member; merchants_delete_owner = owner;
-- processor_connections_write = admin) remain the enforcement layer.
grant insert, update, delete on public.merchant_users to authenticated;
grant insert, update, delete on public.efw_alerts to authenticated;
grant delete on public.merchants to authenticated;
grant delete on public.processor_connections to authenticated;

-- Intentionally NOT granted: disputes INSERT/DELETE to authenticated. Disputes
-- must originate from Stripe via the service-role webhook (data integrity); a
-- merchant must not be able to fabricate or hard-delete dispute rows. UPDATE
-- (evidence-draft edits) is already granted and is the only authenticated write
-- disputes needs. submission_attempts WRITE is also withheld until a write RLS
-- policy is designed (today it has only a SELECT policy).
