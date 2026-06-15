-- Follow-up to the beta admission lock migration: cover nullable admin/audit
-- foreign keys so Supabase advisors do not flag the new tables.

create index if not exists platform_admission_policy_updated_by_idx
  on platform_admission_policy (updated_by)
  where updated_by is not null;

create index if not exists platform_invites_created_by_idx
  on platform_invites (created_by)
  where created_by is not null;
