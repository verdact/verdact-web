import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import {
  categorizeMerchant,
  type CategoryResult,
  type MerchantCategory,
  type CustomerType,
  type DeliveryMethod,
} from '@/lib/admin/categorize';

// ─────────────────────────────────────────────────────────────────────────────
// Merchants surface loader. Joins merchants + profiles + processor connections +
// latest VAMP snapshot + per-merchant dispute aggregates + the owner's email,
// then runs the (pure, deterministic) categorizer per merchant. Honest data only:
// every slice degrades to empty/zero on a failed query, and signals that are not
// captured yet (Stripe business signals, category column) are simply absent.
// ─────────────────────────────────────────────────────────────────────────────

const VAMP_STRIPE_LINE = 0.0075; // over-the-line: estimated VAMP ratio >= 0.75%
const VAMP_HEALTHY_BELOW = 0.005; // healthy below 0.5%; close in between
const SUBSCRIPTION_CANCEL_MATCHER = /cancel/i; // reason text → subscription-cancel signal
const CENTS_PER_DOLLAR = 100;
const MAX_MERCHANTS = 1000;
const MAX_DISPUTES = 5000;
const MAX_VAMP_SNAPSHOTS = 2000;

type ServiceClient = ReturnType<typeof createServiceClient>;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

// ── Raw row shapes (selected defensively) ────────────────────────────────────

type MerchantBaseRow = {
  id: string;
  business_name: string | null;
  created_at: string;
};

type ProfileRow = {
  merchant_id: string;
  persona: string | null;
  customer_type: CustomerType | null;
  delivery_method: DeliveryMethod | null;
  product_description: string | null;
  category?: MerchantCategory | null;
  category_source?: string | null;
};

type ProcessorRow = {
  merchant_id: string;
  processor: string | null;
  connection_status: string | null;
  connected_at: string | null;
};

type VampRow = {
  merchant_id: string;
  estimated_vamp_ratio: number | string | null;
  calculated_at: string;
  confidence_level: string | null;
};

type DisputeRow = {
  merchant_id: string;
  amount: number | null;
  reason: string | null;
  outcome: string | null;
  status: string | null;
};

type MerchantUserRow = {
  merchant_id: string;
  user_id: string | null;
  role: string | null;
  status: string | null;
};

type VampNotificationRow = {
  merchant_id: string;
  band: string | null;
  over_line_since: string | null;
  drafted_at: string | null;
  drafted_by: string | null;
  sent_at: string | null;
  channel: string | null;
};

// ── Derived view-facing shapes ───────────────────────────────────────────────

export type MerchantDisputeSummary = {
  total: number;
  won: number;
  lost: number;
  open: number;
  avgAmountUsd: number | null;
  subscriptionCanceledShare: number;
};

export type MerchantActivation = {
  stripeConnected: boolean;
  connectedAt: string | null;
};

export type MerchantVampStanding = {
  ratio: number | null; // fraction, e.g. 0.0082
  band: 'healthy' | 'close' | 'atRisk' | 'unknown';
  calculatedAt: string | null;
  confidence: string | null;
};

export type MerchantProfileSummary = {
  persona: string | null;
  customerType: CustomerType | null;
  deliveryMethod: DeliveryMethod | null;
  productDescription: string | null;
  categoryOverride: MerchantCategory | null;
  categorySource: string | null;
  completeness: number; // 0–1 fraction of profile fields captured
  filledFields: number;
  totalFields: number;
};

export type MerchantRecord = {
  id: string;
  businessName: string | null;
  createdAt: string;
  ownerEmail: string | null;
  ownerEmailDomain: string | null;
  category: CategoryResult;
  activation: MerchantActivation;
  vamp: MerchantVampStanding;
  disputes: MerchantDisputeSummary;
  profile: MerchantProfileSummary;
  daysSinceSignup: number;
};

export type VampOverLineItem = {
  merchantId: string;
  businessName: string | null;
  ratio: number;
  calculatedAt: string | null;
  overLineSince: string | null;
  drafted: boolean;
  draftedAt: string | null;
  sentAt: string | null;
};

export type CategoryBreakdown = Record<MerchantCategory, number>;

export type MerchantsData = {
  admin: PlatformAdmin;
  merchants: MerchantRecord[];
  categoryBreakdown: CategoryBreakdown;
  totals: {
    merchants: number;
    activated: number;
    unactivated: number;
    overLine: number;
  };
  activationRate: number | null;
  vampOverLine: VampOverLineItem[];
};

