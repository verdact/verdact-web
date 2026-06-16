import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from './platform-admin';
import { getFinancials, type FinancialInputs } from './financials';
import { bucketByDay, type SeriesPoint } from './series';
import type { EconomicsDrivers } from './economics';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const FOURTEEN_DAYS_MS = 14 * DAY_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const VAMP_STRIPE_LINE = 0.0075;
const VAMP_HEALTHY_BELOW = 0.005;

type ServiceClient = ReturnType<typeof createServiceClient>;

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

// ── Shared row types (re-exported for views) ─────────────────────────────────

export type AdmissionPolicyRow = {
  mode: 'invite_only' | 'open_beta';
  updated_at: string;
  updated_by: string | null;
};

export type PlatformAdminListRow = {
  email: string;
  role: 'owner' | 'admin';
  status: 'active' | 'revoked';
  last_seen_at: string | null;
  created_at: string;
};

export type PlatformInviteRow = {
  id: string;
  email: string;
  status: 'approved' | 'revoked';
  source: string | null;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WaitlistSignupRow = {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
};

export type AuditLeadRow = {
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
  created_at: string;
};

export type MerchantRow = {
  id: string;
  business_name: string | null;
  created_at: string;
};

export type AdminEventRow = {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type FunnelStepData = { label: string; value: number };
export type FeedItem = { id: string; when: string; text: string; kind: string };

// ── Overview ─────────────────────────────────────────────────────────────────

export type OverviewData = {
  admin: PlatformAdmin;
  admissionMode: 'invite_only' | 'open_beta';
  kpis: {
    waitlist: number;
    auditLeads: number;
    merchants: number;
    stripeConnected: number;
    disputes: number;
    openDisputes: number;
  };
  deltas: {
    waitlist: number;
    auditLeads: number;
    merchants: number;
    disputes: number;
  };
  spark: {
    waitlist: SeriesPoint[];
    auditLeads: SeriesPoint[];
    merchants: SeriesPoint[];
    disputes: SeriesPoint[];
  };
  funnel: FunnelStepData[];
  outcomes: { won: number; lost: number; open: number; warningClosed: number };
  vamp: { healthy: number; close: number; atRisk: number; notScored: number; measured: number };
  conversionRate: number | null; // audit leads -> merchants
  activationRate: number | null; // merchants -> stripe connected
  feed: FeedItem[];
};

export async function getOverviewData(): Promise<OverviewData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();
  const since14 = new Date(now - FOURTEEN_DAYS_MS).toISOString();

  const [
    policyResult,
    waitlistCount,
    auditCount,
    merchantCount,
    stripeCount,
    disputeCount,
    disputeRowsResult,
    vampResult,
    waitlist14,
    audit14,
    merchant14,
    dispute14,
    recentEvents,
    recentMerchants,
    recentWaitlist,
    recentAudit,
  ] = await Promise.all([
    service.from('platform_admission_policy').select('mode, updated_at, updated_by').eq('id', true).maybeSingle(),
    service.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    service.from('audit_leads').select('id', { count: 'exact', head: true }),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service
      .from('processor_connections')
      .select('id', { count: 'exact', head: true })
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected'),
    service.from('disputes').select('id', { count: 'exact', head: true }),
    service.from('disputes').select('status, outcome, amount, created_at').order('created_at', { ascending: false }).limit(2000),
    service.from('vamp_snapshots').select('merchant_id, estimated_vamp_ratio, calculated_at').order('calculated_at', { ascending: false }).limit(1000),
    service.from('waitlist_signups').select('created_at').gte('created_at', since14).limit(2000),
    service.from('audit_leads').select('created_at').gte('created_at', since14).limit(2000),
    service.from('merchants').select('created_at').gte('created_at', since14).limit(2000),
    service.from('disputes').select('created_at').gte('created_at', since14).limit(2000),
    service.from('platform_admin_events').select('id, admin_email, action, created_at').order('created_at', { ascending: false }).limit(12),
    service.from('merchants').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('waitlist_signups').select('id, email, created_at').order('created_at', { ascending: false }).limit(8),
    service.from('audit_leads').select('id, email, business_name, created_at').order('created_at', { ascending: false }).limit(8),
  ]);

  const checks: QueryResult<unknown>[] = [
    policyResult, waitlistCount, auditCount, merchantCount, stripeCount, disputeCount,
    disputeRowsResult, vampResult, waitlist14, audit14, merchant14, dispute14,
    recentEvents, recentMerchants, recentWaitlist, recentAudit,
  ];
  checks.forEach((r, i) => logQueryError(`overview query ${i + 1}`, r));

  const disputeRows = rows<DisputeRow>(disputeRowsResult);
  const outcomes = summarizeDisputes(disputeRows);
  const vamp = summarizeVamp(rows<VampSnapshotRow>(vampResult), countRows(merchantCount));

  const waitlist = countRows(waitlistCount);
  const auditLeads = countRows(auditCount);
  const merchants = countRows(merchantCount);
  const stripeConnected = countRows(stripeCount);
  const disputes = countRows(disputeCount);

  const feed = buildFeed({
    events: rows<AdminEventRow>(recentEvents),
    merchants: rows<MerchantRow>(recentMerchants),
    waitlist: rows<WaitlistSignupRow>(recentWaitlist),
    audit: rows<{ id: string; email: string; business_name: string | null; created_at: string }>(recentAudit),
  });

  return {
    admin,
    admissionMode: (policyResult.data as AdmissionPolicyRow | null)?.mode ?? 'invite_only',
    kpis: { waitlist, auditLeads, merchants, stripeConnected, disputes, openDisputes: outcomes.open },
    deltas: {
      waitlist: delta(rows<TimestampRow>(waitlist14), now),
      auditLeads: delta(rows<TimestampRow>(audit14), now),
      merchants: delta(rows<TimestampRow>(merchant14), now),
      disputes: delta(rows<TimestampRow>(dispute14), now),
    },
    spark: {
      waitlist: bucketByDay(rows<TimestampRow>(waitlist14), 14, now),
      auditLeads: bucketByDay(rows<TimestampRow>(audit14), 14, now),
      merchants: bucketByDay(rows<TimestampRow>(merchant14), 14, now),
      disputes: bucketByDay(rows<TimestampRow>(dispute14), 14, now),
    },
    funnel: [
      { label: 'Audit leads', value: auditLeads },
      { label: 'Waitlist signups', value: waitlist },
      { label: 'Merchants', value: merchants },
      { label: 'Stripe connected', value: stripeConnected },
    ],
    outcomes,
    vamp,
    conversionRate: auditLeads > 0 ? merchants / auditLeads : null,
    activationRate: merchants > 0 ? stripeConnected / merchants : null,
    feed,
  };
}

// ── Growth ───────────────────────────────────────────────────────────────────

export type GrowthData = {
  admin: PlatformAdmin;
  series30: {
    waitlist: SeriesPoint[];
    auditLeads: SeriesPoint[];
    merchants: SeriesPoint[];
    disputes: SeriesPoint[];
  };
  totals: { waitlist: number; auditLeads: number; merchants: number; disputes: number; stripeConnected: number };
  funnel: FunnelStepData[];
  waitlistRows: WaitlistSignupRow[];
  auditRows: AuditLeadRow[];
  merchantRows: MerchantRow[];
};

export async function getGrowthData(): Promise<GrowthData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();
  const since30 = new Date(now - THIRTY_DAYS_MS).toISOString();

  const [
    waitlistCount, auditCount, merchantCount, stripeCount, disputeCount,
    waitlist30, audit30, merchant30, dispute30,
    waitlistRows, auditRows, merchantRows,
  ] = await Promise.all([
    service.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    service.from('audit_leads').select('id', { count: 'exact', head: true }),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service.from('processor_connections').select('id', { count: 'exact', head: true }).eq('processor', 'stripe').eq('connection_status', 'connected'),
    service.from('disputes').select('id', { count: 'exact', head: true }),
    service.from('waitlist_signups').select('created_at').gte('created_at', since30).limit(5000),
    service.from('audit_leads').select('created_at').gte('created_at', since30).limit(5000),
    service.from('merchants').select('created_at').gte('created_at', since30).limit(5000),
    service.from('disputes').select('created_at').gte('created_at', since30).limit(5000),
    service.from('waitlist_signups').select('id, email, source, created_at').order('created_at', { ascending: false }).limit(60),
    service.from('audit_leads').select('id, email, business_name, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, converted_merchant_id, created_at').order('created_at', { ascending: false }).limit(60),
    service.from('merchants').select('id, business_name, created_at').order('created_at', { ascending: false }).limit(40),
  ]);

  const checks: QueryResult<unknown>[] = [
    waitlistCount, auditCount, merchantCount, stripeCount, disputeCount,
    waitlist30, audit30, merchant30, dispute30, waitlistRows, auditRows, merchantRows,
  ];
  checks.forEach((r, i) => logQueryError(`growth query ${i + 1}`, r));

  const waitlist = countRows(waitlistCount);
  const auditLeads = countRows(auditCount);
  const merchants = countRows(merchantCount);
  const stripeConnected = countRows(stripeCount);
  const disputes = countRows(disputeCount);

  return {
    admin,
    series30: {
      waitlist: bucketByDay(rows<TimestampRow>(waitlist30), 30, now),
      auditLeads: bucketByDay(rows<TimestampRow>(audit30), 30, now),
      merchants: bucketByDay(rows<TimestampRow>(merchant30), 30, now),
      disputes: bucketByDay(rows<TimestampRow>(dispute30), 30, now),
    },
    totals: { waitlist, auditLeads, merchants, disputes, stripeConnected },
    funnel: [
      { label: 'Audit leads', value: auditLeads },
      { label: 'Waitlist signups', value: waitlist },
      { label: 'Merchants', value: merchants },
      { label: 'Stripe connected', value: stripeConnected },
    ],
    waitlistRows: rows<WaitlistSignupRow>(waitlistRows),
    auditRows: rows<AuditLeadRow>(auditRows),
    merchantRows: rows<MerchantRow>(merchantRows),
  };
}

