import { notFound } from 'next/navigation';
import { CustomersView } from '../../dashboard/customers/customers-view';
import type { CustomerGroup } from '@/lib/dal';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the per-customer evidence view (R8) with sample data.
// The real /dashboard/customers is auth-gated. Use ?state=repeat|single|empty.
// 404s in production.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Customers preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const REPEAT_GROUPS: CustomerGroup[] = [
  {
    customerKey: 'dana@northwind.co',
    customerEmail: 'dana@northwind.co',
    customerName: 'Northwind Consulting',
    totalAmount: 720000,
    openCount: 1,
    wonCount: 1,
    lostCount: 1,
    disputes: [
      {
        id: 'd1',
        processor_dispute_id: 'du_a',
        amount: 240000,
        currency: 'usd',
        reason: 'Services not received',
        network: 'visa',
        status: 'needs_response',
        due_by: daysAgo(-5),
        outcome: null,
        created_at: daysAgo(3),
      },
      {
        id: 'd2',
        processor_dispute_id: 'du_b',
        amount: 240000,
        currency: 'usd',
        reason: 'Subscription canceled',
        network: 'visa',
        status: 'lost',
        due_by: null,
        outcome: 'lost',
        created_at: daysAgo(45),
      },
      {
        id: 'd3',
        processor_dispute_id: 'du_c',
        amount: 240000,
        currency: 'usd',
        reason: 'Services not received',
        network: 'mastercard',
        status: 'won',
        due_by: null,
        outcome: 'won',
        created_at: daysAgo(95),
      },
    ],
  },
  {
    customerKey: 'sam@acme.io',
    customerEmail: 'sam@acme.io',
    customerName: null,
    totalAmount: 18000,
    openCount: 0,
    wonCount: 0,
    lostCount: 1,
    disputes: [
      {
        id: 'd4',
        processor_dispute_id: 'du_d',
        amount: 18000,
        currency: 'usd',
        reason: 'Product not as described',
        network: 'visa',
        status: 'lost',
        due_by: null,
        outcome: 'lost',
        created_at: daysAgo(20),
      },
    ],
  },
];

const UNLINKED: CustomerGroup = {
  customerKey: null,
  customerEmail: null,
  customerName: null,
  totalAmount: 9900,
  openCount: 1,
  wonCount: 0,
  lostCount: 0,
  disputes: [
    {
      id: 'd5',
      processor_dispute_id: 'du_e',
      amount: 9900,
      currency: 'usd',
      reason: 'Unrecognized',
      network: 'visa',
      status: 'needs_response',
      due_by: daysAgo(-2),
      outcome: null,
      created_at: daysAgo(1),
    },
  ],
};

export default async function CustomersPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { state } = await searchParams;

  const groups: CustomerGroup[] =
    state === 'empty'
      ? []
      : state === 'single'
        ? [REPEAT_GROUPS[1]]
        : [...REPEAT_GROUPS, UNLINKED];

  return (
    <CustomersView
      email="founder@acmesoftware.com"
      businessName="Acme Software"
      groups={groups}
      stripeConnected={state !== 'disconnected'}
    />
  );
}
