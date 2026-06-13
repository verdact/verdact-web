import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from './onboarding-client';

export const metadata = {
  title: 'Set up Verdact',
  description: 'Set up your dispute workbench and connect Stripe.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await verifySession();
  const membership = await getMerchant();

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const businessName = membership?.merchant?.business_name?.trim() ?? '';

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

  return (
    <OnboardingClient
      initialFullName={fullName}
      initialBusinessName={businessName}
      stripeConnected={stripeConnected}
    />
  );
}
