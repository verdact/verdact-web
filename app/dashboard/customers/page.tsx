import { getDisputesByCustomer, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { getIdentityLinks } from '@/lib/customers/links';
import { applyConfirmedMerges } from '@/lib/customers/resolve';
import { buildMergeSuggestions, partitionSuggestions } from '@/lib/customers/suggestions';
import { pairId, type IdentityLink } from '@/lib/customers/types';
import { CustomersView, isCustomerSort, type CustomerSort } from './customers-view';

export const metadata = {
  title: 'Customers · Verdact',
  description: 'Your disputes organized by customer, so repeat disputes reuse one evidence record.',
};

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sortParam = typeof params.sort === 'string' ? params.sort : undefined;
  const sort: CustomerSort = isCustomerSort(sortParam) ? sortParam : 'repeat';

  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;

  let stripeConnected = false;
  if (membership) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('processor_connections')
      .select('id')
      .eq('merchant_id', membership.merchant.id)
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected')
      .maybeSingle();
    stripeConnected = Boolean(data);
  }

  const [rawGroups, links] = membership
    ? await Promise.all([getDisputesByCustomer(), getIdentityLinks(membership.merchant.id)])
    : [[], []];

  // Apply the merchant's confirmed merges, then look at the still-undecided
  // "possible same customer" pairs (decided pairs — merge OR split — are excluded).
  const confirmedGroups = applyConfirmedMerges(rawGroups, links);
  const decided = new Set(links.map((l) => pairId(l.primaryKey, l.linkedKey)));
  const { autoMerges, prompts } = partitionSuggestions(
    buildMergeSuggestions(confirmedGroups, decided),
  );

  // Sure pairs auto-merge (Rishi 2026-06-14); doubtful pairs are prompted. The
  // auto-merge is applied to the grouping here and shown transparently with an
  // undo. (Persisting auto-merges as training rows happens on user correction —
  // we never write during render.)
  const autoLinks: IdentityLink[] = autoMerges.map((s) => ({
    primaryKey: s.primaryKey,
    linkedKey: s.linkedKey,
    decision: 'merge',
  }));
  const groups = applyConfirmedMerges(confirmedGroups, autoLinks);

  return (
    <CustomersView
      email={user.email}
      businessName={businessName}
      groups={groups}
      suggestions={prompts}
      autoMerged={autoMerges}
      sort={sort}
      stripeConnected={stripeConnected}
    />
  );
}
