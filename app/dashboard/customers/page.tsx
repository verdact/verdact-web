import { getDisputesByCustomer, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { CustomersView } from './customers-view';

export const metadata = {
  title: 'Customers · Verdact',
  description: 'Your disputes organized by customer, so repeat disputes reuse one evidence record.',
};

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
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

  const groups = membership ? await getDisputesByCustomer() : [];

  return (
    <CustomersView
      email={user.email}
      businessName={businessName}
      groups={groups}
      stripeConnected={stripeConnected}
    />
  );
}
