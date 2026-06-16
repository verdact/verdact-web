import type { LeadsData, LeadWaitlistRow, LeadAuditRow, LeadUnactivatedRow } from './data';
import {
  scoreAuditLead,
  scoreWaitlistSignup,
  scoreUnactivatedMerchant,
  rankConvertItems,
  type ConvertItem,
} from '@/lib/admin/convert';

// ─────────────────────────────────────────────────────────────────────────────
// Sample data for the dev preview. No DB, no 'server-only'. The worklist is built
// by running the REAL scorers over these rows so the preview reflects production
// ranking exactly, not a hand-faked order.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (n: number): string => new Date(NOW - n * DAY_MS).toISOString();

const WAITLIST_ROWS: LeadWaitlistRow[] = [
  {
    id: 'w1',
    email: 'founder@acme.dev',
    source: 'audit',
    created_at: daysAgo(0),
    geo_country: 'US',
    geo_region: 'California',
  },
  {
    id: 'w2',
    email: 'ops@northwind.io',
    source: 'signup',
    created_at: daysAgo(3),
    geo_country: 'GB',
    geo_region: 'England',
  },
  {
    id: 'w3',
    email: 'maria@gmail.com',
    source: 'signup',
    created_at: daysAgo(12),
    geo_country: null,
    geo_region: null,
  },
];

const AUDIT_ROWS: LeadAuditRow[] = [
  {
    id: 'a1',
    email: 'cadence@example.com',
    business_name: 'Cadence Consulting',
    total_disputes: 18,
    lost_disputes: 9,
    should_have_won_count: 6,
    comms_hinged_count: 4,
    estimated_dispute_rate: 0.012,
    standing_band: 'atRisk',
    converted_merchant_id: null,
    converted_at: null,
    source: 'audit_tool',
    created_at: daysAgo(1),
    geo_country: 'US',
    geo_region: 'New York',
  },
  {
    id: 'a2',
    email: 'team@brightledger.co',
    business_name: 'Bright Ledger',
    total_disputes: 11,
    lost_disputes: 4,
    should_have_won_count: 2,
    comms_hinged_count: 3,
    estimated_dispute_rate: 0.006,
    standing_band: 'close',
    converted_merchant_id: null,
    converted_at: null,
    source: 'audit_tool',
    created_at: daysAgo(5),
    geo_country: 'CA',
    geo_region: 'Ontario',
  },
  {
    id: 'a3',
    email: 'hello@stillwater.app',
    business_name: 'Stillwater',
    total_disputes: 5,
    lost_disputes: 1,
    should_have_won_count: 0,
    comms_hinged_count: 0,
    estimated_dispute_rate: 0.003,
    standing_band: 'healthy',
    converted_merchant_id: 'm-converted-1',
    converted_at: daysAgo(2),
    source: 'audit_tool',
    created_at: daysAgo(9),
    geo_country: null,
    geo_region: null,
  },
];

const UNACTIVATED_ROWS: LeadUnactivatedRow[] = [
  {
    id: 'm1',
    businessName: 'Harbor Goods',
    createdAt: daysAgo(2),
    daysSinceSignup: 2,
    profileComplete: true,
  },
  {
    id: 'm2',
    businessName: 'Pinecrest Studio',
    createdAt: daysAgo(8),
    daysSinceSignup: 8,
    profileComplete: false,
  },
];

function buildWorklist(): ConvertItem[] {
  const auditItems = AUDIT_ROWS.map((row) =>
    scoreAuditLead(
      {
        id: row.id,
        email: row.email,
        business_name: row.business_name,
        total_disputes: row.total_disputes,
        lost_disputes: row.lost_disputes,
        should_have_won_count: row.should_have_won_count,
        comms_hinged_count: row.comms_hinged_count,
        estimated_dispute_rate: row.estimated_dispute_rate,
        standing_band: row.standing_band,
        converted_merchant_id: row.converted_merchant_id,
        created_at: row.created_at,
      },
      NOW,
    ),
  );
  const waitlistItems = WAITLIST_ROWS.map((row) =>
    scoreWaitlistSignup(
      { id: row.id, email: row.email, source: row.source, created_at: row.created_at },
      NOW,
    ),
  );
  const unactivatedItems = UNACTIVATED_ROWS.map((row) =>
    scoreUnactivatedMerchant(
      {
        merchant: { id: row.id, business_name: row.businessName, created_at: row.createdAt },
        daysSinceSignup: row.daysSinceSignup,
        profileComplete: row.profileComplete,
      },
      NOW,
    ),
  );
  return rankConvertItems([...auditItems, ...waitlistItems, ...unactivatedItems]);
}

const WORKLIST = buildWorklist();

export const MOCK_LEADS: LeadsData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  worklist: WORKLIST,
  waitlistRows: WAITLIST_ROWS,
  auditRows: AUDIT_ROWS,
  unactivatedRows: UNACTIVATED_ROWS,
  counts: {
    worklist: WORKLIST.length,
    waitlist: WAITLIST_ROWS.length,
    audit: AUDIT_ROWS.length,
    unactivated: UNACTIVATED_ROWS.length,
  },
};
