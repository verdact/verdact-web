import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import { FEEDBACK_STATUSES, type FeedbackCategory, type FeedbackStatus, type FeedbackSurface } from '@/lib/feedback/schema';

// ─────────────────────────────────────────────────────────────────────────────
// Admin "Feedback inbox" loader (founder-only).
//
// Mirrors leads/data.ts: requirePlatformAdmin gates the page, reads run through
// the service-role client (which bypasses RLS — the founder allowlist is the
// gate), and every query logs-and-degrades so one failed slice still renders the
// page. Status is filtered server-side (with the count per status for the
// segtabs); search + pagination are applied in SQL via LIMIT/OFFSET.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 25;

export type StatusFilter = 'all' | FeedbackStatus;

export type FeedbackRow = {
  id: string;
  created_at: string;
  merchant_id: string | null;
  merchantName: string | null;
  email: string | null;
  surface: FeedbackSurface;
  route: string | null;
  screen: string | null;
  activity: string | null;
  category: FeedbackCategory;
  message: string;
  has_screenshot: boolean;
  status: FeedbackStatus;
  user_agent: string | null;
  triaged_at: string | null;
};

export type FeedbackCounts = {
  all: number;
  new: number;
  triaged: number;
  closed: number;
};

export type FeedbackData = {
  admin: PlatformAdmin;
  rows: FeedbackRow[];
  counts: FeedbackCounts;
  status: StatusFilter;
  query: string;
  page: number;
  pageCount: number;
  total: number;
};

type QueryResult<T> = { data: T | null; error: { message: string } | null; count?: number | null };

export async function getFeedbackData(params: {
  status: StatusFilter;
  query: string;
  page: number;
}): Promise<FeedbackData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();

  const status = normalizeStatus(params.status);
  const query = (params.query ?? '').trim().slice(0, 120);
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.floor(params.page) : 1;

  // ── Per-status counts (drive the segtabs). One head-only count per bucket. ──
  const [allCount, newCount, triagedCount, closedCount] = await Promise.all([
    countByStatus(service, null),
    countByStatus(service, 'new'),
    countByStatus(service, 'triaged'),
    countByStatus(service, 'closed'),
  ]);

  const counts: FeedbackCounts = {
    all: allCount,
    new: newCount,
    triaged: triagedCount,
    closed: closedCount,
  };

  // ── The page of rows for the active filter ──────────────────────────────────
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let listQuery = service
    .from('feedback')
    .select(
      'id, created_at, merchant_id, email, surface, route, screen, activity, category, message, has_screenshot, status, user_agent, triaged_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    listQuery = listQuery.eq('status', status);
  }
  if (query.length > 0) {
    // Case-insensitive across the user-facing text columns.
    const like = `%${escapeLike(query)}%`;
    listQuery = listQuery.or(`message.ilike.${like},email.ilike.${like},screen.ilike.${like}`);
  }

  const listResult = (await listQuery) as QueryResult<Record<string, unknown>[]> & { count?: number | null };
  logQueryError('feedback list', listResult);

  const rawRows = (listResult.data ?? []) as Record<string, unknown>[];
  const total = listResult.count ?? rawRows.length;

  // ── Resolve merchant names for the rows that carry a merchant_id ────────────
  const merchantIds = Array.from(
    new Set(rawRows.map((r) => asString(r.merchant_id)).filter((v): v is string => v !== null)),
  );
  const merchantNames = await resolveMerchantNames(service, merchantIds);

  const rows = rawRows.map((r) => normalizeRow(r, merchantNames));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    admin,
    rows,
    counts,
    status,
    query,
    page,
    pageCount,
    total,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function countByStatus(
  service: ReturnType<typeof createServiceClient>,
  status: FeedbackStatus | null,
): Promise<number> {
  let q = service.from('feedback').select('id', { count: 'exact', head: true });
  if (status) q = q.eq('status', status);
  const result = (await q) as QueryResult<unknown> & { count?: number | null };
  if (result.error) {
    console.error(`[admin] feedback count (${status ?? 'all'}) error:`, result.error.message);
    return 0;
  }
  return result.count ?? 0;
}

async function resolveMerchantNames(
  service: ReturnType<typeof createServiceClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const result = (await service
    .from('merchants')
    .select('id, business_name')
    .in('id', ids)) as QueryResult<{ id: string; business_name: string | null }[]>;
  if (result.error) {
    console.error('[admin] feedback merchant name lookup error:', result.error.message);
    return map;
  }
  for (const row of result.data ?? []) {
    if (row.business_name) map.set(row.id, row.business_name);
  }
  return map;
}

function normalizeRow(r: Record<string, unknown>, names: Map<string, string>): FeedbackRow {
  const merchantId = asString(r.merchant_id);
  return {
    id: String(r.id),
    created_at: asString(r.created_at) ?? new Date(0).toISOString(),
    merchant_id: merchantId,
    merchantName: merchantId ? names.get(merchantId) ?? null : null,
    email: asString(r.email),
    surface: asSurface(r.surface),
    route: asString(r.route),
    screen: asString(r.screen),
    activity: asString(r.activity),
    category: asCategory(r.category),
    message: asString(r.message) ?? '',
    has_screenshot: r.has_screenshot === true,
    status: asStatus(r.status),
    user_agent: asString(r.user_agent),
    triaged_at: asString(r.triaged_at),
  };
}

function normalizeStatus(value: StatusFilter | string | null | undefined): StatusFilter {
  if (value === 'new' || value === 'triaged' || value === 'closed') return value;
  return 'all';
}

function asStatus(value: unknown): FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(String(value))
    ? (value as FeedbackStatus)
    : 'new';
}

function asSurface(value: unknown): FeedbackSurface {
  const v = String(value);
  return v === 'auth' || v === 'marketing' || v === 'prompt' || v === 'app' ? (v as FeedbackSurface) : 'app';
}

function asCategory(value: unknown): FeedbackCategory {
  const v = String(value);
  return v === 'idea' || v === 'problem' || v === 'confusing' || v === 'praise' || v === 'other'
    ? (v as FeedbackCategory)
    : 'other';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Escape PostgREST or-filter wildcards so a search term cannot break the filter.
function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, (m) => `\\${m}`);
}

function logQueryError(label: string, result: QueryResult<unknown>): void {
  if (result.error) {
    console.error(`[admin] ${label} error:`, result.error.message);
  }
}
