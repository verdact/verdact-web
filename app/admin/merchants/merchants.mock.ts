import type { MerchantsData, MerchantRecord, VampOverLineItem } from './data';
import { categorizeMerchant } from '@/lib/admin/categorize';

// ─────────────────────────────────────────────────────────────────────────────
// Sample data for the dev preview (/dev/admin?view=merchants). No DB, no auth.
// Realistic spread: every category, activated + unactivated, one merchant over
// the VAMP line with an alert already drafted, and one over with no draft yet.
// Categories are run through the real categorizer so the preview matches prod.
// ─────────────────────────────────────────────────────────────────────────────

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

type Seed = {
  id: string;
  businessName: string;
  ownerEmail: string;
  createdDaysAgo: number;
  stripeConnected: boolean;
  connectedDaysAgo: number | null;
  vampRatio: number | null;
  persona: string | null;
  customerType: 'b2b' | 'b2c' | 'both' | null;
  deliveryMethod: 'app' | 'email' | 'download' | 'combination' | null;
  productDescription: string | null;
  categoryOverride: 'freelancer' | 'agency' | 'saas' | 'other' | null;
  disputes: { total: number; won: number; lost: number; open: number; avgAmountUsd: number | null; cancelShare: number };
};

const SEEDS: Seed[] = [
  {
    id: '8f2a1c9d-1111-4aaa-8bbb-222233334444',
    businessName: 'Northwind Labs',
    ownerEmail: 'ops@northwindlabs.io',
    createdDaysAgo: 0,
    stripeConnected: true,
    connectedDaysAgo: 0,
    vampRatio: 0.0091,
    persona: 'priya',
    customerType: 'b2b',
    deliveryMethod: 'app',
    productDescription: 'Recurring analytics platform billed monthly.',
    categoryOverride: null,
    disputes: { total: 22, won: 9, lost: 6, open: 4, avgAmountUsd: 89, cancelShare: 0.55 },
  },
  {
    id: '7e1b0c8d-5555-4ccc-9ddd-666677778888',
    businessName: 'Cadence Consulting',
    ownerEmail: 'david@cadence.co',
    createdDaysAgo: 3,
    stripeConnected: true,
    connectedDaysAgo: 2,
    vampRatio: 0.0061,
    persona: null,
    customerType: 'b2b',
    deliveryMethod: 'email',
    productDescription: 'Brand and growth studio for B2B clients.',
    categoryOverride: 'agency',
    disputes: { total: 7, won: 4, lost: 2, open: 1, avgAmountUsd: 1450, cancelShare: 0.1 },
  },
  {
    id: '6d0a9b7c-9999-4eee-8fff-aaaabbbbcccc',
    businessName: 'Marcus Reyes (freelance)',
    ownerEmail: 'marcus.reyes@gmail.com',
    createdDaysAgo: 9,
    stripeConnected: true,
    connectedDaysAgo: 7,
    vampRatio: 0.0029,
    persona: 'marcus',
    customerType: 'b2c',
    deliveryMethod: 'email',
    productDescription: 'Freelance design and illustration.',
    categoryOverride: null,
    disputes: { total: 6, won: 3, lost: 2, open: 0, avgAmountUsd: 180, cancelShare: 0.0 },
  },
  {
    id: '5c9f8a6b-3333-4ddd-9eee-ffff00001111',
    businessName: 'Harbor & Co',
    ownerEmail: 'founder@harborandco.com',
    createdDaysAgo: 1,
    stripeConnected: false,
    connectedDaysAgo: null,
    vampRatio: null,
    persona: null,
    customerType: 'both',
    deliveryMethod: 'combination',
    productDescription: 'Specialty goods marketplace.',
    categoryOverride: null,
    disputes: { total: 0, won: 0, lost: 0, open: 0, avgAmountUsd: null, cancelShare: 0 },
  },
  {
    id: '4b8e7950-2222-4ccc-8ddd-eeee00002222',
    businessName: 'Quill Software',
    ownerEmail: 'support@quillhq.com',
    createdDaysAgo: 14,
    stripeConnected: false,
    connectedDaysAgo: null,
    vampRatio: 0.0081,
    persona: 'priya',
    customerType: 'b2b',
    deliveryMethod: 'app',
    productDescription: 'Subscription document tooling.',
    categoryOverride: null,
    disputes: { total: 11, won: 2, lost: 5, open: 3, avgAmountUsd: 64, cancelShare: 0.64 },
  },
  {
    id: '3a7d6840-4444-4bbb-9ccc-dddd00003333',
    businessName: 'Unnamed workspace',
    ownerEmail: 'newuser@outlook.com',
    createdDaysAgo: 5,
    stripeConnected: false,
    connectedDaysAgo: null,
    vampRatio: null,
    persona: null,
    customerType: null,
    deliveryMethod: null,
    productDescription: null,
    categoryOverride: null,
    disputes: { total: 0, won: 0, lost: 0, open: 0, avgAmountUsd: null, cancelShare: 0 },
  },
];

