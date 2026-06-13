import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { type BusinessInitial, type PoliciesInitial } from './settings-client';
import { SettingsView, isTabKey, type SettingsStripe, type TabKey } from './settings-view';

export const metadata = {
  title: 'Settings · Verdact',
  description: 'Connections, business details, evidence policies, and account settings.',
};

export const dynamic = 'force-dynamic';

type ProfileRow = {
  product_description: string | null;
  delivery_method: string | null;
  customer_type: string | null;
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  tos_url: string | null;
  policy_disclosure_location: string | null;
  transaction_description_template: string | null;
  logs_user_activity: string | null;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stripe?: string }>;
}) {
  const params = await searchParams;
  const activeTab: TabKey = isTabKey(params.tab) ? params.tab : 'connections';
  const justDisconnected = params.stripe === 'disconnected';

  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;

  let profile: ProfileRow | null = null;
  let stripe: SettingsStripe = null;
  if (membership) {
    const supabase = await createClient();
    const [profileResult, stripeResult] = await Promise.all([
      supabase
        .from('merchant_profiles')
        .select(
          'product_description, delivery_method, customer_type, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, tos_url, policy_disclosure_location, transaction_description_template, logs_user_activity',
        )
        .eq('merchant_id', membership.merchant.id)
        .maybeSingle(),
      supabase
        .from('processor_connections')
        .select('processor_account_id, livemode, connected_at')
        .eq('merchant_id', membership.merchant.id)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle(),
    ]);
    profile = (profileResult.data as ProfileRow | null) ?? null;
    stripe = (stripeResult.data as SettingsStripe) ?? null;
  }

  const businessInitial: BusinessInitial = {
    businessName: businessName ?? '',
    productDescription: profile?.product_description ?? '',
    deliveryMethod: profile?.delivery_method ?? '',
    customerType: profile?.customer_type ?? '',
  };

  const policiesInitial: PoliciesInitial = {
    refundPolicyText: profile?.refund_policy_text ?? '',
    refundPolicyUrl: profile?.refund_policy_url ?? '',
    cancellationPolicyText: profile?.cancellation_policy_text ?? '',
    cancellationPolicyUrl: profile?.cancellation_policy_url ?? '',
    tosUrl: profile?.tos_url ?? '',
    policyDisclosureLocation: profile?.policy_disclosure_location ?? '',
    transactionDescriptionTemplate: profile?.transaction_description_template ?? '',
    logsUserActivity: profile?.logs_user_activity ?? '',
  };

  return (
    <SettingsView
      email={user.email ?? ''}
      businessName={businessName}
      activeTab={activeTab}
      justDisconnected={justDisconnected}
      businessInitial={businessInitial}
      policiesInitial={policiesInitial}
      stripe={stripe}
    />
  );
}
