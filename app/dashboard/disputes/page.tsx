import { getDisputes, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { DisputesView, isDisputeFilter, type DisputeFilter } from './disputes-view';

export const metadata = {
  title: 'Disputes · Verdact',
  description: 'Every dispute Verdact is watching, with the nearest deadlines first.',
};

export const dynamic = 'force-dynamic';

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filterParam = typeof params.filter === 'string' ? params.filter : undefined;
  const filter: DisputeFilter = isDisputeFilter(filterParam) ? filterParam : 'needs-action';

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

  const disputes = membership ? await getDisputes() : [];

  return (
    <DisputesView
      email={user.email}
      businessName={businessName}
      disputes={disputes}
      stripeConnected={stripeConnected}
      filter={filter}
    />
  );
}
