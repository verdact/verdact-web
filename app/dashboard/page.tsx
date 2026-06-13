import { redirect } from 'next/navigation';
import {
  getDisputes,
  getEfwAlerts,
  getLatestVampSnapshot,
  getMerchant,
  verifySession,
} from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { DashboardView, type StripeConnection } from './dashboard-view';

export const metadata = {
  title: 'Dashboard · Verdact',
  description: 'Dispute overview, account health, and evidence workspace.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const justConnected = params.connected === 'stripe';
  const stripeError = typeof params.stripe_error === 'string' ? params.stripe_error : null;

  const user = await verifySession();

  // First-run gate: send merchants who have not finished onboarding to the
  // wizard. Onboarding "Skip for now", "Finish", and connecting Stripe all set
  // onboarding_completed = true, so nobody is trapped or looped.
  if (user.user_metadata?.onboarding_completed !== true) {
    redirect('/onboarding');
  }

  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  let stripeConnection: StripeConnection = null;
  if (membership) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('processor_connections')
      .select('id, processor_account_id, livemode, connected_at')
      .eq('merchant_id', membership.merchant.id)
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected')
      .maybeSingle();
    stripeConnection = data ?? null;
  }

  const [disputes, efwAlerts, vampSnapshot] = membership
    ? await Promise.all([getDisputes(), getEfwAlerts(), getLatestVampSnapshot()])
    : [[], [], null];

  return (
    <DashboardView
      email={user.email}
      businessName={businessName}
      fullName={fullName}
      disputes={disputes}
      efwAlerts={efwAlerts}
      vampRatio={vampSnapshot?.estimated_vamp_ratio ?? null}
      stripeConnection={stripeConnection}
      justConnected={justConnected}
      stripeError={stripeError}
    />
  );
}
