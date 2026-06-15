'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

/**
 * Workbench mutations (R2 sub-stage 1).
 *
 *   saveNarrativeAction      — persist the merchant's draft narrative into
 *                              disputes.evidence_draft (JSONB), merge-safe.
 *   deleteEvidenceFileAction — remove an attached evidence file (row + blob).
 *
 * Every call re-verifies the session + merchant and scopes the query by
 * merchant_id; RLS is the backstop. Never called with service-role.
 */

const MAX_NARRATIVE_CHARS = 20_000;
const BUCKET = 'evidence-files';

export interface SaveNarrativeResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
}

export async function saveNarrativeAction(input: {
  disputeId: string;
  narrative: string;
}): Promise<SaveNarrativeResult> {
  const disputeId = input.disputeId?.trim();
  if (!disputeId) return { ok: false, error: 'Missing dispute reference.' };
  // Server Action args arrive deserialized — guard the type before string ops.
  const rawNarrative = typeof input.narrative === 'string' ? input.narrative : '';
  const narrative = rawNarrative.slice(0, MAX_NARRATIVE_CHARS);

  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };

  const supabase = await createClient();

  // Read the existing draft so we merge rather than clobber any other keys a
  // future stage may store on evidence_draft.
  const { data: row } = await supabase
    .from('disputes')
    .select('evidence_draft')
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Dispute not found.' };

  const savedAt = new Date().toISOString();
  const existing =
    row.evidence_draft && typeof row.evidence_draft === 'object'
      ? (row.evidence_draft as Record<string, unknown>)
      : {};
  const draft = { ...existing, narrative, narrativeSavedAt: savedAt };

  const { error } = await supabase
    .from('disputes')
    .update({ evidence_draft: draft })
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id);
  if (error) return { ok: false, error: 'Could not save the narrative.' };

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { ok: true, savedAt };
}

export interface DeleteFileResult {
  ok: boolean;
  error?: string;
}

export async function deleteEvidenceFileAction(input: {
  fileId: string;
  disputeId: string;
}): Promise<DeleteFileResult> {
  const fileId = input.fileId?.trim();
  const disputeId = input.disputeId?.trim();
  if (!fileId || !disputeId) return { ok: false, error: 'Missing file reference.' };

  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };

  // Application-layer authz mirroring the evidence_files delete RLS (admin+).
  // RLS is the backstop; this gives a clean message and a guard that holds even
  // if this action is ever refactored onto a service-role client.
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { ok: false, error: 'You do not have permission to remove evidence files.' };
  }

  const supabase = await createClient();

  const { data: file } = await supabase
    .from('evidence_files')
    .select('id, supabase_path')
    .eq('id', fileId)
    .eq('merchant_id', membership.merchant.id)
    .maybeSingle();
  if (!file) return { ok: false, error: 'File not found.' };

  const { error } = await supabase
    .from('evidence_files')
    .delete()
    .eq('id', fileId)
    .eq('merchant_id', membership.merchant.id);
  if (error) return { ok: false, error: 'Could not remove the file.' };

  // Best-effort blob cleanup; the metadata row is already gone.
  const path = (file as { supabase_path: string | null }).supabase_path;
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { ok: true };
}
