import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { type BusinessInitial, type PoliciesInitial } from './settings-client';
import {
  SettingsView,
  isTabKey,
  type SettingsSlack,
  type SettingsStripe,
  type SlackNotice,
  type TabKey,
} from './settings-view';

// Friendly, em-dash-free copy for the slack_error codes the OAuth routes set.
const SLACK_ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'Slack is not configured yet. Contact the Verdact team.',
  denied: 'Slack connection was cancelled.',
  invalid_state: 'Slack connection could not be verified. Please try again.',
  no_code: 'Slack connection did not complete. Please try again.',
  no_merchant: 'No merchant account was found for your login.',
  exchange_failed: 'Slack connection did not complete. Please try again.',
  db_error: 'Slack connected, but saving it failed. Please try again.',
};

export const metadata = {
  title: 'Settings · Verdact',
  description: 'Connections, business details, evidence policies, and account settings.',
};

export const dynamic = 'force-dynamic';

type ProfileRow = {
  product_description: string | null;
  delivery_method: string | null;
  customer_type: string | null;
  persona: string | null;
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
  searchParams: Promise<{
    tab?: string;
    stripe?: string;
    connected?: string;
    slack?: string;
    slack_error?: string;
  }>;
}) {
  const params = await searchParams;
  const activeTab: TabKey = isTabKey(params.tab) ? params.tab : 'integrations';
  const justDisconnected = params.stripe === 'disconnected';
  const slackNotice: SlackNotice =
    params.connected === 'slack' ? 'connected' : params.slack === 'disconnected' ? 'disconnected' : null;
  const slackError = params.slack_error ? SLACK_ERROR_MESSAGES[params.slack_error] ?? 'Slack connection did not complete. Please try again.' : null;

  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';

  let profile: ProfileRow | null = null;
  let stripe: SettingsStripe = null;
  let slack: SettingsSlack = null;
  if (membership) {
    const supabase = await createClient();
    const [profileResult, stripeResult, slackResult] = await Promise.all([
      supabase
        .from('merchant_profiles')
        .select(
          'product_description, delivery_method, customer_type, persona, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, tos_url, policy_disclosure_location, transaction_description_template, logs_user_activity',
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
      supabase
        .from('slack_connections')
        .select('slack_team_name, connected_at')
        .eq('merchant_id', membership.merchant.id)
        .eq('status', 'connected')
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    profile = (profileResult.data as ProfileRow | null) ?? null;
    stripe = (stripeResult.data as SettingsStripe) ?? null;
    const slackRow = slackResult.data as { slack_team_name: string | null; connected_at: string | null } | null;
    slack = slackRow ? { team_name: slackRow.slack_team_name, connected_at: slackRow.connected_at } : null;
  }

  const businessInitial: BusinessInitial = {
    businessName: businessName ?? '',
    productDescription: profile?.product_description ?? '',
    deliveryMethod: profile?.delivery_method ?? '',
    customerType: profile?.customer_type ?? '',
    persona: profile?.persona ?? '',
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
      fullName={fullName}
      businessName={businessName}
      hasMerchant={membership !== null}
      activeTab={activeTab}
      justDisconnected={justDisconnected}
      businessInitial={businessInitial}
      policiesInitial={policiesInitial}
      stripe={stripe}
      slack={slack}
      slackNotice={slackNotice}
      slackError={slackError}
    />
  );
}
