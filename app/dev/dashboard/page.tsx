import { notFound } from 'next/navigation';
import { DashboardView, type StripeConnection } from '../../dashboard/dashboard-view';
import { type Dispute, type EfwAlert } from '@/lib/dal';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of the dashboard with sample data.
// The real /dashboard is auth-gated by proxy.ts middleware and can't render
// without a Supabase session, so this route (outside the protected path) lets
// the rebuilt DashboardView be inspected directly. 404s in production.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Dashboard preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const inDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
const daysAgo = (n: number): string => inDays(-n);

const MOCK_CONNECTION: StripeConnection = {
  id: 'pc_preview',
  processor_account_id: 'acct_1QExAmpLeWxYz000',
  livemode: false,
  connected_at: daysAgo(42),
};

const MOCK_DISPUTES: Dispute[] = [
  {
    id: 'dp_preview_1',
    processor_dispute_id: 'du_1Preview0001',
    processor_charge_id: 'ch_3QExample0001AbCdEf',
    amount: 48000,
    currency: 'usd',
    reason: 'Product not received',
    network: 'visa',
    status: 'needs_response',
    due_by: inDays(2),
    ce3_eligible: false,
    outcome: null,
    created_at: daysAgo(3),
  },
  {
    id: 'dp_preview_2',
    processor_dispute_id: 'du_1Preview0002',
    processor_charge_id: 'ch_3QExample0002GhIjKl',
    amount: 125000,
    currency: 'usd',
    reason: 'Subscription canceled',
    network: 'visa',
    status: 'needs_response',
    due_by: inDays(6),
    ce3_eligible: false,
    outcome: null,
    created_at: daysAgo(2),
  },
  {
    id: 'dp_preview_3',
    processor_dispute_id: 'du_1Preview0003',
    processor_charge_id: 'ch_3QExample0003MnOpQr',
    amount: 8900,
    currency: 'usd',
    reason: 'Duplicate charge',
    network: 'mastercard',
    status: 'under_review',
    due_by: inDays(11),
    ce3_eligible: false,
    outcome: null,
    created_at: daysAgo(5),
  },
];

const MOCK_EFW: EfwAlert[] = [
  {
    id: 'efw_preview_1',
    processor_alert_id: 'issfr_1Preview0001',
    processor_charge_id: 'ch_3QExample0009StUvWx',
    fraud_type: 'Visa TC40 fraud notice',
    actionable: true,
    merchant_decision: 'pending',
    created_at: daysAgo(1),
  },
];

export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <DashboardView
      email="founder@acmesoftware.com"
      businessName="Acme Software"
      disputes={MOCK_DISPUTES}
      efwAlerts={MOCK_EFW}
      vampRatio={0.0061}
      stripeConnection={MOCK_CONNECTION}
      justConnected={false}
      stripeError={null}
    />
  );
}
