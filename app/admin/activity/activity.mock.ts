import type { ActivityData, ActivityEvent, ActivityKind } from './data';

// Sample data for the dev preview (no DB, no auth). Realistic spread across all
// five kinds and a 0–60 day window so search, kind filters, the time window, and
// load-more all have something to chew on.

const hoursAgo = (h: number): string => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number): string => hoursAgo(d * 24);

const EVENTS: ActivityEvent[] = [
  { id: 'merchant-m1', at: hoursAgo(2), kind: 'merchant', text: 'New merchant: Northwind Labs', detail: null },
  { id: 'waitlist-w1', at: hoursAgo(3), kind: 'waitlist', text: 'Waitlist signup: founder@acme.dev', detail: 'via signup' },
  { id: 'dispute-new-d1', at: hoursAgo(5), kind: 'dispute', text: 'New dispute: Product not received', detail: 'Visa' },
  { id: 'admin-e1', at: hoursAgo(8), kind: 'admin', text: 'Invite approved', detail: 'by rishi@verdact.io' },
  { id: 'audit-a1', at: hoursAgo(11), kind: 'audit', text: 'Audit lead: Cadence Consulting', detail: 'getting close' },
  { id: 'dispute-outcome-d2', at: daysAgo(1), kind: 'dispute', text: 'Dispute won: Subscription cancelled', detail: 'Mastercard' },
  { id: 'merchant-m2', at: daysAgo(1), kind: 'merchant', text: 'New merchant: Acme Software', detail: null },
  { id: 'waitlist-w2', at: daysAgo(1), kind: 'waitlist', text: 'Waitlist signup: ops@northwind.io', detail: 'via audit' },
  { id: 'admin-e2', at: daysAgo(2), kind: 'admin', text: 'Economics inputs updated', detail: 'by rishi@verdact.io' },
  { id: 'dispute-new-d3', at: daysAgo(2), kind: 'dispute', text: 'New dispute: Duplicate charge', detail: 'Amex' },
  { id: 'audit-a2', at: daysAgo(3), kind: 'audit', text: 'Audit lead: Harbor Goods', detail: 'over the line · converted to merchant' },
  { id: 'dispute-outcome-d4', at: daysAgo(4), kind: 'dispute', text: 'Dispute lost: Fraudulent transaction', detail: 'Visa' },
  { id: 'waitlist-w3', at: daysAgo(5), kind: 'waitlist', text: 'Waitlist signup: hello@meridian.app', detail: null },
  { id: 'admin-e3', at: daysAgo(6), kind: 'admin', text: 'VAMP alert drafted', detail: 'by rishi@verdact.io' },
  { id: 'merchant-m3', at: daysAgo(7), kind: 'merchant', text: 'New merchant: Meridian Apps', detail: null },
  { id: 'audit-a3', at: daysAgo(9), kind: 'audit', text: 'Audit lead: founder@solo.dev', detail: 'too early to score' },
  { id: 'dispute-new-d5', at: daysAgo(12), kind: 'dispute', text: 'New dispute: Credit not processed', detail: 'Discover' },
  { id: 'admin-e4', at: daysAgo(14), kind: 'admin', text: 'Admission mode changed', detail: 'by rishi@verdact.io' },
  { id: 'waitlist-w4', at: daysAgo(18), kind: 'waitlist', text: 'Waitlist signup: team@brightline.io', detail: 'via signup' },
  { id: 'merchant-m4', at: daysAgo(22), kind: 'merchant', text: 'New merchant: Brightline Inc', detail: null },
  { id: 'audit-a4', at: daysAgo(27), kind: 'audit', text: 'Audit lead: Cobalt Studio', detail: 'healthy standing' },
  { id: 'dispute-outcome-d6', at: daysAgo(33), kind: 'dispute', text: 'Dispute closed (warning): Service not as described', detail: 'Mastercard' },
  { id: 'admin-e5', at: daysAgo(41), kind: 'admin', text: 'Admin added', detail: 'by rishi@verdact.io' },
  { id: 'waitlist-w5', at: daysAgo(52), kind: 'waitlist', text: 'Waitlist signup: ceo@latch.co', detail: null },
];

function countByKind(events: ActivityEvent[]): Record<ActivityKind, number> {
  const counts: Record<ActivityKind, number> = { admin: 0, merchant: 0, waitlist: 0, audit: 0, dispute: 0 };
  for (const event of events) counts[event.kind] += 1;
  return counts;
}

export const MOCK_ACTIVITY: ActivityData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  events: EVENTS,
  counts: countByKind(EVENTS),
  truncated: false,
};
