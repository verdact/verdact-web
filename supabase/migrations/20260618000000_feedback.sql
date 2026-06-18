-- ─────────────────────────────────────────────────────────────────────────────
-- public.feedback — the write-feedback "send from anywhere" inbox.
--
-- "Send feedback from anywhere": anyone (a signed-in merchant, a signed-out
-- visitor, or a marketing visitor) can write feedback. Verdact also asks
-- occasionally. Everything is saved. The founder triages it in /admin.
--
-- SECURITY MODEL (public-suggestion-box shape — anonymous writes, founder reads):
--   - RLS is ENABLED.
--   - A PUBLIC, INSERT-only policy lets anon + authenticated WRITE, with a CHECK
--     that (a) forces status = 'new', (b) re-validates length / category /
--     surface at the DB boundary, and (c) forbids spoofing another merchant's id
--     (merchant_id must be NULL or one the caller actually belongs to). A
--     malicious user can therefore write, but never read, others' feedback.
--   - SELECT + UPDATE are founder-only. This repo gates the founder via the
--     platform_admins allowlist read through the service-role client (which
--     BYPASSES RLS), so the admin inbox works regardless of RLS. The forward-
--     compatible JWT policies below (role = 'founder') are additionally declared
--     so a future custom-claims setup keeps reads founder-only without a new
--     migration; they evaluate false today (no such claim is minted yet), which
--     is the safe default.
--   - There is NO delete policy, so "all feedback is saved" is structural.
--   - Rate-limit + honeypot live at the API route (RLS cannot rate-limit). Per
--     the PII rule, feedback stays in Supabase and is never forwarded onward.
--
-- NOT APPLIED automatically — authored for review per the build instruction.
-- Apply with the rest of the migrations after Rishi's review.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- NULL when anonymous / signed-out / marketing. Set NULL on merchant delete so
  -- the note survives the account (nothing is ever deleted from this table).
  merchant_id     uuid references public.merchants(id) on delete set null,

  -- Optional contact. "Leave blank to stay anonymous."
  email           text,

  -- Where it came from + what they were looking at (server- and client-captured).
  surface         text not null,
  route           text,
  screen          text,
  activity        text,

  category        text not null default 'other',
  message         text not null,

  -- Manual-first: the user only NOTES a screenshot is available; we never
  -- auto-capture the screen. The founder follows up by email to receive it.
  has_screenshot  boolean not null default false,

  status          text not null default 'new',

  -- Set from the request header server-side, never from a trusted client field.
  user_agent      text,

  -- Triage trail (founder-set on UPDATE).
  triaged_at      timestamptz,
  triaged_by      uuid references auth.users(id) on delete set null,

  -- Enum + length + email-shape guards. The CHECKs are the durable backstop the
  -- public INSERT policy and the route-level Zod validation both defer to.
  constraint feedback_surface_check   check (surface in ('app', 'auth', 'marketing', 'prompt')),
  constraint feedback_category_check  check (category in ('idea', 'problem', 'confusing', 'praise', 'other')),
  constraint feedback_status_check    check (status in ('new', 'triaged', 'closed')),
  constraint feedback_message_len     check (char_length(message) between 1 and 4000),
  constraint feedback_activity_len    check (activity is null or char_length(activity) <= 160),
  constraint feedback_route_len       check (route is null or char_length(route) <= 512),
  constraint feedback_screen_len      check (screen is null or char_length(screen) <= 120),
  constraint feedback_email_shape     check (
    email is null
    or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  )
);

-- Inbox is "newest first, filtered by status"; merchant lookups by id.
create index if not exists feedback_status_created_at_idx
  on public.feedback (status, created_at desc);

create index if not exists feedback_merchant_id_idx
  on public.feedback (merchant_id)
  where merchant_id is not null;

alter table public.feedback enable row level security;

-- app_private.merchant_ids_for_user() is the existing security-definer helper
-- that returns ONLY the merchant_ids the caller actually belongs to (keyed off
-- auth.uid()). It is granted to authenticated + service_role today; the public
-- INSERT policy below applies to anon too, and a policy expression executes as
-- the invoking role, so anon must be able to execute it (it returns nothing for
-- anon, since auth.uid() is null — safe to expose).
grant execute on function app_private.merchant_ids_for_user() to anon;

-- ── Public INSERT-only (anon + authenticated) ───────────────────────────────
-- Writes are open, but constrained: status must start as 'new', the enum/length
-- guards are re-asserted, and merchant_id cannot be spoofed onto another tenant.
-- The anti-spoof clause short-circuits for anon (auth.uid() is null), who can
-- therefore only ever submit merchant_id = NULL.
create policy "feedback_insert_public"
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and surface in ('app', 'auth', 'marketing', 'prompt')
    and category in ('idea', 'problem', 'confusing', 'praise', 'other')
    and char_length(message) between 1 and 4000
    and (activity is null or char_length(activity) <= 160)
    and (
      merchant_id is null
      or (
        (select auth.uid()) is not null
        and merchant_id in (select app_private.merchant_ids_for_user())
      )
    )
  );

-- ── Founder-only SELECT + UPDATE (forward-compatible JWT claim) ──────────────
-- The admin inbox reads/writes through the service-role client (bypasses RLS),
-- gated in app code by the platform_admins allowlist. These policies keep RLS
-- correct for any direct PostgREST access: only a founder JWT claim may read or
-- triage. No such claim is minted today, so anon/authenticated get nothing.
create policy "feedback_select_founder"
  on public.feedback
  for select
  to authenticated
  using ((auth.jwt() ->> 'role') = 'founder');

create policy "feedback_update_founder"
  on public.feedback
  for update
  to authenticated
  using ((auth.jwt() ->> 'role') = 'founder')
  with check ((auth.jwt() ->> 'role') = 'founder');

-- Intentionally NO delete policy: feedback is structurally retained.

-- Privilege grants. anon + authenticated may INSERT only (RLS still applies).
-- SELECT/UPDATE are granted so the founder JWT policy can take effect; without
-- the table grant, RLS would never even be consulted. DELETE is never granted.
revoke all on table public.feedback from anon;
revoke all on table public.feedback from authenticated;
grant insert on table public.feedback to anon;
grant insert, select, update on table public.feedback to authenticated;
grant all on table public.feedback to service_role;
