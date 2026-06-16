import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import {
  RANGES,
  buildSeries,
  compareCount,
  resolveWindow,
  type CompareCount,
  type RangeKey,
} from '@/lib/admin/ranges';
import type { SeriesPoint } from '@/lib/admin/series';
import type {
  AuditLeadRow,
  FunnelStepData,
  MerchantRow,
  WaitlistSignupRow,
} from '@/lib/admin/queries';

// ─────────────────────────────────────────────────────────────────────────────
// Growth surface loader. Pulls each acquisition table's created_at across a
// generous window (>= the selected range, all rows for lifetime), then builds a
// range-aware trend series + a prior-period comparison for every metric. The
// last bucket of each series is the in-progress (incomplete) period; the view
// renders it dashed and notes it so a sparse "today" bar is never read as a dip.
//
// Honest data only: every number here comes from a real query. When a table is
// empty we surface a genuine zero / empty state rather than inventing volume.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type TimestampRow = { created_at: string };

/** One acquisition metric, fully resolved for the active range. */
export interface GrowthMetric {
  /** Stable key used for React keys + copy lookups. */
  key: 'waitlist' | 'auditLeads' | 'merchants' | 'disputes' | 'stripeActivated';
  label: string;
  /** Lifetime total (all rows ever), for headline context. */
  lifetimeTotal: number;
  /** Count inside the active range window. */
  inRange: number;
  /** Range-bucketed series; final point is the in-progress period. */
  series: SeriesPoint[];
  /** Current vs immediately-preceding window of equal span. */
  compare: CompareCount;
  /** Whether the metric should read as activity (verdict) or neutral. */
  tone: 'verdict' | 'neutral';
}

export interface GrowthFunnel {
  steps: FunnelStepData[];
  /** audit leads → merchants. Null when there are no leads. */
  leadToMerchant: number | null;
  /** merchants → Stripe-activated. Null when there are no merchants. */
  merchantToActivated: number | null;
}

export interface GrowthData {
  admin: PlatformAdmin;
  /** Active range key (defaults to 1m). */
  range: RangeKey;
  /** Human label for the active window ("Last 30 days"). */
  rangeLabel: string;
  /** Label for the comparison window ("vs previous 30 days"). */
  compareLabel: string;
  /** Server timestamp the window was resolved against. */
  generatedAt: string;
  /** The five acquisition trends, in funnel order. */
  metrics: GrowthMetric[];
  funnel: GrowthFunnel;
}

/**
 * The legacy queries-shaped Growth payload. The frozen dev preview
 * (app/dev/admin/page.tsx) still constructs this shape and renders <GrowthView>,
 * so the view accepts it as an alternative and normalizes it internally. New
 * code should always use {@link GrowthData} from the {@link getGrowthTrends}
 * loader.
 */
export interface LegacyGrowthData {
  admin: PlatformAdmin;
  series30: {
    waitlist: SeriesPoint[];
    auditLeads: SeriesPoint[];
    merchants: SeriesPoint[];
    disputes: SeriesPoint[];
  };
  totals: {
    waitlist: number;
    auditLeads: number;
    merchants: number;
    disputes: number;
    stripeConnected: number;
  };
  funnel: FunnelStepData[];
  waitlistRows: WaitlistSignupRow[];
  auditRows: AuditLeadRow[];
  merchantRows: MerchantRow[];
}

const METRIC_LABELS: Record<GrowthMetric['key'], string> = {
  waitlist: 'Waitlist signups',
  auditLeads: 'Audit leads',
  merchants: 'Merchants',
  disputes: 'Disputes filed',
  stripeActivated: 'Stripe activations',
};

/**
 * Normalize an unknown range query param to a valid RangeKey, defaulting to 1m.
 */
export function resolveRangeKey(raw: string | null | undefined): RangeKey {
  if (raw && raw in RANGES) return raw as RangeKey;
  return '1m';
}

/** Window length in ms we pull rows from. Generous: >= the range span, *2 so the
 * prior-period comparison has data; lifetime pulls everything (no lower bound). */
function pullSinceIso(range: RangeKey, now: number): string | null {
  const cfg = RANGES[range];
  if (cfg.windowDays == null) return null; // lifetime → no floor
  // Pull two spans back so compareCount's prior window is fully covered, plus a
  // day of slack for bucket-edge rows.
  const spanMs = cfg.windowDays * DAY_MS;
  return new Date(now - spanMs * 2 - DAY_MS).toISOString();
}