// ── Profile completeness model (named, not magic) ────────────────────────────

const PROFILE_FIELDS: (keyof ProfileRow)[] = [
  'persona',
  'customer_type',
  'delivery_method',
  'product_description',
];

export async function getMerchantsData(): Promise<MerchantsData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();

  const [
    merchantResult,
    profileResult,
    processorResult,
    vampResult,
    disputeResult,
    merchantUserResult,
    notificationResult,
  ] = await Promise.all([
    service
      .from('merchants')
      .select('id, business_name, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_MERCHANTS),
    service.from('merchant_profiles').select('*').limit(MAX_MERCHANTS),
    service
      .from('processor_connections')
      .select('merchant_id, processor, connection_status, connected_at')
      .limit(MAX_MERCHANTS * 3),
    service
      .from('vamp_snapshots')
      .select('merchant_id, estimated_vamp_ratio, calculated_at, confidence_level')
      .order('calculated_at', { ascending: false })
      .limit(MAX_VAMP_SNAPSHOTS),
    service
      .from('disputes')
      .select('merchant_id, amount, reason, outcome, status')
      .order('created_at', { ascending: false })
      .limit(MAX_DISPUTES),
    service
      .from('merchant_users')
      .select('merchant_id, user_id, role, status')
      .eq('status', 'active'),
    // NEW table — may be absent (migration unapplied). Read defensively.
    service
      .from('merchant_vamp_notifications')
      .select('merchant_id, band, over_line_since, drafted_at, drafted_by, sent_at, channel')
      .order('created_at', { ascending: false }),
  ]);

  const checks: QueryResult<unknown>[] = [
    merchantResult,
    profileResult,
    processorResult,
    vampResult,
    disputeResult,
    merchantUserResult,
    notificationResult,
  ];
  checks.forEach((r, i) => logQueryError(`merchants query ${i + 1}`, r));

  const merchantRows = rows<MerchantBaseRow>(merchantResult);
  const profileRows = rows<ProfileRow>(profileResult);
  const processorRows = rows<ProcessorRow>(processorResult);
  const vampRows = rows<VampRow>(vampResult);
  const disputeRows = rows<DisputeRow>(disputeResult);
  const merchantUserRows = rows<MerchantUserRow>(merchantUserResult);
  const notificationRows = rows<VampNotificationRow>(notificationResult);

  // Index ancillary data by merchant for O(1) joins.
  const profileByMerchant = indexBy(profileRows, (r) => r.merchant_id);
  const activationByMerchant = buildActivation(processorRows);
  const vampByMerchant = buildLatestVamp(vampRows);
  const disputesByMerchant = buildDisputeSummaries(disputeRows);
  const latestNotificationByMerchant = indexBy(notificationRows, (r) => r.merchant_id);

  const ownerUserIdByMerchant = buildOwnerUserId(merchantUserRows);
  const ownerEmailByMerchant = await resolveOwnerEmails(service, ownerUserIdByMerchant);

  const records: MerchantRecord[] = merchantRows.map((m) => {
    const profile = profileByMerchant.get(m.id) ?? null;
    const activation = activationByMerchant.get(m.id) ?? { stripeConnected: false, connectedAt: null };
    const vamp = vampByMerchant.get(m.id) ?? emptyVamp();
    const disputes = disputesByMerchant.get(m.id) ?? emptyDisputeSummary();
    const ownerEmail = ownerEmailByMerchant.get(m.id) ?? null;
    const ownerEmailDomain = domainOf(ownerEmail);

    const category = categorizeMerchant({
      override: normalizeOverride(profile?.category),
      persona: profile?.persona ?? null,
      stripe: null, // business signals not captured yet — stripe tier stays dormant
      customerType: profile?.customer_type ?? null,
      deliveryMethod: profile?.delivery_method ?? null,
      emailDomain: ownerEmailDomain,
      disputeMix: {
        total: disputes.total,
        subscriptionCanceledShare: disputes.subscriptionCanceledShare,
        avgAmountUsd: disputes.avgAmountUsd,
      },
    });

    return {
      id: m.id,
      businessName: m.business_name,
      createdAt: m.created_at,
      ownerEmail,
      ownerEmailDomain,
      category,
      activation,
      vamp,
      disputes,
      profile: summarizeProfile(profile),
      daysSinceSignup: daysSince(m.created_at, now),
    };
  });

  const categoryBreakdown = countByCategory(records);
  const activated = records.filter((r) => r.activation.stripeConnected).length;
  const merchantsTotal = records.length;

  const vampOverLine = buildOverLine(records, latestNotificationByMerchant);

  return {
    admin,
    merchants: records,
    categoryBreakdown,
    totals: {
      merchants: merchantsTotal,
      activated,
      unactivated: merchantsTotal - activated,
      overLine: vampOverLine.length,
    },
    activationRate: merchantsTotal > 0 ? activated / merchantsTotal : null,
    vampOverLine,
  };
}

