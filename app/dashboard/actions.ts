'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { GUIDANCE_RULES } from '@/lib/guidance';

const KNOWN_RULE_IDS = new Set(GUIDANCE_RULES.map((rule) => rule.id));

/**
 * Marks the merchant's latest dashboard impression of a non-urgent tip as
 * dismissed, so the cadence rests it for DISMISS_REST_DAYS. Bound to the rule id
 * in the band's dismiss control: `dismissGuidanceAction.bind(null, item.id)`.
 *
 * Best-effort: an unknown rule id or a missing impression row is a no-op, and any
 * failure is swallowed so a dismiss click never 500s the dashboard. The worst
 * case is the tip simply isn't rested.
 */
export async function dismissGuidanceAction(ruleId: string): Promise<void> {
  if (!KNOWN_RULE_IDS.has(ruleId)) return;

  await verifySession();
  const membership = await getMerchant();
  if (!membership) return;

  try {
    const supabase = await createClient();
    // RLS scopes both reads and writes to this merchant; stamp the newest
    // not-yet-dismissed impression for the rule on the dashboard.
    const { data: latest } = await supabase
      .from('guidance_impressions')
      .select('id')
      .eq('merchant_id', membership.merchant.id)
      .eq('rule_id', ruleId)
      .eq('target', 'dashboard')
      .is('dismissed_at', null)
      .order('shown_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      // RLS already scopes the write; the explicit merchant_id predicate is
      // defense-in-depth so the update is fenced even if RLS were ever relaxed.
      await supabase
        .from('guidance_impressions')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', latest.id)
        .eq('merchant_id', membership.merchant.id);
    }
  } catch {
    // Best-effort cadence: a failed dismiss just means the tip isn't rested.
  }

  revalidatePath('/dashboard');
}
