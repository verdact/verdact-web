import { notFound } from 'next/navigation';
import { DisputesView, isDisputeFilter, type DisputeFilter } from '../../dashboard/disputes/disputes-view';
import { type Dispute } from '@/lib/dal';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of /dashboard/disputes with sample data. The real
// route is auth-gated. Use ?filter=needs-action|open|all and ?stripe=off to
// preview the value-forward not-connected state. 404s in production.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Disputes preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const inDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
const daysAgo = (n: number): string => inDays(-n);

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
  {
    id: 'dp_preview_4',
    processor_dispute_id: 'du_1Preview0004',
    processor_charge_id: 'ch_3QExample0004StUvWx',
    amount: 32000,
    currency: 'usd',
    reason: 'Credit not processed',
    network: 'visa',
    status: 'won',
    due_by: null,
    ce3_eligible: false,
    outcome: 'won',
    created_at: daysAgo(40),
  },
];

export default async function DisputesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; stripe?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const params = await searchParams;
  const filter: DisputeFilter = isDisputeFilter(params.filter) ? params.filter : 'needs-action';
  const stripeConnected = params.stripe !== 'off';

  return (
    <DisputesView
      email="founder@acmesoftware.com"
      businessName="Acme Software"
      disputes={stripeConnected ? MOCK_DISPUTES : []}
      stripeConnected={stripeConnected}
      filter={filter}
    />
  );
}