// ── Build helpers ────────────────────────────────────────────────────────────

function buildActivation(processorRows: ProcessorRow[]): Map<string, MerchantActivation> {
  const map = new Map<string, MerchantActivation>();
  for (const row of processorRows) {
    const isStripeConnected = row.processor === 'stripe' && row.connection_status === 'connected';
    const existing = map.get(row.merchant_id);
    if (isStripeConnected) {
      map.set(row.merchant_id, { stripeConnected: true, connectedAt: row.connected_at });
    } else if (!existing) {
      map.set(row.merchant_id, { stripeConnected: false, connectedAt: null });
    }
  }
  return map;
}

function buildLatestVamp(vampRows: VampRow[]): Map<string, MerchantVampStanding> {
  // Rows arrive newest-first; keep the first seen per merchant.
  const map = new Map<string, MerchantVampStanding>();
  for (const row of vampRows) {
    if (map.has(row.merchant_id)) continue;
    const ratio = toFiniteOrNull(row.estimated_vamp_ratio);
    map.set(row.merchant_id, {
      ratio,
      band: bandForRatio(ratio),
      calculatedAt: row.calculated_at,
      confidence: row.confidence_level,
    });
  }
  return map;
}

function buildDisputeSummaries(disputeRows: DisputeRow[]): Map<string, MerchantDisputeSummary> {
  const openStatuses = new Set(['needs_response', 'under_review', 'submitted']);
  type Acc = { total: number; won: number; lost: number; open: number; cancel: number; sumCents: number; amounted: number };
  const acc = new Map<string, Acc>();

  for (const row of disputeRows) {
    const id = row.merchant_id;
    if (!id) continue;
    const a = acc.get(id) ?? { total: 0, won: 0, lost: 0, open: 0, cancel: 0, sumCents: 0, amounted: 0 };
    a.total += 1;
    if (row.outcome === 'won') a.won += 1;
    else if (row.outcome === 'lost') a.lost += 1;
    if (row.status && openStatuses.has(row.status)) a.open += 1;
    if (row.reason && SUBSCRIPTION_CANCEL_MATCHER.test(row.reason)) a.cancel += 1;
    if (row.amount != null && Number.isFinite(row.amount)) {
      a.sumCents += row.amount;
      a.amounted += 1;
    }
    acc.set(id, a);
  }

  const out = new Map<string, MerchantDisputeSummary>();
  for (const [id, a] of acc) {
    out.set(id, {
      total: a.total,
      won: a.won,
      lost: a.lost,
      open: a.open,
      avgAmountUsd: a.amounted > 0 ? a.sumCents / a.amounted / CENTS_PER_DOLLAR : null,
      subscriptionCanceledShare: a.total > 0 ? a.cancel / a.total : 0,
    });
  }
  return out;
}

function buildOwnerUserId(merchantUserRows: MerchantUserRow[]): Map<string, string> {
  // Prefer an explicit owner role; otherwise fall back to the first active member.
  const map = new Map<string, string>();
  for (const row of merchantUserRows) {
    if (!row.user_id) continue;
    const existing = map.get(row.merchant_id);
    if (row.role === 'owner') {
      map.set(row.merchant_id, row.user_id);
    } else if (!existing) {
      map.set(row.merchant_id, row.user_id);
    }
  }
  return map;
}

