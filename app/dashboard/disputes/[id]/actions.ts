'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseEvidenceDraft } from '@/lib/evidence/draft';
import { submitEvidenceToStripe, type SubmitReason } from '@/lib/evidence/stripe-submit';
import { generateAiNarrative } from '@/lib/evidence/ai-narrative';

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
  const existing = parseEvidenceDraft(row.evidence_draft);
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

export interface GenerateNarrativeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * Draft the merchant's "account of what happened" with AI (Anthropic). Returns
 * the draft for the merchant to REVIEW and edit — it does NOT persist. The
 * existing autosave writes it once the merchant edits/blurs. Gated behind the
 * VERDACT_AI_NARRATIVE_ENABLED kill switch (off by default → friendly error,
 * no API call). Reads are RLS-scoped to the merchant; no PII is sent beyond the
 * merchant's own dispute facts + which proof pillars are on file.
 */
export async function generateNarrativeAction(input: {
  disputeId: string;
}): Promise<GenerateNarrativeResult> {
  const disputeId = input.disputeId?.trim();
  if (!disputeId) return { ok: false, error: 'Missing dispute reference.' };

  // PRE-GO-LIVE GATE: before flipping VERDACT_AI_NARRATIVE_ENABLED=true, add a
  // per-user/per-dispute server-side rate limit here (reuse lib checkRateLimit).
  // The client button-disable is not a server control; without this a compromised
  // session could loop this action and drain API spend. Safe while inert (off).
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };

  const supabase = await createClient();

  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, reason, amount, currency')
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id)
    .maybeSingle();
  if (!dispute) return { ok: false, error: 'Dispute not found.' };

  const [filesResult, profileResult] = await Promise.all([
    supabase
      .from('evidence_files')
      .select('purpose')
      .eq('dispute_id', disputeId)
      .eq('merchant_id', membership.merchant.id),
    supabase
      .from('merchant_profiles')
      .select('product_description')
      .eq('merchant_id', membership.merchant.id)
      .maybeSingle(),
  ]);

  const purposes = new Set(
    (filesResult.data ?? []).map((f) => (f as { purpose: string }).purpose),
  );
  const d = dispute as { reason: string | null; amount: number | null; currency: string | null };
  const productDescription =
    (profileResult.data as { product_description: string | null } | null)?.product_description ?? null;

  const result = await generateAiNarrative({
    reasonLabel: d.reason ?? 'a customer dispute',
    reasonCode: d.reason ?? '',
    amount: d.amount,
    currency: d.currency,
    customerName: null,
    productDescription,
    proofSummary: {
      delivery: purposes.has('service_documentation'),
      // No file purpose encodes "usage" in this schema (usage derives from
      // session signals, not uploads), so it is honestly false at the file layer.
      usage: false,
      comms: purposes.has('communication'),
      policyAttached: purposes.has('refund_policy') || purposes.has('cancellation_policy'),
    },
  });

  // Strip `model` (internal detail) — return only the editable text to the client.
  if (result.ok) return { ok: true, text: result.text };
  return { ok: false, error: result.error };
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

  const existing = parseEvidenceDraft(row.evidence_draft);

  // Clearing: drop the key entirely so the gap returns to "action needed".
  let draft = { ...existing };
  if (!reason) {
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

// ─── Approve / sign-off ──────────────────────────────────────────────────────

const SIGN_OFF_TEXT_VERSION = 'v1';

export interface ApproveEvidenceResult {
  ok: boolean;
  error?: string;
}

/**
 * Record the merchant's explicit sign-off on this evidence record. Sets the three
 * columns the disputes_submission_requires_approval CHECK demands before
 * submitted_at can ever be set (evidence_approved_at + _by + sign_off_at), so this
 * MUST precede any submit. Owner/admin only.
 */
export async function approveEvidenceAction(input: {
  disputeId: string;
}): Promise<ApproveEvidenceResult> {
  const disputeId = input.disputeId?.trim();
  if (!disputeId) return { ok: false, error: 'Missing dispute reference.' };

  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { ok: false, error: 'You do not have permission to approve this record.' };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('disputes')
    .select('id, status, submitted_at')
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Dispute not found.' };
  if ((row as { submitted_at: string | null }).submitted_at) {
    return { ok: false, error: 'This record has already been submitted.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('disputes')
    .update({
      evidence_approved_at: now,
      evidence_approved_by: user.id,
      sign_off_at: now,
      sign_off_text_version: SIGN_OFF_TEXT_VERSION,
    })
    .eq('id', disputeId)
    .eq('merchant_id', membership.merchant.id);
  if (error) return { ok: false, error: 'Could not record your approval.' };

  // Best-effort append-only audit event (dispute_events insert is service-role
  // granted). A failure here does not undo the approval.
  try {
    const service = createServiceClient();
    await service.from('dispute_events').insert({
      merchant_id: membership.merchant.id,
      dispute_id: disputeId,
      event_type: 'evidence_approved',
      actor_kind: 'user',
      payload: { schema_version: 'v1', approved_by: user.id, sign_off_text_version: SIGN_OFF_TEXT_VERSION },
    });
  } catch (err) {
    console.error('[approve] dispute_events insert failed:', err instanceof Error ? err.message : err);
  }

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  return { ok: true };
}

// ─── Submit to Stripe ────────────────────────────────────────────────────────

export interface SubmitToStripeResult {
  ok: boolean;
  error?: string;
}

/**
 * Submit the approved evidence record to Stripe. Thin wrapper: it re-verifies the
 * session + role, captures the request IP/UA for the audit row, then delegates to
 * the fail-closed submitEvidenceToStripe engine. It NEVER passes a client-supplied
 * payload — the engine re-derives the packet from disputeId.
 */
export async function submitToStripeAction(input: {
  disputeId: string;
}): Promise<SubmitToStripeResult> {
  const disputeId = input.disputeId?.trim();
  if (!disputeId) return { ok: false, error: 'Missing dispute reference.' };

  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: 'No merchant account found.' };
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { ok: false, error: 'You do not have permission to submit this record.' };
  }

  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const ua = hdrs.get('user-agent') || null;

  const result = await submitEvidenceToStripe({
    user,
    merchantId: membership.merchant.id,
    disputeId,
    requestIp: ip,
    requestUserAgent: ua,
  });

  revalidatePath(`/dashboard/disputes/${disputeId}`);
  if (result.ok) return { ok: true };
  return { ok: false, error: messageForSubmitReason(result.reason, result.message) };
}

function messageForSubmitReason(reason: SubmitReason, detail?: string): string {
  switch (reason) {
    case 'kill_switch_off':
      return 'Filing to Stripe is not open yet. We will tell you the moment it is.';
    case 'not_opted_in':
      return 'Turn on submission in Settings before filing.';
    case 'not_approved':
      return 'Approve the record before submitting.';
    case 'no_entitlement':
      return 'Submitting to Stripe is available on the paid plan.';
    case 'already_submitted':
      return 'This record has already been submitted.';
    case 'dispute_not_submittable':
      return 'This dispute is not in a state where evidence can be submitted.';
    case 'past_deadline':
      return 'The response deadline for this dispute has passed.';
    case 'not_connected':
      return 'Connect your Stripe account before submitting.';
    case 'account_mismatch':
      return 'This dispute belongs to a different Stripe account than the one connected.';
    case 'evidence_incomplete':
      return detail ? `Evidence is not ready yet: ${detail}.` : 'Some required evidence is still missing.';
    case 'audit_write_failed':
      return 'We could not record the submission safely, so nothing was sent. Please try again.';
    case 'attempt_conflict':
      return 'A submission is already in progress for this dispute.';
    case 'stripe_error':
      return detail ? `Stripe rejected the submission: ${detail}` : 'Stripe rejected the submission.';
    case 'not_found':
      return 'Dispute not found.';
    case 'load_error':
      return 'We could not load this dispute right now. Please try again.';
    default:
      return 'Could not submit the record.';
  }
}
