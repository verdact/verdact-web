-- R2 sub-stage 1 — real evidence intake.
--
-- PostgREST requires table privileges IN ADDITION to RLS policies. The
-- evidence_files RLS policies (select/insert member, update member, delete admin)
-- and the disputes RLS update policy (member) already exist (20260527091700 +
-- 20260527092200), but `authenticated` was never granted table privileges on
-- evidence_files, and disputes was granted SELECT only (20260528010000). Without
-- these grants the intake INSERT and the narrative (evidence_draft) UPDATE fail
-- with a 42501 permission error even though RLS would allow the row.
--
-- RLS stays the row-level enforcement layer; these grants only let the
-- authenticated app code reach the existing policies. Role precedence
-- owner>admin>member>viewer means a bootstrapped owner satisfies every check.

-- Evidence intake: merchant uploads/attaches evidence files for their disputes.
grant select, insert, update, delete on public.evidence_files to authenticated;

-- Narrative editor: merchant persists the working draft to disputes.evidence_draft.
grant update on public.disputes to authenticated;

-- Align the evidence-files STORAGE delete policy with the TABLE delete policy.
-- The original storage policy (20260527091900) allowed role `member`, but the
-- table delete policy (20260527092200) requires `admin`. Left as-is, a member
-- could delete the blob out from under a metadata row it is not allowed to
-- delete, orphaning the row / corrupting a packet. Match them at `admin`.
drop policy if exists "evidence_files_delete_member" on storage.objects;
create policy "evidence_files_delete_member"
  on storage.objects for delete
  using (
    bucket_id = 'evidence-files'
    and app_private.user_has_merchant_role(app_private.storage_object_merchant_id(name), 'admin')
  );