async function resolveOwnerEmails(
  service: ServiceClient,
  ownerUserIdByMerchant: Map<string, string>,
): Promise<Map<string, string>> {
  // Resolve auth emails one user at a time via the admin API. Best-effort: any
  // lookup that fails simply leaves that merchant without an email (no crash,
  // no fabrication). The email only feeds the email-domain categorization tell.
  const emailByMerchant = new Map<string, string>();
  const uniqueUserIds = [...new Set(ownerUserIdByMerchant.values())];
  const emailByUserId = new Map<string, string>();

  for (const userId of uniqueUserIds) {
    try {
      const { data, error } = await service.auth.admin.getUserById(userId);
      if (error || !data?.user?.email) continue;
      emailByUserId.set(userId, data.user.email);
    } catch {
      // Admin API unavailable or user missing — skip silently.
    }
  }

  for (const [merchantId, userId] of ownerUserIdByMerchant) {
    const email = emailByUserId.get(userId);
    if (email) emailByMerchant.set(merchantId, email);
  }
  return emailByMerchant;
}

function buildOverLine(
  records: MerchantRecord[],
  notificationByMerchant: Map<string, VampNotificationRow>,
): VampOverLineItem[] {
  return records
    .filter((r) => r.vamp.ratio != null && r.vamp.ratio >= VAMP_STRIPE_LINE)
    .map((r) => {
      const note = notificationByMerchant.get(r.id) ?? null;
      return {
        merchantId: r.id,
        businessName: r.businessName,
        ratio: r.vamp.ratio as number,
        calculatedAt: r.vamp.calculatedAt,
        overLineSince: note?.over_line_since ?? r.vamp.calculatedAt,
        drafted: note?.drafted_at != null,
        draftedAt: note?.drafted_at ?? null,
        sentAt: note?.sent_at ?? null,
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

function summarizeProfile(profile: ProfileRow | null): MerchantProfileSummary {
  const totalFields = PROFILE_FIELDS.length;
  let filled = 0;
  if (profile) {
    for (const field of PROFILE_FIELDS) {
      const value = profile[field];
      if (value != null && String(value).trim().length > 0) filled += 1;
    }
  }
  return {
    persona: profile?.persona ?? null,
    customerType: profile?.customer_type ?? null,
    deliveryMethod: profile?.delivery_method ?? null,
    productDescription: profile?.product_description ?? null,
    categoryOverride: normalizeOverride(profile?.category),
    categorySource: profile?.category_source ?? null,
    completeness: totalFields > 0 ? filled / totalFields : 0,
    filledFields: filled,
    totalFields,
  };
}

function countByCategory(records: MerchantRecord[]): CategoryBreakdown {
  const breakdown: CategoryBreakdown = {
    freelancer: 0,
    agency: 0,
    saas: 0,
    other: 0,
    uncategorized: 0,
  };
  for (const r of records) {
    breakdown[r.category.category] += 1;
  }
  return breakdown;
}

// ── Small pure utilities ─────────────────────────────────────────────────────

function bandForRatio(ratio: number | null): MerchantVampStanding['band'] {
  if (ratio == null || !Number.isFinite(ratio)) return 'unknown';
  if (ratio >= VAMP_STRIPE_LINE) return 'atRisk';
  if (ratio >= VAMP_HEALTHY_BELOW) return 'close';
  return 'healthy';
}

function normalizeOverride(value: MerchantCategory | null | undefined): MerchantCategory | null {
  if (value == null) return null;
  if (value === 'uncategorized') return null;
  if (value === 'freelancer' || value === 'agency' || value === 'saas' || value === 'other') return value;
  return null;
}

function domainOf(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  const elapsed = now - t;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / (24 * 60 * 60 * 1000));
}

function emptyVamp(): MerchantVampStanding {
  return { ratio: null, band: 'unknown', calculatedAt: null, confidence: null };
}

function emptyDisputeSummary(): MerchantDisputeSummary {
  return { total: 0, won: 0, lost: 0, open: 0, avgAmountUsd: null, subscriptionCanceledShare: 0 };
}

function toFiniteOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

function indexBy<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, item);
  }
  return map;
}

// ── Log-and-degrade (mirrors lib/admin/queries.ts) ───────────────────────────

function logQueryError(label: string, result: QueryResult<unknown>): void {
  if (result.error) {
    console.error(`[admin] ${label} error:`, safeStringifyError(result.error));
  }
}

function safeStringifyError(error: unknown): string {
  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}') return json;
  } catch {
    /* fall through */
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message) || '(empty error)';
  }
  return String(error) || '(empty error)';
}

function rows<T>(result: QueryResult<unknown>): T[] {
  return (result.data ?? []) as T[];
}
