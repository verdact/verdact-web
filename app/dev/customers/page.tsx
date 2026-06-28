import { notFound } from 'next/navigation';
import { CustomersView, isCustomerSort, type CustomerSort } from '../../dashboard/customers/customers-view';
import type { CustomerGroup } from '@/lib/dal';
import { buildMergeSuggestions, partitionSuggestions } from '@/lib/customers/suggestions';
import { applyConfirmedMerges } from '@/lib/customers/resolve';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the per-customer evidence view (R8) with sample data.
// The real /dashboard/customers is auth-gated.
// Use ?state=repeat|single|empty|suggest. 404s in production.
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

// Two near-duplicate pairs that trip the suggestion engine: a same-name pair on
// different emails, and a Gmail dot/+tag normalized-email pair.
const SUGGEST_GROUPS: CustomerGroup[] = [
  { ...REPEAT_GROUPS[0] },
  {
    customerKey: 'dana@gmail.com',
    customerEmail: 'dana@gmail.com',
    customerName: 'Northwind Consulting',
    totalAmount: 30000,
    openCount: 1,
    wonCount: 0,
    lostCount: 0,
    disputes: [
      {
        id: 'd6',
        processor_dispute_id: 'du_f',
        amount: 30000,
        currency: 'usd',
        reason: 'Services not received',
        network: 'visa',
        status: 'needs_response',
        due_by: daysAgo(-4),
        outcome: null,
        created_at: daysAgo(2),
      },
    ],
  },
  {
    customerKey: 'jo.doe+stripe@gmail.com',
    customerEmail: 'jo.doe+stripe@gmail.com',
    customerName: 'Jo Doe',
    totalAmount: 12000,
    openCount: 0,
    wonCount: 0,
    lostCount: 0,
    disputes: [
      {
        id: 'd7',
        processor_dispute_id: 'du_g',
        amount: 12000,
        currency: 'usd',
        reason: 'Duplicate charge',
        network: 'visa',
        status: 'under_review',
        due_by: daysAgo(-10),
        outcome: null,
        created_at: daysAgo(6),
      },
    ],
  },
  {
    customerKey: 'jodoe@gmail.com',
    customerEmail: 'jodoe@gmail.com',
    customerName: 'Jo Doe',
    totalAmount: 9000,
    openCount: 0,
    wonCount: 0,
    lostCount: 0,
    disputes: [
      {
        id: 'd8',
        processor_dispute_id: 'du_h',
        amount: 9000,
        currency: 'usd',
        reason: 'Product not as described',
        network: 'mastercard',
        status: 'lost',
        due_by: null,
        outcome: 'lost',
        created_at: daysAgo(30),
      },
    ],
  },
];

export default async function CustomersPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; sort?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { state, sort: sortParam } = await searchParams;
  const sort: CustomerSort = isCustomerSort(sortParam) ? sortParam : 'repeat';

  const groups: CustomerGroup[] =
    state === 'empty'
      ? []
      : state === 'single'
        ? [REPEAT_GROUPS[1]]
        : state === 'suggest'
          ? SUGGEST_GROUPS
          : [...REPEAT_GROUPS, UNLINKED];

  const { autoMerges, prompts } = partitionSuggestions(buildMergeSuggestions(groups, new Set()));
  const mergedGroups = applyConfirmedMerges(
    groups,
    autoMerges.map((s) => ({ primaryKey: s.primaryKey, linkedKey: s.linkedKey, decision: 'merge' as const })),
  );

  return (
    <CustomersView
      email="founder@acmesoftware.com"
      businessName="Acme Software"
      groups={mergedGroups}
      suggestions={prompts}
      autoMerged={autoMerges}
      sort={sort}
      stripeConnected={state !== 'disconnected'}
    />
  );
}