// ── Economics ────────────────────────────────────────────────────────────────

export type EconomicsQueryData = {
  admin: PlatformAdmin;
  inputs: FinancialInputs;
  drivers: EconomicsDrivers;
};

export async function getEconomicsData(): Promise<EconomicsQueryData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const now = Date.now();
  const since30 = new Date(now - THIRTY_DAYS_MS).toISOString();

  const [
    inputs,
    merchantCount,
    stripeCount,
    disputeRowsResult,
    disputes30Result,
    merchants30Result,
  ] = await Promise.all([
    getFinancials(service),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service.from('processor_connections').select('id', { count: 'exact', head: true }).eq('processor', 'stripe').eq('connection_status', 'connected'),
    service.from('disputes').select('status, outcome, amount, created_at').order('created_at', { ascending: false }).limit(5000),
    service.from('disputes').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    service.from('merchants').select('id', { count: 'exact', head: true }).gte('created_at', since30),
  ]);

  const checks: QueryResult<unknown>[] = [merchantCount, stripeCount, disputeRowsResult, disputes30Result, merchants30Result];
  checks.forEach((r, i) => logQueryError(`economics query ${i + 1}`, r));

  const disputeRows = rows<DisputeRow>(disputeRowsResult);
  const outcomes = summarizeDisputes(disputeRows);
  const amountStats = summarizeAmounts(disputeRows);

  const drivers: EconomicsDrivers = {
    totalMerchants: countRows(merchantCount),
    activeMerchants: countRows(stripeCount),
    payingCustomers: 0, // no billing yet; override in inputs once charging begins
    disputesTotal: disputeRows.length,
    disputesWon: outcomes.won,
    disputesLost: outcomes.lost,
    disputesOpen: outcomes.open,
    disputesLast30d: countRows(disputes30Result),
    newMerchantsLast30d: countRows(merchants30Result),
    avgDisputeAmountUsd: amountStats.avgUsd,
  };

  return { admin, inputs, drivers };
}

