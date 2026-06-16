import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';

// ─────────────────────────────────────────────────────────────────────────────
// Activity — one unified, searchable, filterable history. We merge admin
// actions (platform_admin_events) with synthesized product events (new
// merchants, waitlist signups, audit leads, new disputes, and dispute outcome
// changes) into a single Event[] sorted newest-first and capped to a generously
// loaded set. The client view does the searching / filtering / pagination.
// ─────────────────────────────────────────────────────────────────────────────

const PER_SOURCE_LIMIT = 300;
const MERGED_CAP = 300;

export type ActivityKind = 'admin' | 'merchant' | 'waitlist' | 'audit' | 'dispute';

export type ActivityEvent = {
  /** Stable, source-prefixed id so React keys never collide across sources. */
  id: string;
  /** ISO timestamp the event happened at. */
  at: string;
  kind: ActivityKind;
  /** Human one-line description. Already humanized, safe to render directly. */
  text: string;
  /** Optional secondary line (email, id, outcome) for context. */
  detail: string | null;
};

export type ActivityData = {
  admin: PlatformAdmin;
  events: ActivityEvent[];
  /** Per-kind totals over the loaded window — drives the filter chip counts. */
  counts: Record<ActivityKind, number>;
  /** True when at least one source query came back capped (more history exists). */
  truncated: boolean;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type AdminEventRow = {
  id: string;
  admin_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
};

type MerchantRow = { id: string; business_name: string | null; created_at: string };
type WaitlistRow = { id: string; email: string | null; source: string | null; created_at: string };
type AuditRow = {
  id: string;
  email: string | null;
  business_name: string | null;
  standing_band: string | null;
  converted_merchant_id: string | null;
  created_at: string;
};
type DisputeRow = {
  id: string;
  merchant_id: string | null;
  reason: string | null;
  network: string | null;
  outcome: string | null;
  status: string | null;
  created_at: string;
};

export async function getActivityData(): Promise<ActivityData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();

  const [eventsResult, merchantsResult, waitlistResult, auditResult, disputesResult] = await Promise.all([
    service
      .from('platform_admin_events')
      .select('id, admin_email, action, target_type, target_id, created_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    service
      .from('merchants')
      .select('id, business_name, created_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    service
      .from('waitlist_signups')
      .select('id, email, source, created_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    service
      .from('audit_leads')
      .select('id, email, business_name, standing_band, converted_merchant_id, created_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
    service
      .from('disputes')
      .select('id, merchant_id, reason, network, outcome, status, created_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT),
  ]);

  const checks: { label: string; result: QueryResult<unknown> }[] = [
    { label: 'admin_events', result: eventsResult },
    { label: 'merchants', result: merchantsResult },
    { label: 'waitlist_signups', result: waitlistResult },
    { label: 'audit_leads', result: auditResult },
    { label: 'disputes', result: disputesResult },
  ];
  checks.forEach(({ label, result }) => logQueryError(`activity ${label}`, result));

  const eventRows = rows<AdminEventRow>(eventsResult);
  const merchantRows = rows<MerchantRow>(merchantsResult);
  const waitlistRows = rows<WaitlistRow>(waitlistResult);
  const auditRows = rows<AuditRow>(auditResult);
  const disputeRows = rows<DisputeRow>(disputesResult);

  const merged: ActivityEvent[] = [
    ...eventRows.map(toAdminEvent),
    ...merchantRows.map(toMerchantEvent),
    ...waitlistRows.map(toWaitlistEvent),
    ...auditRows.map(toAuditEvent),
    ...disputeRows.flatMap(toDisputeEvents),
  ];

  merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const capped = merged.slice(0, MERGED_CAP);

  const counts = emptyCounts();
  for (const event of capped) {
    counts[event.kind] += 1;
  }

  const truncated =
    eventRows.length >= PER_SOURCE_LIMIT ||
    merchantRows.length >= PER_SOURCE_LIMIT ||
    waitlistRows.length >= PER_SOURCE_LIMIT ||
    auditRows.length >= PER_SOURCE_LIMIT ||
    disputeRows.length >= PER_SOURCE_LIMIT ||
    merged.length > MERGED_CAP;

  return { admin, events: capped, counts, truncated };
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function toAdminEvent(row: AdminEventRow): ActivityEvent {
  return {
    id: `admin-${row.id}`,
    at: row.created_at,
    kind: 'admin',
    text: humanizeAction(row.action),
    detail: row.admin_email ? `by ${row.admin_email}` : null,
  };
}

function toMerchantEvent(row: MerchantRow): ActivityEvent {
  return {
    id: `merchant-${row.id}`,
    at: row.created_at,
    kind: 'merchant',
    text: `New merchant: ${row.business_name?.trim() || 'Unnamed workspace'}`,
    detail: null,
  };
}

function toWaitlistEvent(row: WaitlistRow): ActivityEvent {
  return {
    id: `waitlist-${row.id}`,
    at: row.created_at,
    kind: 'waitlist',
    text: `Waitlist signup: ${row.email?.trim() || 'unknown email'}`,
    detail: row.source ? `via ${row.source}` : null,
  };
}

function toAuditEvent(row: AuditRow): ActivityEvent {
  const who = row.business_name?.trim() || row.email?.trim() || 'unknown lead';
  const band = humanizeBand(row.standing_band);
  const detailParts = [band, row.converted_merchant_id ? 'converted to merchant' : null].filter(Boolean);
  return {
    id: `audit-${row.id}`,
    at: row.created_at,
    kind: 'audit',
    text: `Audit lead: ${who}`,
    detail: detailParts.length > 0 ? detailParts.join(' · ') : null,
  };
}

/**
 * A dispute can yield up to two events: its creation, and (when resolved) an
 * outcome change. We can only honestly date the creation; an outcome row gets
 * the same created_at because we do not capture a separate resolved_at column
 * yet. Both are surfaced so the history reads completely.
 */
function toDisputeEvents(row: DisputeRow): ActivityEvent[] {
  const reason = row.reason?.trim();
  const network = humanizeNetwork(row.network);
  const events: ActivityEvent[] = [
    {
      id: `dispute-new-${row.id}`,
      at: row.created_at,
      kind: 'dispute',
      text: `New dispute${reason ? `: ${reason}` : ''}`,
      detail: network,
    },
  ];

  if (row.outcome === 'won' || row.outcome === 'lost' || row.outcome === 'warning_closed') {
    events.push({
      id: `dispute-outcome-${row.id}`,
      at: row.created_at,
      kind: 'dispute',
      text: `Dispute ${humanizeOutcome(row.outcome)}${reason ? `: ${reason}` : ''}`,
      detail: network,
    });
  }

  return events;
}

// ── Humanizers ───────────────────────────────────────────────────────────────

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    platform_invite_approved: 'Invite approved',
    platform_invite_revoked: 'Invite revoked',
    admission_mode_changed: 'Admission mode changed',
    platform_admin_added: 'Admin added',
    platform_admin_revoked: 'Admin revoked',
    platform_financials_updated: 'Economics inputs updated',
    vamp_notification_drafted: 'VAMP alert drafted',
    financial_scenario_saved: 'Financial scenario saved',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

function humanizeBand(band: string | null): string | null {
  const b = (band ?? '').trim();
  if (!b || b === 'unknown') return null;
  const map: Record<string, string> = {
    tooEarly: 'too early to score',
    too_early: 'too early to score',
    healthy: 'healthy standing',
    close: 'getting close',
    atRisk: 'over the line',
    at_risk: 'over the line',
  };
  return map[b] ?? b;
}

function humanizeNetwork(network: string | null): string | null {
  const n = (network ?? '').trim();
  if (!n || n === 'unknown') return null;
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    discover: 'Discover',
  };
  return map[n] ?? n;
}

function humanizeOutcome(outcome: string): string {
  if (outcome === 'won') return 'won';
  if (outcome === 'lost') return 'lost';
  if (outcome === 'warning_closed') return 'closed (warning)';
  return outcome.replace(/_/g, ' ');
}

// ── Small log-and-degrade helpers (mirrors lib/admin/queries.ts) ─────────────

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

function emptyCounts(): Record<ActivityKind, number> {
  return { admin: 0, merchant: 0, waitlist: 0, audit: 0, dispute: 0 };
}
