import type { SeriesPoint } from '@/lib/admin/series';
import { scoreAuditLead, scoreUnactivatedMerchant, draftVampAlert } from '@/lib/admin/convert';
import type { CommandData } from './command-data';

// ─────────────────────────────────────────────────────────────────────────────
// Realistic sample data for the COMMAND surface so the dev preview can render
// the cockpit without an authenticated Supabase session. No 'server-only', no
// DB. Drafts and scores are produced by the SAME pure helpers the loader uses,
// so the preview reflects real copy and ranking, not invented strings.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (n: number): string => new Date(NOW - n * DAY_MS).toISOString();

function mkSeries(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({ date: daysAgo(values.length - 1 - i).slice(0, 10), value }));
}

// Audit-lead sample rows (drive the worklist + recent leads drawer).
const AUDIT_ROWS = [
  {
    id: 'a1',
    email: 'ops@cadence.co',
    business_name: 'Cadence Consulting',
    total_disputes: 18,
    lost_disputes: 9,
    should_have_won_count: 6,
    comms_hinged_count: 4,
    estimated_dispute_rate: 0.011,
    standing_band: 'atRisk',
    converted_merchant_id: null,
    created_at: daysAgo(2),
  },
  {
    id: 'a2',
    email: 'founder@brightloom.io',
    business_name: 'Brightloom',
    total_disputes: 11,
    lost_disputes: 4,
    should_have_won_count: 3,
    comms_hinged_count: 2,
    estimated_dispute_rate: 0.006,
    standing_band: 'close',
    converted_merchant_id: null,
    created_at: daysAgo(5),
  },
  {
    id: 'a3',
    email: 'team@harborgoods.com',
    business_name: 'Harbor Goods',
    total_disputes: 7,
    lost_disputes: 2,
    should_have_won_count: 1,
    comms_hinged_count: 1,
    estimated_dispute_rate: 0.004,
    standing_band: 'healthy',
    converted_merchant_id: null,
    created_at: daysAgo(9),
  },
];

const UNACTIVATED_MERCHANT = {
  id: '8f2a1c9d-1111-4aaa-8bbb-222233334444',
  business_name: 'Northwind Labs',
  created_at: daysAgo(1),
};

const AT_RISK_NAME = 'Cadence Consulting';
const AT_RISK_RATIO_PCT = 0.92;

export const MOCK_COMMAND: CommandData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  range: '1m',
  rangeLabel: 'Last 30 days',

  totals: {
    waitlist: 84,
    auditLeads: 213,
    merchants: 31,
    stripeConnected: 18,
    disputes: 47,
    openDisputes: 12,
  },

  kpis: {
    waitlist: {
      current: 19,
      prior: 13,
      delta: 6,
      spark: mkSeries([0, 1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 9]),
    },
    auditLeads: {
      current: 34,
      prior: 28,
      delta: 6,
      spark: mkSeries([2, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 16, 19]),
    },
    merchants: {
      current: 7,
      prior: 4,
      delta: 3,
      spark: mkSeries([0, 0, 1, 0, 1, 1, 0, 2, 1, 1, 2, 1, 2, 3]),
    },
    disputes: {
      current: 9,
      prior: 12,
      delta: -3,
      spark: mkSeries([1, 0, 2, 1, 3, 2, 1, 0, 2, 1, 0, 1, 2, 1]),
    },
  },

  funnel: [
    { label: 'Audit leads', value: 213 },
    { label: 'Waitlist signups', value: 84 },
    { label: 'Merchants', value: 31 },
    { label: 'Stripe connected', value: 18 },
  ],
  conversionRate: 31 / 213,
  activationRate: 18 / 31,

  outcomes: { won: 19, lost: 8, open: 12, warningClosed: 8 },
  vamp: { healthy: 9, close: 5, atRisk: 4, notScored: 13, measured: 18 },
  vampAtRisk: [
    {
      merchantId: 'm-at-risk-1',
      businessName: AT_RISK_NAME,
      ratioPct: AT_RISK_RATIO_PCT,
      draft: draftVampAlert({ businessName: AT_RISK_NAME, ratioPct: AT_RISK_RATIO_PCT }),
    },
    {
      merchantId: 'm-at-risk-2',
      businessName: 'Brightloom',
      ratioPct: 0.81,
      draft: draftVampAlert({ businessName: 'Brightloom', ratioPct: 0.81 }),
    },
  ],

  worklist: [
    { ...scoreAuditLead(AUDIT_ROWS[0], NOW), href: '/admin/leads' },
    { ...scoreAuditLead(AUDIT_ROWS[1], NOW), href: '/admin/leads' },
    {
      ...scoreUnactivatedMerchant(
        { merchant: UNACTIVATED_MERCHANT, daysSinceSignup: 1, profileComplete: true },
        NOW,
      ),
      href: '/admin/merchants',
    },
    { ...scoreAuditLead(AUDIT_ROWS[2], NOW), href: '/admin/leads' },
  ].sort((a, b) => b.score - a.score),
  worklistTotal: 12,

  recentSignups: [
    { id: 'w1', email: 'founder@acme.dev', source: 'signup', created_at: daysAgo(0) },
    { id: 'w2', email: 'ops@northwind.io', source: 'audit', created_at: daysAgo(1) },
    { id: 'w3', email: 'hello@brightloom.io', source: 'referral', created_at: daysAgo(2) },
  ],
  recentAuditLeads: AUDIT_ROWS,
  recentMerchants: [
    { id: UNACTIVATED_MERCHANT.id, business_name: 'Northwind Labs', created_at: daysAgo(1) },
    { id: '7e1b0c8d-5555-4ccc-9ddd-666677778888', business_name: 'Acme Software', created_at: daysAgo(3) },
  ],

  feed: [
    { id: 'f1', when: daysAgo(0), kind: 'merchant', text: 'New merchant: Northwind Labs' },
    { id: 'f2', when: daysAgo(0), kind: 'waitlist', text: 'Waitlist signup: founder@acme.dev' },
    { id: 'f3', when: daysAgo(1), kind: 'admin', text: 'Invite approved by rishi@verdact.io' },
    { id: 'f4', when: daysAgo(2), kind: 'audit', text: 'Audit lead: Cadence Consulting' },
    { id: 'f5', when: daysAgo(2), kind: 'waitlist', text: 'Waitlist signup: ops@northwind.io' },
    { id: 'f6', when: daysAgo(3), kind: 'merchant', text: 'New merchant: Acme Software' },
  ],
};
