import { notFound } from 'next/navigation';
import { SettingsView, isTabKey, type SettingsStripe, type TabKey } from '../../settings/settings-view';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of /settings with sample data. The real /settings is
// auth-gated. Use ?tab=connections|business|policies|notifications|account and
// ?stripe=off to preview the not-connected state. 404s in production.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Settings preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const MOCK_STRIPE: SettingsStripe = {
  processor_account_id: 'acct_1QExAmpLeWxYz000',
  livemode: false,
  connected_at: new Date(Date.now() - 42 * 86400000).toISOString(),
};

export default async function SettingsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stripe?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const params = await searchParams;
  const activeTab: TabKey = isTabKey(params.tab) ? params.tab : 'connections';
  const stripe: SettingsStripe = params.stripe === 'off' ? null : MOCK_STRIPE;

  return (
    <SettingsView
      email="founder@acmesoftware.com"
      fullName="Rishi Verma"
      businessName="Acme Software"
      activeTab={activeTab}
      justDisconnected={false}
      businessInitial={{
        businessName: 'Acme Software',
        productDescription: 'A SaaS analytics platform billed monthly.',
        deliveryMethod: 'app',
        customerType: 'b2b',
        persona: 'priya',
      }}
      policiesInitial={{
        refundPolicyText: 'Refunds available within 14 days of purchase.',
        refundPolicyUrl: 'https://acmesoftware.com/refunds',
        cancellationPolicyText: '',
        cancellationPolicyUrl: 'https://acmesoftware.com/cancellation',
        tosUrl: 'https://acmesoftware.com/terms',
        policyDisclosureLocation: 'checkout',
        transactionDescriptionTemplate: 'ACME SOFTWARE',
        logsUserActivity: 'yes',
      }}
      stripe={stripe}
    />
  );
}
