import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import {
  scoreAuditLead,
  scoreWaitlistSignup,
  scoreUnactivatedMerchant,
  rankConvertItems,
  type ConvertItem,
} from '@/lib/admin/convert';

// ─────────────────────────────────────────────────────────────────────────────
// LEADS surface loader — the top-of-funnel convert console.
//
// Pulls the three raw lead populations (waitlist signups, audit leads, and
// unactivated merchants), scores each into ranked ConvertItems, and returns both
// the raw rows (for the per-tab tables) and the merged worklist. Every query
// logs-and-degrades: one failed slice falls back to empty, the page still
// renders. Geo columns may not exist yet (migration unapplied) so the waitlist
// select reads them defensively via a wildcard, never assuming the columns are
// present.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

// ── Row shapes (lead-specific, with optional geo) ────────────────────────────

export type LeadWaitlistRow = {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  geo_country: string | null;
  geo_region: string | null;
};

export type LeadAuditRow = {
  id: string;
  email: string;
  business_name: string | null;
  total_disputes: number;
  lost_disputes: number;
  should_have_won_count: number;
  comms_hinged_count: number;
  estimated_dispute_rate: number | string | null;
  standing_band: string | null;
  converted_merchant_id: string | null;
  converted_at: string | null;
  source: string | null;
  created_at: string;
  geo_country: string | null;
  geo_region: string | null;
};

export type LeadUnactivatedRow = {
  id: string;
  businessName: string | null;
  createdAt: string;
  daysSinceSignup: number;
  profileComplete: boolean;
};

export type LeadsData = {
  admin: PlatformAdmin;
  worklist: ConvertItem[];
  waitlistRows: LeadWaitlistRow[];
  auditRows: LeadAuditRow[];
  unactivatedRows: LeadUnactivatedRow[];
  counts: {
    worklist: number;
    waitlist: number;
    audit: number;
    unactivated: number;
  };
};

// ── Internal raw shapes from the DB (before normalization) ───────────────────

type RawMerchantRow = { id: string; business_name: string | null; created_at: string };
type RawProcessorRow = { merchant_id: string; processor: string; connection_status: string };
type RawProfileRow = {
  merchant_id: string;
  persona: string | null;
  customer_type: string | null;
  delivery_method: string | null;
  product_description: string | null;
};

export async function getLeadsData(): Promise<LeadsData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();

  const [
    waitlistResult,
    auditResult,
    merchantResult,
    processorResult,
    profileResult,
  ] = await Promise.all([
    // Select * so the geo_* columns are read when present and silently absent
    // when the migration has not been applied yet.
    service
      .from('waitlist_signups')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    service
      .from('audit_leads')
      .select(
        'id, email, business_name, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, converted_merchant_id, converted_at, source, created_at, geo_country, geo_region',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    service
      .from('merchants')
      .select('id, business_name, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    service
      .from('processor_connections')
      .select('merchant_id, processor, connection_status')
      .limit(2000),
    service
      .from('merchant_profiles')
      .select('merchant_id, persona, customer_type, delivery_method, product_description')
      .limit(2000),
  ]);

  const checks: QueryResult<unknown>[] = [
    waitlistResult,
    auditResult,
    merchantResult,
    processorResult,
    profileResult,
  ];
  checks.forEach((r, i) => logQueryError(`leads query ${i + 1}`, r));

  const waitlistRows = normalizeWaitlist(rows<Record<string, unknown>>(waitlistResult));
  const auditRows = normalizeAudit(rows<Record<string, unknown>>(auditResult));

  const merchants = rows<RawMerchantRow>(merchantResult);
  const processors = rows<RawProcessorRow>(processorResult);
  const profiles = rows<RawProfileRow>(profileResult);

  const unactivatedRows = buildUnactivated(merchants, processors, profiles, now);

  // ── Score + merge into the ranked worklist ─────────────────────────────────
  const auditItems: ConvertItem[] = auditRows.map((row) =>
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
      now,
    ),
  );

  const waitlistItems: ConvertItem[] = waitlistRows.map((row) =>
    scoreWaitlistSignup(
      { id: row.id, email: row.email, source: row.source, created_at: row.created_at },
      now,
    ),
  );

  const unactivatedItems: ConvertItem[] = unactivatedRows.map((row) =>
    scoreUnactivatedMerchant(
      {
        merchant: { id: row.id, business_name: row.businessName, created_at: row.createdAt },
        daysSinceSignup: row.daysSinceSignup,
        profileComplete: row.profileComplete,
      },
      now,
    ),
  );

  const worklist = rankConvertItems([...auditItems, ...waitlistItems, ...unactivatedItems]);

  return {
    admin,
    worklist,
    waitlistRows,
    auditRows,
    unactivatedRows,
    counts: {
      worklist: worklist.length,
      waitlist: waitlistRows.length,
      audit: auditRows.length,
      unactivated: unactivatedRows.length,
    },
  };
}

