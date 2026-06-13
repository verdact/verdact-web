import { notFound } from 'next/navigation';
import { AccountHealthView } from '../../account-health/account-health-view';
import { type Dispute, type EfwAlert, type VampSnapshot } from '@/lib/dal';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of the Account Health page with sample data.
// The real /account-health is auth-gated and can't render without a Supabase
// session. Use ?state=healthy|close|atrisk|low|disconnected. 404s in production.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Account health preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const MOCK_DISPUTES: Dispute[] = [
  {
    id: 'dp_1',
    processor_dispute_id: 'du_1',
    processor_charge_id: 'ch_1',
    amount: 48000,
    currency: 'usd',
    reason: 'Product not received',
    network: 'visa',
    status: 'needs_response',
    due_by: null,
    ce3_eligible: false,
    outcome: null,
    created_at: daysAgo(4),
  },
  {
    id: 'dp_2',
    processor_dispute_id: 'du_2',
    processor_charge_id: 'ch_2',
    amount: 12500,
    currency: 'usd',
    reason: 'Product not received',
    network: 'visa',
    status: 'under_review',
    due_by: null,
    ce3_eligible: false,
    outcome: null,
    created_at: daysAgo(9),
  },
  {
    id: 'dp_3',
    processor_dispute_id: 'du_3',
    processor_charge_id: 'ch_3',
    amount: 8900,
    currency: 'usd',
    reason: 'Subscription canceled',
    network: 'mastercard',
    status: 'won',
    due_by: null,
    ce3_eligible: false,
    outcome: 'won',
    created_at: daysAgo(30),
  },
];

const MOCK_EFW: EfwAlert[] = [
  {
    id: 'efw_1',
    processor_alert_id: 'issfr_1',
    processor_charge_id: 'ch_9',
    fraud_type: 'Visa TC40 fraud notice',
    actionable: true,
    merchant_decision: 'pending',
    created_at: daysAgo(2),
  },
];

function snapshot(ratio: number | null, confidence: VampSnapshot['confidence_level']): VampSnapshot {
  return {
    estimated_vamp_ratio: ratio,
    confidence_level: confidence,
    visa_settled_transaction_count: 1840,
    visa_dispute_count: 9,
    visa_efw_count: 2,
    calculation_window_start: daysAgo(90),
    calculation_window_end: daysAgo(0),
    raw_components: null,
    calculated_at: daysAgo(0),
  };
}

export default async function AccountHealthPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { state } = await searchParams;

  const config = (() => {
    switch (state) {
      case 'healthy':
        return { snap: snapshot(0.0021, 'high' as const), connected: true };
      case 'atrisk':
        return { snap: snapshot(0.0098, 'high' as const), connected: true };
      case 'low':
        return { snap: snapshot(null, 'low' as const), connected: true };
      case 'disconnected':
        return { snap: null, connected: false };
      case 'close':
      default:
        return { snap: snapshot(0.0061, 'high' as const), connected: true };
    }
  })();

  return (
    <AccountHealthView
      email="founder@acmesoftware.com"
      businessName="Acme Software"
      disputes={MOCK_DISPUTES}
      efwAlerts={MOCK_EFW}
      snapshot={config.snap}
      stripeConnected={config.connected}
    />
  );
}
