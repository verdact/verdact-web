import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import {
  type RangeKey,
  resolveWindow,
  buildSeries,
  compareCount,
} from '@/lib/admin/ranges';
import {
  scoreAuditLead,
  scoreUnactivatedMerchant,
  draftVampAlert,
  rankConvertItems,
  type ConvertItem,
  type Draft,
} from '@/lib/admin/convert';
import type { SeriesPoint } from '@/lib/admin/series';
import type {
  AuditLeadRow,
  MerchantRow,
  WaitlistSignupRow,
  AdminEventRow,
  FunnelStepData,
  FeedItem,
} from '@/lib/admin/queries';

// ─────────────────────────────────────────────────────────────────────────────
// Loader for the COMMAND surface (the operator morning screen). One gated
// Promise.all, log-and-degrade per query (a single failed/aborted query falls
// back to empty/zero rather than crashing the cockpit). The selected RangeKey
// drives every tile delta and sparkline; lifetime totals stay range-agnostic.
//
// Honest data only. Where a slice has not been captured yet, the view renders a
// real empty state rather than a fabricated number.
// ─────────────────────────────────────────────────────────────────────────────

const VAMP_STRIPE_LINE = 0.0075;
const VAMP_HEALTHY_BELOW = 0.005;
const DAY_MS = 24 * 60 * 60 * 1000;
const WORKLIST_PREVIEW_SIZE = 5;
const FEED_PREVIEW_SIZE = 6;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type TimestampRow = { created_at: string };
type DisputeRow = { status: string; outcome: string | null; amount: number | null; created_at: string };
type VampSnapshotRow = {
  merchant_id: string;
  estimated_vamp_ratio: number | string | null;
  calculated_at: string;
};
type ProcessorConnRow = { merchant_id: string };

// ── Exported view shapes ─────────────────────────────────────────────────────

/** A single KPI tile: total + range-scoped current/prior delta + sparkline. */
export type CommandKpi = {
  current: number;
  prior: number;
  delta: number;
  spark: SeriesPoint[];
};

/** A worklist preview item: a ranked convert item plus its tile-deep-link target. */
export type WorklistItem = ConvertItem & { href: string };

/** An over-the-line merchant ready for a VAMP heads-up draft (never sent). */
export type VampAtRiskItem = {
  merchantId: string;
  businessName: string | null;
  ratioPct: number; // percent, e.g. 0.92 means 0.92%
  draft: Draft;
};

/** A recent waitlist signup, for the Waitlist tile drawer. */
export type RecentSignup = { id: string; email: string; source: string | null; created_at: string };

export type CommandData = {
  admin: PlatformAdmin;
  range: RangeKey;
  rangeLabel: string;

  // Lifetime totals (range-agnostic headline counts).
  totals: {
    waitlist: number;
    auditLeads: number;
    merchants: number;
    stripeConnected: number;
    disputes: number;
    openDisputes: number;
  };

  // Range-scoped KPIs (delta vs prior window + sparkline).
  kpis: {
    waitlist: CommandKpi;
    auditLeads: CommandKpi;
    merchants: CommandKpi;
    disputes: CommandKpi;
  };

  funnel: FunnelStepData[];
  conversionRate: number | null; // audit leads -> merchants
  activationRate: number | null; // merchants -> stripe connected

  outcomes: { won: number; lost: number; open: number; warningClosed: number };
  vamp: { healthy: number; close: number; atRisk: number; notScored: number; measured: number };
  vampAtRisk: VampAtRiskItem[];

  // "Needs you now" — top ranked convert items across audit leads + unactivated.
  worklist: WorklistItem[];
  worklistTotal: number;

  // Recent signal previews for tile drawers.
  recentSignups: RecentSignup[];
  recentAuditLeads: AuditLeadRow[];
  recentMerchants: MerchantRow[];

  feed: FeedItem[];
};

// ── Loader ───────────────────────────────────────────────────────────────────

