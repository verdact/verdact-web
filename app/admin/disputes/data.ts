import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import {
  reasonForDispute,
  aggregateOutcomes,
  type ReasoningInput,
  type OutcomeAggregate,
} from '@/lib/admin/outcome-reasoning';

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES surface loader. Pulls decided + open disputes, joins the merchant
// name, and derives an honest reasoning read per dispute (and across the set)
// via the shared outcome-reasoning brain. Every honesty lock lives in that
// module; this loader only feeds it real, on-file data — never fabricated.
//
// log-and-degrade: a single failed query falls back to empty/zero for that
// slice instead of crashing the page (mirrors lib/admin/queries.ts).
// ─────────────────────────────────────────────────────────────────────────────

const DISPUTE_LIMIT = 2000;

// Readiness keys the evidence packet can carry. We only ever read these off the
// stored draft; we never invent one the merchant did not set.
const READINESS_KEYS = [
  'charge_attached',
  'delivery_proof',
  'policy',
  'product_description',
  'narrative',
  'qa_clear',
] as const;

type ReadinessKey = (typeof READINESS_KEYS)[number];

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type DisputeRow = {
  id: string;
  merchant_id: string | null;
  amount: number | null;
  currency: string | null;
  network: string | null;
  reason: string | null;
  status: string;
  outcome: 'won' | 'lost' | 'warning_closed' | null;
  ce3_eligible: boolean | null;
  evidence_draft: unknown;
  created_at: string;
};

type MerchantNameRow = { id: string; business_name: string | null };

/** A readiness snapshot derived from a dispute's evidence_draft jsonb. */
export type DisputeReadiness = {
  percent: number;
  present: string[];
  missing: string[];
};

/** One dispute as the disputes surface renders it (record + derived reasoning input). */
export type DisputeRecord = {
  id: string;
  merchantId: string | null;
  merchantName: string;
  amountCents: number | null;
  currency: string;
  network: string | null;
  reason: string | null;
  status: string;
  outcome: 'won' | 'lost' | 'warning_closed' | null;
  ce3Eligible: boolean;
  readiness: DisputeReadiness | null;
  createdAt: string;
  /** The exact input handed to reasonForDispute() in the view. */
  reasoning: ReasoningInput;
};

export type DisputesData = {
  admin: PlatformAdmin;
  disputes: DisputeRecord[];
  aggregate: OutcomeAggregate;
};

// ── Loader ──────────────────────────────────────────────────────────────────

export async function getDisputesData(): Promise<DisputesData> {
  const admin = await requirePlatformAdmin();
  const service = createServiceClient();

  const disputesResult = (await service
    .from('disputes')
    .select(
      'id, merchant_id, amount, currency, network, reason, status, outcome, ce3_eligible, evidence_draft, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(DISPUTE_LIMIT)) as QueryResult<DisputeRow[]>;

  logQueryError('disputes rows', disputesResult);
  const disputeRows = rows<DisputeRow>(disputesResult);

  // Second query: resolve merchant names for only the merchants we actually saw.
  const merchantIds = Array.from(
    new Set(disputeRows.map((d) => d.merchant_id).filter((id): id is string => Boolean(id))),
  );

  let merchantNameById = new Map<string, string>();
  if (merchantIds.length > 0) {
    const merchantsResult = (await service
      .from('merchants')
      .select('id, business_name')
      .in('id', merchantIds)) as QueryResult<MerchantNameRow[]>;
    logQueryError('disputes merchant names', merchantsResult);
    merchantNameById = new Map(
      rows<MerchantNameRow>(merchantsResult).map((m) => [
        m.id,
        m.business_name?.trim() || 'Unnamed workspace',
      ]),
    );
  }

  const disputes: DisputeRecord[] = disputeRows.map((row) => {
    const readiness = readinessFromDraft(row.evidence_draft);
    const ce3Eligible = row.ce3_eligible === true;
    const reasoning: ReasoningInput = {
      reason: row.reason,
      network: row.network,
      outcome: row.outcome ?? null,
      status: row.status,
      ce3Eligible,
      readiness,
      amountCents: row.amount,
    };
    return {
      id: row.id,
      merchantId: row.merchant_id,
      merchantName: row.merchant_id
        ? merchantNameById.get(row.merchant_id) ?? 'Unnamed workspace'
        : 'Unknown merchant',
      amountCents: row.amount,
      currency: (row.currency ?? 'usd').toUpperCase(),
      network: row.network,
      reason: row.reason,
      status: row.status,
      outcome: row.outcome ?? null,
      ce3Eligible,
      readiness,
      createdAt: row.created_at,
      reasoning,
    };
  });

  const aggregate = aggregateOutcomes(disputes.map((d) => d.reasoning));

  return { admin, disputes, aggregate };
}

// Re-export so the view can call the same reasoning brain on the carried input.
export { reasonForDispute };

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive an honest readiness snapshot from a stored evidence_draft jsonb.
 * Returns null when there is no draft at all (so the view says "not captured
 * yet" rather than implying a clean or empty packet). We classify each known
 * readiness key as present or missing using only what the draft actually holds.
 */
function readinessFromDraft(draft: unknown): DisputeReadiness | null {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const record = draft as Record<string, unknown>;

  const present: string[] = [];
  const missing: string[] = [];
  for (const key of READINESS_KEYS) {
    if (isPresentInDraft(record, key)) present.push(key);
    else missing.push(key);
  }

  // A draft with zero recognizable readiness signal is treated as "no draft":
  // surfacing an all-missing packet would over-state what we actually know.
  if (present.length === 0) return null;

  const total = present.length + missing.length;
  const percent = total > 0 ? Math.round((present.length / total) * 100) : 0;
  return { percent, present, missing };
}

/**
 * A key counts as present when the draft carries a truthy signal for it. We
 * accept either a flat boolean/value at the key, or a `{ present: [...] }` /
 * `{ readiness: {...} }` shape, so we read the merchant's real packet however
 * it was stored without inventing fields.
 */
function isPresentInDraft(record: Record<string, unknown>, key: ReadinessKey): boolean {
  // Shape 1: explicit present list.
  const presentList = readStringArray(record.present) ?? readStringArray((record.readiness as Record<string, unknown> | undefined)?.present);
  if (presentList && presentList.includes(key)) return true;

  // Shape 2: nested readiness object with boolean flags.
  const readiness = record.readiness;
  if (readiness && typeof readiness === 'object' && !Array.isArray(readiness)) {
    if (isTruthyFlag((readiness as Record<string, unknown>)[key])) return true;
  }

  // Shape 3: flat flag/value directly on the draft.
  return isTruthyFlag(record[key]);
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === 'string');
}

function logQueryError(label: string, result: QueryResult<unknown>): void {
  if (result.error) {
    console.error(`[admin] disputes ${label} error:`, safeStringifyError(result.error));
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
