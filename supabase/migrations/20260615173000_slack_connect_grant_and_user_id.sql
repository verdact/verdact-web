-- Slack connect: grant table privileges to the authenticated role and persist
-- the authorizing Slack user id.
--
-- The slack_connections table (20260527091300) and its RLS policies
-- (20260527091700: select via merchant_ids_for_user, write via
-- user_has_merchant_role(..., 'admin')) already exist, but no GRANT was ever
-- issued for slack_connections, so the OAuth connect/disconnect path cannot read
-- or write the row under the user's RLS-scoped client. Add the missing grant.
-- RLS still scopes every row to the caller's merchant.
grant select, insert, update, delete on public.slack_connections to authenticated;

-- Persist the authorizing Slack user id from authed_user.id so the import reader
-- can attribute provenance without a later schema change. Nullable; existing
-- rows are unaffected.
alter table public.slack_connections
  add column if not exists slack_user_id text;
