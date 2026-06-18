'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { IdentityDecision } from './types';

/**
 * Result of a merge/split action, surfaced to the merchant so the choice never
 * fails silently. `ok` with a `decision` drives the success line; `error` drives
 * the inline error. Compatible with useActionState's (prevState, formData) shape.
 */
export type MergeActionState =
  | { ok: true; decision: IdentityDecision }
  | { ok: false; error: string }
  | undefined;

const SAVE_FAILED = 'Could not save your choice. Please try again.';

/**
 * Persist a merchant's identity decision (strategy doc §R8). 'merge' confirms two
 * keys are the same customer; 'split' records that they are NOT (suppresses the
 * suggestion / undoes a merge). Every decision is a training signal.
 *
 * NEVER called automatically — only from the merchant's explicit Confirm /
 * "Not the same" click. Returns a result so the UI can confirm or surface a
 * failure; while the table is unprovisioned the upsert fails and the merchant
 * sees an error rather than a silent no-op.
 */
async function recordDecision(
  formData: FormData,
  decision: IdentityDecision,
): Promise<MergeActionState> {
  const primaryKey = String(formData.get('primaryKey') ?? '').trim();
  const linkedKey = String(formData.get('linkedKey') ?? '').trim();
  if (!primaryKey || !linkedKey || primaryKey === linkedKey) {
    return { ok: false, error: SAVE_FAILED };
  }

  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) return { ok: false, error: SAVE_FAILED };

  const confidenceRaw = Number(formData.get('confidence'));
  // 'auto' = the merchant is correcting an auto-merge (a labeled false positive at
  // that confidence — the most valuable training signal); 'suggested' = a decision
  // on a doubtful prompt. Anything else falls back to 'suggested'.
  const sourceRaw = stringOrNull(formData.get('source'));
  const source = sourceRaw === 'auto' ? 'auto' : 'suggested';
  const supabase = await createClient();
  const { error } = await supabase.from('customer_identity_links').upsert(
    {
      merchant_id: membership.merchant.id,
      primary_key: primaryKey,
      linked_key: linkedKey,
      decision,
      source,
      suggestion_kind: stringOrNull(formData.get('kind')),
      confidence: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
      reason: stringOrNull(formData.get('reason')),
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id,primary_key,linked_key' },
  );

  // Only reflect the change when it actually persisted. A missing table (feature
  // not yet provisioned) surfaces the error instead of crashing or no-op'ing.
  if (error) {
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePath('/dashboard/customers');
  return { ok: true, decision };
}

export async function confirmMergeAction(
  _prevState: MergeActionState,
  formData: FormData,
): Promise<MergeActionState> {
  return recordDecision(formData, 'merge');
}

export async function rejectMergeAction(
  _prevState: MergeActionState,
  formData: FormData,
): Promise<MergeActionState> {
  return recordDecision(formData, 'split');
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : null;
}
