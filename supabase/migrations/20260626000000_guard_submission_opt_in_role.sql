-- ─────────────────────────────────────────────────────────────────────────────
-- Defense-in-depth: gate merchant_profiles.submission_opt_in to owner/admin at
-- the DB layer, mirroring app/settings/actions.ts updateSubmissionOptInAction.
--
-- The merchant_profiles_update RLS policy (20260527092200) allows 'member', so
-- without this a member could PATCH submission_opt_in directly via the PostgREST
-- API and — once live filing opens (VERDACT_SUBMISSION_ENABLED) — authorize
-- Verdact to file on a workspace they do not own. The submit engine fail-closes
-- on submission_opt_in (lib/evidence/stripe-submit.ts), so this is the control
-- that must match the app-layer owner/admin check.
--
-- Scope: the trigger only acts when submission_opt_in actually CHANGES, so the
-- member-writable business/policy fields on merchant_profiles are unaffected, and
-- upserts that omit the column (updateBusinessAction / updatePoliciesAction) are
-- no-ops here. INSERT does not fire it (the bootstrap default is false).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app_private.guard_submission_opt_in_role()
returns trigger as $$
begin
  if new.submission_opt_in is distinct from old.submission_opt_in then
    if not app_private.user_has_merchant_role(new.merchant_id, 'admin') then
      raise exception 'Only an owner or admin may change submission_opt_in'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function app_private.guard_submission_opt_in_role() from public;

create trigger merchant_profiles_guard_submission_opt_in
  before update on public.merchant_profiles
  for each row execute function app_private.guard_submission_opt_in_role();
