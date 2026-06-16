import 'server-only';

import { requirePlatformAdmin, type PlatformAdmin } from '@/lib/admin/platform-admin';
import { createServiceClient } from '@/lib/supabase/server';
import { getFinancials, type FinancialInputs } from '@/lib/admin/financials';
import type { EconomicsDrivers } from '@/lib/admin/economics';

// ─────────────────────────────────────────────────────────────────────────────
// Economics cockpit loader.
//
// Returns the three things the client cockpit needs to recompute the whole model
// in the browser on every slider drag:
//   1. The saved founder inputs (working baseline).
//   2. The real, DB-derived drivers (same derivation as the read-only page used).
//   3. Named scenarios from `platform_financial_scenarios` (read defensively —
//      the table may not exist yet if the migration is unapplied).
//
// Every query degrades to a safe zero/empty rather than throwing, so the cockpit
// always renders. Saving surfaces its own error if a table is missing.
// ─────────────────────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type ServiceClient = ReturnType<typeof createServiceClient>;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type DisputeRow = { status: string; outcome: string | null; amount: number | null; created_at: string };

/** A saved what-if scenario the founder can load into the cockpit. */
export type ScenarioKind = 'base' | 'upside' | 'risk' | 'custom';

export type EconomicsScenario = {
  id: string;
  name: string;
  kind: ScenarioKind;
  inputs: Partial<FinancialInputs>;
  notes: string | null;
  isPinned: boolean;
  createdAt: string;
};

export type EconomicsCockpitData = {
  admin: PlatformAdmin;
  inputs: FinancialInputs;
  drivers: EconomicsDrivers;
  scenarios: EconomicsScenario[];
  scenariosAvailable: boolean;
};

export async function getEconomicsCockpitData(): Promise<EconomicsCockpitData> {
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
    scenariosResult,
  ] = await Promise.all([
    getFinancials(service),
    service.from('merchants').select('id', { count: 'exact', head: true }),
    service
      .from('processor_connections')
      .select('id', { count: 'exact', head: true })
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected'),
    service
      .from('disputes')
      .select('status, outcome, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),
    service.from('disputes').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    service.from('merchants').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    loadScenarios(service),
  ]);

  const checks: QueryResult<unknown>[] = [
    merchantCount,
    stripeCount,
    disputeRowsResult,
    disputes30Result,
    merchants30Result,
  ];
  checks.forEach((r, i) => logQueryError(`economics cockpit query ${i + 1}`, r));

  const disputeRows = rows<DisputeRow>(disputeRowsResult);
  const outcomes = summarizeDisputes(disputeRows);
  const avgUsd = summarizeAvgAmount(disputeRows);

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
    avgDisputeAmountUsd: avgUsd,
  };

  return {
    admin,
    inputs,
    drivers,
    scenarios: scenariosResult.scenarios,
    scenariosAvailable: scenariosResult.available,
  };
}

// ── Scenario loading (defensive) ─────────────────────────────────────────────

type ScenarioRow = {
  id: string;
  name: string | null;
  kind: string | null;
  inputs: unknown;
  notes: string | null;
  is_pinned: boolean | null;
  created_at: string;
};

async function loadScenarios(
  service: ServiceClient,
): Promise<{ scenarios: EconomicsScenario[]; available: boolean }> {
  try {
    const result = await service
      .from('platform_financial_scenarios')
      .select('id, name, kind, inputs, notes, is_pinned, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (result.error) {
      // Table absent (unapplied migration) or transient error — degrade to empty.
      console.error('[admin] could not load financial scenarios:', result.error.message);
      return { scenarios: [], available: false };
    }

    const scenarios = rows<ScenarioRow>(result).map(normalizeScenario);
    return { scenarios, available: true };
  } catch (error) {
    console.error(
      '[admin] financial scenarios table unavailable:',
      error instanceof Error ? error.message : error,
    );
    return { scenarios: [], available: false };
  }
}

const VALID_KINDS: ReadonlySet<ScenarioKind> = new Set(['base', 'upside', 'risk', 'custom']);

function normalizeScenario(row: ScenarioRow): EconomicsScenario {
  const kind = (row.kind ?? '').trim() as ScenarioKind;
  return {
    id: row.id,
    name: (row.name ?? '').trim() || 'Untitled scenario',
    kind: VALID_KINDS.has(kind) ? kind : 'custom',
    inputs: coerceInputs(row.inputs),
    notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
    isPinned: row.is_pinned === true,
    createdAt: row.created_at,
  };
}

/** Pull only finite numeric (or null override) fields out of a stored jsonb blob. */
function coerceInputs(raw: unknown): Partial<FinancialInputs> {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: Partial<FinancialInputs> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'currency') {
      if (typeof value === 'string' && value) out.currency = value;
      continue;
    }
    if (key === 'updatedAt') continue; // never restore meta from a scenario
    if (key === 'payingCustomersOverride') {
      if (value === null) out.payingCustomersOverride = null;
      else if (typeof value === 'number' && Number.isFinite(value)) out.payingCustomersOverride = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      (out as Record<string, number>)[key] = value;
    }
  }
  return out;
}

// ── Local helpers (mirror lib/admin/queries.ts log-and-degrade pattern) ───────

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

function summarizeDisputes(disputeRows: DisputeRow[]): { open: number; won: number; lost: number } {
  const openStatuses = new Set(['needs_response', 'under_review', 'submitted']);
  let open = 0;
  let won = 0;
  let lost = 0;
  for (const row of disputeRows) {
    if (openStatuses.has(row.status)) open += 1;
    if (row.outcome === 'won') won += 1;
    else if (row.outcome === 'lost') lost += 1;
  }
  return { open, won, lost };
}

function summarizeAvgAmount(disputeRows: DisputeRow[]): number | null {
  let sumCents = 0;
  let n = 0;
  for (const row of disputeRows) {
    if (row.amount == null || !Number.isFinite(row.amount)) continue;
    sumCents += row.amount;
    n += 1;
  }
  return n > 0 ? sumCents / n / 100 : null;
}