export async function getCommandData(range: RangeKey): Promise<CommandData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();
  const window = resolveWindow(range, now, null);
  const sinceIso = new Date(window.sinceMs).toISOString();
  // Prior window starts one span before the current window; pull from there so
  // compareCount has both periods. For lifetime this is best-effort.
  const span = window.untilMs - window.sinceMs;
  const priorSinceIso = new Date(window.sinceMs - span).toISOString();

  const [
    waitlistCount,
    auditCount,
    merchantCount,
    stripeCount,
    disputeCount,
    // Series rows scoped to current + prior window for each KPI.
    waitlistSeries,
    auditSeries,
    merchantSeries,
    disputeSeries,
    // Summary rows (lifetime, capped).
    disputeRowsResult,
    vampResult,
    stripeConnRows,
    // Detail/preview rows.
    recentSignupsResult,
    recentAuditResult,
    recentMerchantsResult,
    recentEventsResult,
    feedMerchantsResult,
    feedWaitlistResult,
    feedAuditResult,
    // Scoring inputs.
    auditLeadRowsResult,
    unactivatedMerchantsResult,
  ] = await Promise.all([
    service.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    service.from('audit_leads').select('id', { count: 'exact', head: true }),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service
      .from('processor_connections')
      .select('id', { count: 'exact', head: true })
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected'),
    service.from('disputes').select('id', { count: 'exact', head: true }),

    service.from('waitlist_signups').select('created_at').gte('created_at', priorSinceIso).limit(5000),
    service.from('audit_leads').select('created_at').gte('created_at', priorSinceIso).limit(5000),
    service.from('merchants').select('created_at').gte('created_at', priorSinceIso).limit(5000),
    service.from('disputes').select('created_at').gte('created_at', priorSinceIso).limit(5000),

    service.from('disputes').select('status, outcome, amount, created_at').order('created_at', { ascending: false }).limit(2000),
    service.from('vamp_snapshots').select('merchant_id, estimated_vamp_ratio, calculated_at').order('calculated_at', { ascending: false }).limit(1000),
    service.from('processor_connections').select('merchant_id').eq('processor', 'stripe').eq('connection_status', 'connected').limit(2000),

    service.from('waitlist_signups').select('id, email, source, created_at').order('created_at', { ascending: false }).limit(8),
    service
      .from('audit_leads')
      .select('id, email, business_name, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, converted_merchant_id, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    service.from('merchants').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('platform_admin_events').select('id, admin_email, action, created_at').order('created_at', { ascending: false }).limit(10),
    service.from('merchants').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('waitlist_signups').select('id, email, source, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('audit_leads').select('id, email, business_name, created_at').order('created_at', { ascending: false }).limit(8),

    service
      .from('audit_leads')
      .select('id, email, business_name, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, converted_merchant_id, created_at')
      .is('converted_merchant_id', null)
      .order('created_at', { ascending: false })
      .limit(120),
    service.from('merchants').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(200),
  ]);

  const checks: QueryResult<unknown>[] = [
    waitlistCount, auditCount, merchantCount, stripeCount, disputeCount,
    waitlistSeries, auditSeries, merchantSeries, disputeSeries,
    disputeRowsResult, vampResult, stripeConnRows,
    recentSignupsResult, recentAuditResult, recentMerchantsResult, recentEventsResult,
    feedMerchantsResult, feedWaitlistResult, feedAuditResult,
    auditLeadRowsResult, unactivatedMerchantsResult,
  ];
  checks.forEach((r, i) => logQueryError(`command query ${i + 1}`, r));

  // ── Totals ──────────────────────────────────────────────────────────────
  const waitlist = countRows(waitlistCount);
  const auditLeads = countRows(auditCount);
  const merchants = countRows(merchantCount);
  const stripeConnected = countRows(stripeCount);
  const disputes = countRows(disputeCount);

  const disputeRows = rows<DisputeRow>(disputeRowsResult);
  const outcomes = summarizeDisputes(disputeRows);
  const vamp = summarizeVamp(rows<VampSnapshotRow>(vampResult), merchants);

  // ── Range-scoped KPIs ─────────────────────────────────────────────────────
  const kpis = {
    waitlist: buildKpi(rows<TimestampRow>(waitlistSeries), range, now),
    auditLeads: buildKpi(rows<TimestampRow>(auditSeries), range, now),
    merchants: buildKpi(rows<TimestampRow>(merchantSeries), range, now),
    disputes: buildKpi(rows<TimestampRow>(disputeSeries), range, now),
  };

  // ── VAMP over-the-line items (heads-up drafts, never sent) ─────────────────
  const merchantNameById = new Map<string, string | null>();
  for (const m of rows<MerchantRow>(unactivatedMerchantsResult)) merchantNameById.set(m.id, m.business_name);
  for (const m of rows<MerchantRow>(recentMerchantsResult)) merchantNameById.set(m.id, m.business_name);
  const vampAtRisk = buildVampAtRisk(rows<VampSnapshotRow>(vampResult), merchantNameById);

  // ── Worklist: ranked convert items (audit leads + unactivated merchants) ───
  const stripeMerchantIds = new Set(rows<ProcessorConnRow>(stripeConnRows).map((r) => r.merchant_id));
  const auditItems = rows<AuditLeadRow>(auditLeadRowsResult).map((row) => ({
    item: scoreAuditLead(row, now),
    href: '/admin/leads',
  }));
  const unactivatedItems = rows<MerchantRow>(unactivatedMerchantsResult)
    .filter((m) => !stripeMerchantIds.has(m.id))
    .map((m) => ({
      item: scoreUnactivatedMerchant(
        { merchant: m, daysSinceSignup: daysSince(m.created_at, now), profileComplete: false },
        now,
      ),
      href: '/admin/merchants',
    }));

  const hrefByItemId = new Map<string, string>();
  for (const { item, href } of [...auditItems, ...unactivatedItems]) hrefByItemId.set(item.id, href);
  const ranked = rankConvertItems([...auditItems, ...unactivatedItems].map((x) => x.item));
  const worklist: WorklistItem[] = ranked.map((item) => ({
    ...item,
    href: hrefByItemId.get(item.id) ?? '/admin/leads',
  }));

  const feed = buildFeed({
    events: rows<AdminEventRow>(recentEventsResult),
    merchants: rows<MerchantRow>(feedMerchantsResult),
    waitlist: rows<WaitlistSignupRow>(feedWaitlistResult),
    audit: rows<{ id: string; email: string; business_name: string | null; created_at: string }>(feedAuditResult),
  });

  return {
    admin,
    range,
    rangeLabel: window.label,
    totals: { waitlist, auditLeads, merchants, stripeConnected, disputes, openDisputes: outcomes.open },
    kpis,
    funnel: [
      { label: 'Audit leads', value: auditLeads },
      { label: 'Waitlist signups', value: waitlist },
      { label: 'Merchants', value: merchants },
      { label: 'Stripe connected', value: stripeConnected },
    ],
    conversionRate: auditLeads > 0 ? merchants / auditLeads : null,
    activationRate: merchants > 0 ? stripeConnected / merchants : null,
    outcomes,
    vamp,
    vampAtRisk,
    worklist: worklist.slice(0, WORKLIST_PREVIEW_SIZE),
    worklistTotal: worklist.length,
    recentSignups: rows<RecentSignup>(recentSignupsResult),
    recentAuditLeads: rows<AuditLeadRow>(recentAuditResult),
    recentMerchants: rows<MerchantRow>(recentMerchantsResult),
    feed: feed.slice(0, FEED_PREVIEW_SIZE),
  };
}

// ── Helpers (log-and-degrade, mirroring lib/admin/queries.ts) ────────────────

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

function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

function buildKpi(sourceRows: TimestampRow[], range: RangeKey, now: number): CommandKpi {
  const compare = compareCount(sourceRows, range, now);
  return {
    current: compare.current,
    prior: compare.prior,
    delta: compare.delta,
    spark: buildSeries(sourceRows, range, now, null),
  };
}

function summarizeDisputes(disputeRows: DisputeRow[]): {
  open: number;
  won: number;
  lost: number;
  warningClosed: number;
} {
  const openStatuses = new Set(['needs_response', 'under_review', 'submitted']);
  let open = 0;
  let won = 0;
  let lost = 0;
  let warningClosed = 0;
  for (const row of disputeRows) {
    if (openStatuses.has(row.status)) open += 1;
    if (row.outcome === 'won') won += 1;
    else if (row.outcome === 'lost') lost += 1;
    else if (row.outcome === 'warning_closed') warningClosed += 1;
  }
  return { open, won, lost, warningClosed };
}

/** Latest snapshot per merchant, bucketed into VAMP standing bands. */
function latestVampByMerchant(snapshotRows: VampSnapshotRow[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const row of snapshotRows) {
    if (latest.has(row.merchant_id)) continue;
    const ratio = Number(row.estimated_vamp_ratio);
    if (!Number.isFinite(ratio)) continue;
    latest.set(row.merchant_id, ratio);
  }
  return latest;
}

function summarizeVamp(
  snapshotRows: VampSnapshotRow[],
  totalMerchants: number,
): { healthy: number; close: number; atRisk: number; notScored: number; measured: number } {
  const latest = latestVampByMerchant(snapshotRows);
  let healthy = 0;
  let close = 0;
  let atRisk = 0;
  for (const ratio of latest.values()) {
    if (ratio >= VAMP_STRIPE_LINE) atRisk += 1;
    else if (ratio >= VAMP_HEALTHY_BELOW) close += 1;
    else healthy += 1;
  }
  const measured = healthy + close + atRisk;
  const notScored = Math.max(totalMerchants - measured, 0);
  return { healthy, close, atRisk, notScored, measured };
}

function buildVampAtRisk(
  snapshotRows: VampSnapshotRow[],
  nameById: Map<string, string | null>,
): VampAtRiskItem[] {
  const latest = latestVampByMerchant(snapshotRows);
  const items: VampAtRiskItem[] = [];
  for (const [merchantId, ratio] of latest.entries()) {
    if (ratio < VAMP_STRIPE_LINE) continue;
    const ratioPct = ratio * 100;
    const businessName = nameById.get(merchantId) ?? null;
    items.push({
      merchantId,
      businessName,
      ratioPct,
      draft: draftVampAlert({ businessName, ratioPct }),
    });
  }
  return items.sort((a, b) => b.ratioPct - a.ratioPct);
}

function buildFeed({
  events,
  merchants,
  waitlist,
  audit,
}: {
  events: AdminEventRow[];
  merchants: MerchantRow[];
  waitlist: WaitlistSignupRow[];
  audit: { id: string; email: string; business_name: string | null; created_at: string }[];
}): FeedItem[] {
  const items: FeedItem[] = [];
  for (const e of events) {
    items.push({
      id: `event-${e.id}`,
      when: e.created_at,
      kind: 'admin',
      text: `${humanizeAction(e.action)}${e.admin_email ? ` by ${e.admin_email}` : ''}`,
    });
  }
  for (const m of merchants) {
    items.push({
      id: `merchant-${m.id}`,
      when: m.created_at,
      kind: 'merchant',
      text: `New merchant: ${m.business_name || 'Unnamed workspace'}`,
    });
  }
  for (const w of waitlist) {
    items.push({ id: `waitlist-${w.id}`, when: w.created_at, kind: 'waitlist', text: `Waitlist signup: ${w.email}` });
  }
  for (const a of audit) {
    items.push({
      id: `audit-${a.id}`,
      when: a.created_at,
      kind: 'audit',
      text: `Audit lead: ${a.business_name || a.email}`,
    });
  }
  return items.sort((a, b) => Date.parse(b.when) - Date.parse(a.when)).slice(0, 16);
}

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    platform_invite_approved: 'Invite approved',
    platform_invite_revoked: 'Invite revoked',
    admission_mode_changed: 'Admission mode changed',
    platform_admin_added: 'Admin added',
    platform_admin_revoked: 'Admin revoked',
    platform_financials_updated: 'Economics inputs updated',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}
