import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { IdentityDecision, IdentityLink } from './types';

type IdentityLinkRow = {
  primary_key: string;
  linked_key: string;
  decision: IdentityDecision;
};

/**
 * Read a merchant's confirmed identity decisions. Degrades to [] if the
 * customer_identity_links table is not provisioned yet (the migration is left
 * for review), so the feature is dormant-safe until it is applied — the customers
 * page keeps rendering exact-email grouping with no decided pairs.
 */
export async function getIdentityLinks(merchantId: string): Promise<IdentityLink[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('customer_identity_links')
      .select('primary_key, linked_key, decision')
      .eq('merchant_id', merchantId);

    if (error || !data) return [];

    return (data as IdentityLinkRow[]).map((r) => ({
      primaryKey: r.primary_key,
      linkedKey: r.linked_key,
      decision: r.decision,
    }));
  } catch {
    return [];
  }
}