// ── Normalizers (defensive against absent/optional columns) ──────────────────

function normalizeWaitlist(raw: Record<string, unknown>[]): LeadWaitlistRow[] {
  return raw
    .filter((r) => typeof r.id === 'string' && typeof r.email === 'string')
    .map((r) => ({
      id: String(r.id),
      email: String(r.email),
      source: asString(r.source),
      created_at: asString(r.created_at) ?? new Date(0).toISOString(),
      geo_country: asString(r.geo_country),
      geo_region: asString(r.geo_region),
    }));
}

function normalizeAudit(raw: Record<string, unknown>[]): LeadAuditRow[] {
  return raw
    .filter((r) => typeof r.id === 'string' && typeof r.email === 'string')
    .map((r) => ({
      id: String(r.id),
      email: String(r.email),
      business_name: asString(r.business_name),
      total_disputes: asInt(r.total_disputes),
      lost_disputes: asInt(r.lost_disputes),
      should_have_won_count: asInt(r.should_have_won_count),
      comms_hinged_count: asInt(r.comms_hinged_count),
      estimated_dispute_rate: asNumberOrString(r.estimated_dispute_rate),
      standing_band: asString(r.standing_band),
      converted_merchant_id: asString(r.converted_merchant_id),
      converted_at: asString(r.converted_at),
      source: asString(r.source),
      created_at: asString(r.created_at) ?? new Date(0).toISOString(),
      geo_country: asString(r.geo_country),
      geo_region: asString(r.geo_region),
    }));
}

function buildUnactivated(
  merchants: RawMerchantRow[],
  processors: RawProcessorRow[],
  profiles: RawProfileRow[],
  now: number,
): LeadUnactivatedRow[] {
  const stripeConnected = new Set<string>();
  for (const p of processors) {
    if (p.processor === 'stripe' && p.connection_status === 'connected') {
      stripeConnected.add(p.merchant_id);
    }
  }

  const profileByMerchant = new Map<string, RawProfileRow>();
  for (const profile of profiles) {
    if (!profileByMerchant.has(profile.merchant_id)) {
      profileByMerchant.set(profile.merchant_id, profile);
    }
  }

  return merchants
    .filter((m) => !stripeConnected.has(m.id))
    .map((m) => {
      const profile = profileByMerchant.get(m.id) ?? null;
      return {
        id: m.id,
        businessName: m.business_name,
        createdAt: m.created_at,
        daysSinceSignup: daysSince(m.created_at, now),
        profileComplete: isProfileComplete(profile),
      };
    });
}

function isProfileComplete(profile: RawProfileRow | null): boolean {
  if (!profile) return false;
  const hasType = nonEmpty(profile.customer_type);
  const hasDelivery = nonEmpty(profile.delivery_method);
  const hasDescription = nonEmpty(profile.product_description);
  return hasType && hasDelivery && hasDescription;
}

// ── Small value helpers ──────────────────────────────────────────────────────

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

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function asInt(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function asNumberOrString(value: unknown): number | string | null {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  const elapsed = now - t;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / DAY_MS);
}