function buildMetric(
  key: GrowthMetric['key'],
  rangeRows: TimestampRow[],
  lifetimeTotal: number,
  range: RangeKey,
  now: number,
  tone: GrowthMetric['tone'],
): GrowthMetric {
  const window = resolveWindow(range, now, null);
  const series = buildSeries(rangeRows, range, now, null);
  const compare = compareCount(rangeRows, range, now);
  const inRange = rangeRows.reduce((n, row) => {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) return n;
    return t >= window.sinceMs && t <= window.untilMs ? n + 1 : n;
  }, 0);
  return {
    key,
    label: METRIC_LABELS[key],
    lifetimeTotal,
    inRange,
    series,
    compare,
    tone,
  };
}

export async function getGrowthTrends(range: RangeKey): Promise<GrowthData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();
  const sinceIso = pullSinceIso(range, now);

  // Row pulls are bounded by the window for fixed ranges; lifetime pulls all.
  // Stripe activation timestamps come from processor_connections.connected_at.
  const ts = (table: string) => {
    const base = service.from(table).select('created_at');
    const scoped = sinceIso ? base.gte('created_at', sinceIso) : base;
    return scoped.order('created_at', { ascending: false }).limit(20000);
  };

  const [
    waitlistTotal,
    auditTotal,
    merchantTotal,
    disputeTotal,
    stripeTotal,
    waitlistRows,
    auditRows,
    merchantRows,
    disputeRows,
    stripeRows,
  ] = await Promise.all([
    service.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    service.from('audit_leads').select('id', { count: 'exact', head: true }),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service.from('disputes').select('id', { count: 'exact', head: true }),
    service
      .from('processor_connections')
      .select('id', { count: 'exact', head: true })
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected'),
    ts('waitlist_signups'),
    ts('audit_leads'),
    ts('merchants'),
    ts('disputes'),
    // Stripe activations are dated by connected_at, not created_at. Alias it so
    // the shared series helpers (which read created_at) work unchanged.
    (() => {
      const base = service
        .from('processor_connections')
        .select('created_at:connected_at')
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected');
      const scoped = sinceIso ? base.gte('connected_at', sinceIso) : base;
      return scoped.order('connected_at', { ascending: false }).limit(20000);
    })(),
  ]);

  const checks: QueryResult<unknown>[] = [
    waitlistTotal, auditTotal, merchantTotal, disputeTotal, stripeTotal,
    waitlistRows, auditRows, merchantRows, disputeRows, stripeRows,
  ];
  checks.forEach((r, i) => logQueryError(`growth-trends query ${i + 1}`, r));

  const lifeWaitlist = countRows(waitlistTotal);
  const lifeAudit = countRows(auditTotal);
  const lifeMerchants = countRows(merchantTotal);
  const lifeDisputes = countRows(disputeTotal);
  const lifeStripe = countRows(stripeTotal);

  const waitlistTs = rows<TimestampRow>(waitlistRows);
  const auditTs = rows<TimestampRow>(auditRows);
  const merchantTs = rows<TimestampRow>(merchantRows);
  const disputeTs = rows<TimestampRow>(disputeRows);
  const stripeTs = rows<TimestampRow>(stripeRows).filter((r) => !!r.created_at);

  const metrics: GrowthMetric[] = [
    buildMetric('waitlist', waitlistTs, lifeWaitlist, range, now, 'verdict'),
    buildMetric('auditLeads', auditTs, lifeAudit, range, now, 'verdict'),
    buildMetric('merchants', merchantTs, lifeMerchants, range, now, 'verdict'),
    buildMetric('stripeActivated', stripeTs, lifeStripe, range, now, 'verdict'),
    buildMetric('disputes', disputeTs, lifeDisputes, range, now, 'neutral'),
  ];

  const steps: FunnelStepData[] = [
    { label: 'Audit leads', value: lifeAudit },
    { label: 'Waitlist signups', value: lifeWaitlist },
    { label: 'Merchants', value: lifeMerchants },
    { label: 'Stripe activated', value: lifeStripe },
  ];

  return {
    admin,
    range,
    rangeLabel: RANGES[range].label,
    compareLabel: compareLabelFor(range),
    generatedAt: new Date(now).toISOString(),
    metrics,
    funnel: {
      steps,
      leadToMerchant: lifeAudit > 0 ? lifeMerchants / lifeAudit : null,
      merchantToActivated: lifeMerchants > 0 ? lifeStripe / lifeMerchants : null,
    },
  };
}

function compareLabelFor(range: RangeKey): string {
  const map: Record<RangeKey, string> = {
    '1d': 'vs previous 24 hours',
    '1w': 'vs previous 7 days',
    '1m': 'vs previous 30 days',
    '1q': 'vs previous 13 weeks',
    '1y': 'vs previous 12 months',
    lifetime: 'vs the prior span',
  };
  return map[range];
}

// ── Local log-and-degrade helpers (mirrors lib/admin/queries.ts) ─────────────

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

function countRows(result: QueryResult<unknown>): number {
  return result.count ?? rows<unknown>(result).length;
}
