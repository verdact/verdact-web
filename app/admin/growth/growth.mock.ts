import type { SeriesPoint } from '@/lib/admin/series';
import type { CompareCount } from '@/lib/admin/ranges';
import type { GrowthData, GrowthMetric } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// Realistic sample data so the dev preview (/dev/admin?view=growth) can render
// the rebuilt Growth surface without a Supabase session. NO 'server-only', no
// DB. Numbers are illustrative only — never shown to users.
// ─────────────────────────────────────────────────────────────────────────────

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

/** Build a 30-point daily series ending today (last point = in-progress). */
function series(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({
    date: daysAgo(values.length - 1 - i).slice(0, 10),
    value,
  }));
}

function compare(current: number, prior: number): CompareCount {
  return { current, prior, delta: current - prior };
}

const WAITLIST = series([
  1, 0, 2, 3, 1, 2, 4, 3, 2, 5, 1, 3, 2, 4, 6, 3, 2, 5, 4, 3, 6, 2, 4, 5, 3, 7, 4, 6, 5, 4,
]);
const AUDIT = series([
  3, 5, 4, 6, 8, 5, 7, 9, 6, 10, 8, 7, 11, 9, 12, 8, 10, 13, 9, 11, 14, 10, 12, 15, 11, 13, 16, 12, 14, 9,
]);
const MERCHANTS = series([
  0, 1, 0, 1, 0, 2, 1, 0, 1, 1, 2, 0, 1, 2, 1, 0, 2, 1, 1, 2, 0, 1, 2, 1, 3, 1, 2, 1, 2, 1,
]);
const STRIPE = series([
  0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
]);
const DISPUTES = series([
  1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 2, 1,
]);

const METRICS: GrowthMetric[] = [
  {
    key: 'waitlist',
    label: 'Waitlist signups',
    lifetimeTotal: 84,
    inRange: 96,
    series: WAITLIST,
    compare: compare(96, 71),
    tone: 'verdict',
  },
  {
    key: 'auditLeads',
    label: 'Audit leads',
    lifetimeTotal: 213,
    inRange: 282,
    series: AUDIT,
    compare: compare(282, 241),
    tone: 'verdict',
  },
  {
    key: 'merchants',
    label: 'Merchants',
    lifetimeTotal: 31,
    inRange: 33,
    series: MERCHANTS,
    compare: compare(33, 27),
    tone: 'verdict',
  },
  {
    key: 'stripeActivated',
    label: 'Stripe activations',
    lifetimeTotal: 18,
    inRange: 14,
    series: STRIPE,
    compare: compare(14, 16),
    tone: 'verdict',
  },
  {
    key: 'disputes',
    label: 'Disputes filed',
    lifetimeTotal: 47,
    inRange: 31,
    series: DISPUTES,
    compare: compare(31, 34),
    tone: 'neutral',
  },
];

export const MOCK_GROWTH: GrowthData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  range: '1m',
  rangeLabel: 'Last 30 days',
  compareLabel: 'vs previous 30 days',
  generatedAt: daysAgo(0),
  metrics: METRICS,
  funnel: {
    steps: [
      { label: 'Audit leads', value: 213 },
      { label: 'Waitlist signups', value: 84 },
      { label: 'Merchants', value: 31 },
      { label: 'Stripe activated', value: 18 },
    ],
    leadToMerchant: 31 / 213,
    merchantToActivated: 18 / 31,
  },
};
