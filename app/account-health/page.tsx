import {
  getDisputes,
  getEfwAlerts,
  getLatestVampSnapshot,
  getMerchant,
  verifySession,
} from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { AccountHealthView } from './account-health-view';

export const metadata = {
  title: 'Account health · Verdact',
  description: 'Your dispute rate, headroom against the 0.75% line, and what is affecting your account health.',
};

export const dynamic = 'force-dynamic';

export default async function AccountHealthPage() {
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

  const [disputes, efwAlerts, snapshot] = membership
    ? await Promise.all([getDisputes(), getEfwAlerts(), getLatestVampSnapshot()])
    : [[], [], null];

  return (
    <AccountHealthView
      email={user.email}
      businessName={businessName}
      disputes={disputes}
      efwAlerts={efwAlerts}
      snapshot={snapshot}
      stripeConnected={stripeConnected}
    />
  );
}
