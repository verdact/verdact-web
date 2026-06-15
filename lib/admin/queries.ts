import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from './platform-admin';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const VAMP_STRIPE_LINE = 0.0075;

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

export type AdminTrend = {
  label: string;
  last7: number;
  previous7: number;
};

export type AdminStats = {
  platformAdmins: number;
  invitesApproved: number;
  waitlistSignups: number;
  auditLeads: number;
  convertedAuditLeads: number;
  merchants: number;
  activeMerchantUsers: number;
  stripeConnections: number;
  disputes: number;
  openDisputes: number;
  wonDisputes: number;
  lostDisputes: number;
  vampAtRiskMerchants: number;
};

export type AdminDashboardData = {
  admin: PlatformAdmin;
  policy: AdmissionPolicyRow;
  admins: PlatformAdminListRow[];
  invites: PlatformInviteRow[];
  waitlist: WaitlistSignupRow[];
  auditLeads: AuditLeadRow[];
  merchants: MerchantRow[];
  events: AdminEventRow[];
  stats: AdminStats;
  trends: AdminTrend[];
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type TimestampRow = { created_at: string };
type DisputeStatusRow = { status: string; outcome: string | null; created_at: string };
type VampSnapshotRow = {
  merchant_id: string;
  estimated_vamp_ratio: number | string | null;
  calculated_at: string;
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();
  const since14 = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();

  const [
    policyResult,
    adminsResult,
    invitesResult,
    waitlistResult,
    auditLeadsResult,
    merchantsResult,
    eventsResult,
    merchantCountResult,
    activeMerchantUsersResult,
    stripeConnectionCountResult,
    invitesApprovedCountResult,
    waitlistCountResult,
    auditLeadCountResult,
    convertedAuditLeadCountResult,
    disputeCountResult,
    disputeRowsResult,
    vampSnapshotsResult,
    waitlistTrendResult,
    auditTrendResult,
    merchantTrendResult,
    disputeTrendResult,
  ] = await Promise.all([
    service
      .from('platform_admission_policy')
      .select('mode, updated_at, updated_by')
      .eq('id', true)
      .maybeSingle(),
    service
      .from('platform_admins')
      .select('email, role, status, last_seen_at, created_at')
      .order('created_at', { ascending: true })
      .limit(25),
    service
      .from('platform_invites')
      .select('id, email, status, source, notes, expires_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('waitlist_signups')
      .select('id, email, source, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('audit_leads')
      .select(
        'id, email, business_name, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, converted_merchant_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('merchants')
      .select('id, business_name, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    service
      .from('platform_admin_events')
      .select('id, admin_email, action, target_type, target_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service
      .from('merchant_users')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    service
      .from('processor_connections')
      .select('id', { count: 'exact', head: true })
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected'),
    service
      .from('platform_invites')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    service.from('waitlist_signups').select('id', { count: 'exact', head: true }),
    service.from('audit_leads').select('id', { count: 'exact', head: true }),
    service
      .from('audit_leads')
      .select('id', { count: 'exact', head: true })
      .not('converted_merchant_id', 'is', null),
    service.from('disputes').select('id', { count: 'exact', head: true }),
    service
      .from('disputes')
      .select('status, outcome, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    service
      .from('vamp_snapshots')
      .select('merchant_id, estimated_vamp_ratio, calculated_at')
      .order('calculated_at', { ascending: false })
      .limit(500),
    service.from('waitlist_signups').select('created_at').gte('created_at', since14).limit(1000),
    service.from('audit_leads').select('created_at').gte('created_at', since14).limit(1000),
    service.from('merchants').select('created_at').gte('created_at', since14).limit(1000),
    service.from('disputes').select('created_at').gte('created_at', since14).limit(1000),
  ]);

  [
    policyResult,
    adminsResult,
    invitesResult,
    waitlistResult,
    auditLeadsResult,
    merchantsResult,
    eventsResult,
    merchantCountResult,
    activeMerchantUsersResult,
    stripeConnectionCountResult,
    invitesApprovedCountResult,
    waitlistCountResult,
    auditLeadCountResult,
    convertedAuditLeadCountResult,
    disputeCountResult,
    disputeRowsResult,
    vampSnapshotsResult,
    waitlistTrendResult,
    auditTrendResult,
    merchantTrendResult,
    disputeTrendResult,
  ].forEach((result, index) => assertNoError(`admin query ${index + 1}`, result));

  const disputeRows = rows<DisputeStatusRow>(disputeRowsResult);
  const disputeSummary = summarizeDisputes(disputeRows);
  const vampAtRiskMerchants = countVampAtRisk(rows<VampSnapshotRow>(vampSnapshotsResult));

  return {
    admin,
    policy:
      (policyResult.data as AdmissionPolicyRow | null) ?? {
        mode: 'invite_only',
        updated_at: new Date(0).toISOString(),
        updated_by: null,
      },
    admins: rows<PlatformAdminListRow>(adminsResult),
    invites: rows<PlatformInviteRow>(invitesResult),
    waitlist: rows<WaitlistSignupRow>(waitlistResult),
    auditLeads: rows<AuditLeadRow>(auditLeadsResult),
    merchants: rows<MerchantRow>(merchantsResult),
    events: rows<AdminEventRow>(eventsResult),
    stats: {
      platformAdmins: countRows(adminsResult),
      invitesApproved: countRows(invitesApprovedCountResult),
      waitlistSignups: countRows(waitlistCountResult),
      auditLeads: countRows(auditLeadCountResult),
      convertedAuditLeads: countRows(convertedAuditLeadCountResult),
      merchants: countRows(merchantCountResult),
      activeMerchantUsers: countRows(activeMerchantUsersResult),
      stripeConnections: countRows(stripeConnectionCountResult),
      disputes: countRows(disputeCountResult),
      openDisputes: disputeSummary.open,
      wonDisputes: disputeSummary.won,
      lostDisputes: disputeSummary.lost,
      vampAtRiskMerchants,
    },
    trends: [
      trend('Waitlist', rows<TimestampRow>(waitlistTrendResult)),
      trend('Audit leads', rows<TimestampRow>(auditTrendResult)),
      trend('Merchants', rows<TimestampRow>(merchantTrendResult)),
      trend('Disputes', rows<TimestampRow>(disputeTrendResult)),
    ],
  };
}

function assertNoError(label: string, result: QueryResult<unknown>): void {
  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
}

function rows<T>(result: QueryResult<unknown>): T[] {
  return (result.data ?? []) as T[];
}

function countRows(result: QueryResult<unknown>): number {
  return result.count ?? rows<unknown>(result).length;
}

function trend(label: string, sourceRows: TimestampRow[]): AdminTrend {
  const now = Date.now();
  const last7Start = now - SEVEN_DAYS_MS;
  const previous7Start = now - FOURTEEN_DAYS_MS;

  let last7 = 0;
  let previous7 = 0;

  for (const row of sourceRows) {
    const time = Date.parse(row.created_at);
    if (!Number.isFinite(time)) continue;
    if (time >= last7Start) {
      last7 += 1;
    } else if (time >= previous7Start) {
      previous7 += 1;
    }
  }

  return { label, last7, previous7 };
}

function summarizeDisputes(rows: DisputeStatusRow[]): { open: number; won: number; lost: number } {
  const openStatuses = new Set(['needs_response', 'under_review', 'submitted']);
  let open = 0;
  let won = 0;
  let lost = 0;

  for (const row of rows) {
    if (openStatuses.has(row.status)) open += 1;
    if (row.outcome === 'won') won += 1;
    if (row.outcome === 'lost') lost += 1;
  }

  return { open, won, lost };
}

function countVampAtRisk(rows: VampSnapshotRow[]): number {
  const latestByMerchant = new Map<string, VampSnapshotRow>();

  for (const row of rows) {
    if (!latestByMerchant.has(row.merchant_id)) {
      latestByMerchant.set(row.merchant_id, row);
    }
  }

  let atRisk = 0;
  for (const row of latestByMerchant.values()) {
    const ratio = Number(row.estimated_vamp_ratio);
    if (Number.isFinite(ratio) && ratio >= VAMP_STRIPE_LINE) {
      atRisk += 1;
    }
  }

  return atRisk;
}