// ── Access ───────────────────────────────────────────────────────────────────

export type AccessData = {
  admin: PlatformAdmin;
  policy: AdmissionPolicyRow;
  invitesApproved: number;
  invites: PlatformInviteRow[];
  admins: PlatformAdminListRow[];
  events: AdminEventRow[];
};

export async function getAccessData(): Promise<AccessData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();

  const [policyResult, invitesApprovedCount, invitesResult, adminsResult, eventsResult] = await Promise.all([
    service.from('platform_admission_policy').select('mode, updated_at, updated_by').eq('id', true).maybeSingle(),
    service.from('platform_invites').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    service.from('platform_invites').select('id, email, status, source, notes, expires_at, created_at, updated_at').order('created_at', { ascending: false }).limit(100),
    service.from('platform_admins').select('email, role, status, last_seen_at, created_at').order('created_at', { ascending: true }).limit(50),
    service.from('platform_admin_events').select('id, admin_email, action, target_type, target_id, metadata, created_at').order('created_at', { ascending: false }).limit(40),
  ]);

  const checks: QueryResult<unknown>[] = [policyResult, invitesApprovedCount, invitesResult, adminsResult, eventsResult];
  checks.forEach((r, i) => logQueryError(`access query ${i + 1}`, r));

  return {
    admin,
    policy: (policyResult.data as AdmissionPolicyRow | null) ?? {
      mode: 'invite_only',
      updated_at: new Date(0).toISOString(),
      updated_by: null,
    },
    invitesApproved: countRows(invitesApprovedCount),
    invites: rows<PlatformInviteRow>(invitesResult),
    admins: rows<PlatformAdminListRow>(adminsResult),
    events: rows<AdminEventRow>(eventsResult),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function logQueryError(label: string, result: QueryResult<unknown>): void {
  if (result.error) {
    // Degrade gracefully: a single failed or aborted query (e.g. a prefetch the
    // browser cancelled, or a transient DB hiccup) should NOT crash the whole
    // admin page. Log full detail and let the loader fall back to empty/zero for
    // that slice via rows()/countRows().
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

function delta(sourceRows: TimestampRow[], now: number): number {
  const last7Start = now - SEVEN_DAYS_MS;
  const previous7Start = now - FOURTEEN_DAYS_MS;
  let last7 = 0;
  let previous7 = 0;
  for (const row of sourceRows) {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) continue;
    if (t >= last7Start) last7 += 1;
    else if (t >= previous7Start) previous7 += 1;
  }
  return last7 - previous7;
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

function summarizeAmounts(disputeRows: DisputeRow[]): { avgUsd: number | null; totalUsd: number } {
  let sumCents = 0;
  let n = 0;
  for (const row of disputeRows) {
    if (row.amount == null || !Number.isFinite(row.amount)) continue;
    sumCents += row.amount;
    n += 1;
  }
  return { avgUsd: n > 0 ? sumCents / n / 100 : null, totalUsd: sumCents / 100 };
}

function summarizeVamp(
  snapshotRows: VampSnapshotRow[],
  totalMerchants: number,
): { healthy: number; close: number; atRisk: number; notScored: number; measured: number } {
  const latestByMerchant = new Map<string, VampSnapshotRow>();
  for (const row of snapshotRows) {
    if (!latestByMerchant.has(row.merchant_id)) latestByMerchant.set(row.merchant_id, row);
  }
  let healthy = 0;
  let close = 0;
  let atRisk = 0;
  for (const row of latestByMerchant.values()) {
    const ratio = Number(row.estimated_vamp_ratio);
    if (!Number.isFinite(ratio)) continue;
    if (ratio >= VAMP_STRIPE_LINE) atRisk += 1;
    else if (ratio >= VAMP_HEALTHY_BELOW) close += 1;
    else healthy += 1;
  }
  const measured = healthy + close + atRisk;
  const notScored = Math.max(totalMerchants - measured, 0);
  return { healthy, close, atRisk, notScored, measured };
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
  return items
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 16);
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
