import type { DisputesData, DisputeRecord } from './data';
import { aggregateOutcomes, type ReasoningInput } from '@/lib/admin/outcome-reasoning';
import type { PlatformAdmin } from '@/lib/admin/platform-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Dev-preview sample data for the disputes surface. NO 'server-only', no DB.
// The aggregate is computed through the real aggregateOutcomes() brain so the
// preview shows the same honest themes the live loader would, never a hand-faked
// roll-up. Sample disputes deliberately cover won / lost / warning_closed / open
// and at least one should-have-won candidate.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ADMIN: PlatformAdmin = {
  userId: 'preview',
  email: 'rishi@verdact.io',
  emailNormalized: 'rishi@verdact.io',
  role: 'owner',
  source: 'database',
};

const daysAgo = (n: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString();
};

type Sample = {
  id: string;
  merchantName: string;
  amountCents: number;
  currency: string;
  network: string;
  reason: string;
  status: string;
  outcome: 'won' | 'lost' | 'warning_closed' | null;
  ce3Eligible: boolean;
  readiness: { percent: number; present: string[]; missing: string[] } | null;
  createdAt: string;
};

const SAMPLES: Sample[] = [
  {
    id: 'dp_2a1f9c7d4e3b',
    merchantName: 'Northwind Labs',
    amountCents: 18900,
    currency: 'USD',
    network: 'visa',
    reason: 'product_not_received',
    status: 'won',
    outcome: 'won',
    ce3Eligible: false,
    readiness: { percent: 83, present: ['charge_attached', 'delivery_proof', 'policy', 'narrative', 'product_description'], missing: ['qa_clear'] },
    createdAt: daysAgo(2),
  },
  {
    id: 'dp_7b2e0d8a1c6f',
    merchantName: 'Cadence Consulting',
    amountCents: 42000,
    currency: 'USD',
    network: 'visa',
    reason: 'subscription_canceled',
    status: 'won',
    outcome: 'won',
    ce3Eligible: false,
    readiness: { percent: 67, present: ['charge_attached', 'delivery_proof', 'narrative', 'policy'], missing: ['product_description', 'qa_clear'] },
    createdAt: daysAgo(5),
  },
  {
    id: 'dp_3c9a4f1b2d7e',
    merchantName: 'Acme Software',
    amountCents: 12500,
    currency: 'USD',
    network: 'visa',
    reason: 'product_not_received',
    status: 'lost',
    outcome: 'lost',
    ce3Eligible: false,
    // Lost but winnable: a strong-tier reason that went out missing delivery proof.
    readiness: { percent: 33, present: ['charge_attached', 'narrative'], missing: ['delivery_proof', 'policy', 'product_description', 'qa_clear'] },
    createdAt: daysAgo(8),
  },
  {
    id: 'dp_5d1b8e2a9f4c',
    merchantName: 'Harbor Goods',
    amountCents: 8900,
    currency: 'USD',
    network: 'visa',
    reason: 'subscription_canceled',
    status: 'lost',
    outcome: 'lost',
    ce3Eligible: false,
    // Another should-have-won: comms-wedge reason lost without the policy on file.
    readiness: { percent: 40, present: ['charge_attached', 'delivery_proof'], missing: ['policy', 'product_description', 'narrative', 'qa_clear'] },
    createdAt: daysAgo(11),
  },
  {
    id: 'dp_9e4c1a7b3d2f',
    merchantName: 'Brightline Studio',
    amountCents: 6400,
    currency: 'USD',
    network: 'mastercard',
    reason: 'credit_not_processed',
    status: 'lost',
    outcome: 'lost',
    ce3Eligible: false,
    // Weak-tier reason: loss correlates with the reason, not a packet gap.
    readiness: { percent: 80, present: ['charge_attached', 'delivery_proof', 'policy', 'narrative'], missing: ['product_description'] },
    createdAt: daysAgo(13),
  },
  {
    id: 'dp_1f6d3b9c8a5e',
    merchantName: 'Meridian Tools',
    amountCents: 23400,
    currency: 'USD',
    network: 'visa',
    reason: 'fraudulent',
    status: 'warning_closed',
    outcome: 'warning_closed',
    ce3Eligible: true,
    readiness: null,
    createdAt: daysAgo(6),
  },
  {
    id: 'dp_4a8c2e1d7b0f',
    merchantName: 'Northwind Labs',
    amountCents: 15000,
    currency: 'USD',
    network: 'visa',
    reason: 'product_not_received',
    status: 'needs_response',
    outcome: null,
    ce3Eligible: false,
    readiness: { percent: 50, present: ['charge_attached', 'delivery_proof', 'narrative'], missing: ['policy', 'product_description', 'qa_clear'] },
    createdAt: daysAgo(1),
  },
  {
    id: 'dp_6b3f9d2a4c1e',
    merchantName: 'Cadence Consulting',
    amountCents: 31200,
    currency: 'USD',
    network: 'amex',
    reason: 'fraudulent',
    status: 'under_review',
    outcome: null,
    ce3Eligible: true,
    readiness: null,
    createdAt: daysAgo(3),
  },
  {
    id: 'dp_8c5a1e7b3f9d',
    merchantName: 'Acme Software',
    amountCents: 9900,
    currency: 'USD',
    network: 'mastercard',
    reason: 'product_unacceptable',
    status: 'submitted',
    outcome: null,
    ce3Eligible: false,
    readiness: { percent: 67, present: ['charge_attached', 'delivery_proof', 'product_description', 'narrative'], missing: ['policy', 'qa_clear'] },
    createdAt: daysAgo(4),
  },
];

function toRecord(sample: Sample): DisputeRecord {
  const reasoning: ReasoningInput = {
    reason: sample.reason,
    network: sample.network,
    outcome: sample.outcome,
    status: sample.status,
    ce3Eligible: sample.ce3Eligible,
    readiness: sample.readiness,
    amountCents: sample.amountCents,
  };
  return {
    id: sample.id,
    merchantId: `mrc_${sample.id.slice(3, 11)}`,
    merchantName: sample.merchantName,
    amountCents: sample.amountCents,
    currency: sample.currency,
    network: sample.network,
    reason: sample.reason,
    status: sample.status,
    outcome: sample.outcome,
    ce3Eligible: sample.ce3Eligible,
    readiness: sample.readiness,
    createdAt: sample.createdAt,
    reasoning,
  };
}

const DISPUTE_RECORDS: DisputeRecord[] = SAMPLES.map(toRecord);

export const MOCK_DISPUTES: DisputesData = {
  admin: MOCK_ADMIN,
  disputes: DISPUTE_RECORDS,
  aggregate: aggregateOutcomes(DISPUTE_RECORDS.map((rec) => rec.reasoning)),
};