function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

function bandForRatio(ratio: number | null): MerchantRecord['vamp']['band'] {
  if (ratio == null) return 'unknown';
  if (ratio >= 0.0075) return 'atRisk';
  if (ratio >= 0.005) return 'close';
  return 'healthy';
}

function profileFields(seed: Seed): { filled: number; total: number } {
  const fields = [seed.persona, seed.customerType, seed.deliveryMethod, seed.productDescription];
  const filled = fields.filter((v) => v != null && String(v).trim().length > 0).length;
  return { filled, total: fields.length };
}

function toRecord(seed: Seed): MerchantRecord {
  const { filled, total } = profileFields(seed);
  const category = categorizeMerchant({
    override: seed.categoryOverride,
    persona: seed.persona,
    stripe: null,
    customerType: seed.customerType,
    deliveryMethod: seed.deliveryMethod,
    emailDomain: domainOf(seed.ownerEmail),
    disputeMix: {
      total: seed.disputes.total,
      subscriptionCanceledShare: seed.disputes.cancelShare,
      avgAmountUsd: seed.disputes.avgAmountUsd,
    },
  });

  return {
    id: seed.id,
    businessName: seed.businessName === 'Unnamed workspace' ? null : seed.businessName,
    createdAt: daysAgo(seed.createdDaysAgo),
    ownerEmail: seed.ownerEmail,
    ownerEmailDomain: domainOf(seed.ownerEmail),
    category,
    activation: {
      stripeConnected: seed.stripeConnected,
      connectedAt: seed.connectedDaysAgo == null ? null : daysAgo(seed.connectedDaysAgo),
    },
    vamp: {
      ratio: seed.vampRatio,
      band: bandForRatio(seed.vampRatio),
      calculatedAt: seed.vampRatio == null ? null : daysAgo(1),
      confidence: seed.vampRatio == null ? null : 'medium',
    },
    disputes: {
      total: seed.disputes.total,
      won: seed.disputes.won,
      lost: seed.disputes.lost,
      open: seed.disputes.open,
      avgAmountUsd: seed.disputes.avgAmountUsd,
      subscriptionCanceledShare: seed.disputes.cancelShare,
    },
    profile: {
      persona: seed.persona,
      customerType: seed.customerType,
      deliveryMethod: seed.deliveryMethod,
      productDescription: seed.productDescription,
      categoryOverride: seed.categoryOverride,
      categorySource: seed.categoryOverride ? 'admin_override' : null,
      completeness: total > 0 ? filled / total : 0,
      filledFields: filled,
      totalFields: total,
    },
    daysSinceSignup: seed.createdDaysAgo,
  };
}

const RECORDS: MerchantRecord[] = SEEDS.map(toRecord);

const CATEGORY_BREAKDOWN = RECORDS.reduce(
  (acc, rec) => {
    acc[rec.category.category] += 1;
    return acc;
  },
  { freelancer: 0, agency: 0, saas: 0, other: 0, uncategorized: 0 } as MerchantsData['categoryBreakdown'],
);

const ACTIVATED = RECORDS.filter((r) => r.activation.stripeConnected).length;

// Two over the line: Northwind (alert already drafted) and Quill (none yet).
const VAMP_OVER_LINE: VampOverLineItem[] = RECORDS.filter(
  (r) => r.vamp.ratio != null && r.vamp.ratio >= 0.0075,
)
  .map((r) => {
    const alreadyDrafted = r.id === '8f2a1c9d-1111-4aaa-8bbb-222233334444';
    return {
      merchantId: r.id,
      businessName: r.businessName,
      ratio: r.vamp.ratio as number,
      calculatedAt: r.vamp.calculatedAt,
      overLineSince: daysAgo(6),
      drafted: alreadyDrafted,
      draftedAt: alreadyDrafted ? daysAgo(2) : null,
      sentAt: null,
    };
  })
  .sort((a, b) => b.ratio - a.ratio);

export const MOCK_MERCHANTS: MerchantsData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  merchants: RECORDS,
  categoryBreakdown: CATEGORY_BREAKDOWN,
  totals: {
    merchants: RECORDS.length,
    activated: ACTIVATED,
    unactivated: RECORDS.length - ACTIVATED,
    overLine: VAMP_OVER_LINE.length,
  },
  activationRate: RECORDS.length > 0 ? ACTIVATED / RECORDS.length : null,
  vampOverLine: VAMP_OVER_LINE,
};
