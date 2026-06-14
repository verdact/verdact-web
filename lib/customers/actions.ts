'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { IdentityDecision } from './types';

/**
 * Persist a merchant's identity decision (strategy doc §R8). 'merge' confirms two
 * keys are the same customer; 'split' records that they are NOT (suppresses the
 * suggestion / undoes a merge). Every decision is a training signal.
 *
 * NEVER called automatically — only from the merchant's explicit Confirm /
 * "Not the same" click. Degrades quietly while the table is unprovisioned (the
 * migration is left for review): the upsert fails, nothing changes, no crash.
 */
async function recordDecision(
  formData: FormData,
  decision: IdentityDecision,
): Promise<void> {
  const primaryKey = String(formData.get('primaryKey') ?? '').trim();
  const linkedKey = String(formData.get('linkedKey') ?? '').trim();
  if (!primaryKey || !linkedKey || primaryKey === linkedKey) return;

  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) return;

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
  // not yet provisioned) leaves the suggestion in place rather than crashing.
  if (!error) {
    revalidatePath('/dashboard/customers');
  }
}

export async function confirmMergeAction(formData: FormData): Promise<void> {
  await recordDecision(formData, 'merge');
}

export async function rejectMergeAction(formData: FormData): Promise<void> {
  await recordDecision(formData, 'split');
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > 0 ? s : null;
}
