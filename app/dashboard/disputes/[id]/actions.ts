'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

/**
 * Workbench mutations (R2 sub-stage 1).
 *
 *   saveNarrativeAction          — persist the merchant's draft narrative into
 *                                  disputes.evidence_draft (JSONB), merge-safe.
 *   deleteEvidenceFileAction     — remove an attached evidence file (row + blob).
 *   setAcceptanceUnavailableAction — record (or clear) that no formal delivery /
 *                                  acceptance proof exists, with a reason. Honest:
 *                                  it notes the gap, it never fabricates proof.
 *
 * Every call re-verifies the session + merchant and scopes the query by
 * merchant_id; RLS is the backstop. Never called with service-role.
 */

const MAX_NARRATIVE_CHARS = 20_000;
const MAX_REASON_CHARS = 500;
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

  // Best-effort blob cleanup; the metadata row is already gone. Log (do not
  // fail) if the remove errors, so an orphaned blob is visible to ops instead
  // of silently consuming storage.
  const path = (file as { supabase_path: string | null }).supabase_path;
  if (path) {
    const { error: blobError } = await supabase.storage.from(BUCKET).remove([path]);
    if (blobError) {
      console.error('[evidence/delete] blob cleanup failed (row already removed):', blobError.message);
    }
  }

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { ok: true };
}

export interface SetAcceptanceUnavailableResult {
  ok: boolean;
  error?: string;
}

/**
 * Record (reason provided) or clear (reason omitted/empty) that no formal
 * delivery or acceptance proof exists for this dispute. Stored on
 * disputes.evidence_draft.acceptanceUnavailable, merge-safe. This de-escalates
 * the Resolve card and the Evidence Record gap from "action needed" to a noted
 * gap; it never inflates readiness or invents evidence.
 */
export async function setAcceptanceUnavailableAction(input: {
  disputeId: string;
  reason: string;
}): Promise<SetAcceptanceUnavailableResult> {
  const disputeId = input.disputeId?.trim();
  if (!disputeId) return { ok: false, error: 'Missing dispute reference.' };
  const rawReason = typeof input.reason === 'string' ? input.reason : '';
  const reason = rawReason.trim().slice(0, MAX_REASON_CHARS);

  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from('disputes')
    .select('evidence_draft')
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Dispute not found.' };

  const existing =
    row.evidence_draft && typeof row.evidence_draft === 'object'
      ? (row.evidence_draft as Record<string, unknown>)
      : {};

  // Clearing: drop the key entirely so the gap returns to "action needed".
  let draft: Record<string, unknown>;
  if (!reason) {
    draft = { ...existing };
    delete draft.acceptanceUnavailable;
  } else {
    // acceptanceUnavailable is a UI-layer gap note only. It is never mapped into
    // a PacketField or serialized into the submission packet (serializePacketText
    // iterates packet.fields, not evidence_draft) — keep it that way.
    draft = {
      ...existing,
      acceptanceUnavailable: { reason, notedAt: new Date().toISOString() },
    };
  }

  const { error } = await supabase
    .from('disputes')
    .update({ evidence_draft: draft })
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id);
  if (error) return { ok: false, error: 'Could not save your note.' };

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { ok: true };
}
