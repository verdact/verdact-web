import 'server-only';

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ACCOUNT_HEALTH_RECOMPUTE_EVENT = 'verdact/account-health.recompute';
export const VAMP_WINDOW_DAYS = 90;
export const SCORE_FLOOR = 50;
export const STRIPE_LINE = 0.75;
export const GAUGE_MAX = 1.5;
export const STRIPE_API_VERSION = '2023-10-16';

const PAGE_LIMIT = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ProcessorConnectionRow = {
  id: string;
  merchant_id: string;
  processor_account_id: string;
  processor_api_version: string | null;
};

type WindowBounds = {
  days: number;
  startIso: string;
  endIso: string;
  startUnix: number;
  endUnix: number;
};

type LocalDisputeRow = {
  id: string;
  processor_charge_id: string | null;
  ce3_eligible: boolean | null;
};

type LocalEfwRow = {
  id: string;
  processor_charge_id: string | null;
};

type NumeratorCounts = {
  disputeCount: number;
  efwCount: number;
  dedupedNumerator: number;
  doubleCountRemoved: number;
  chargeIds: string[];
  missingChargeIdCount: number;
  ce3EligibleDisputeCount?: number;
};

type StripeChargeCounts = {
  settledCardChargeCount: number;
  scannedChargeCount: number;
  skippedNonCardCount: number;
  skippedUnsettledCount: number;
  chargePages: number;
};

export type VampSnapshotWrite = {
  merchant_id: string;
  calculation_window_start: string;
  calculation_window_end: string;
  visa_settled_transaction_count: number;
  visa_dispute_count: number;
  visa_efw_count: number;
  excluded_pre_dispute_count: number;
  excluded_ce3_qualified_count: number;
  double_count_removed: number;
  estimated_vamp_ratio: number | null;
  confidence_level: 'low' | 'medium' | 'high';
  raw_components: {
    schema_version: 'v1';
    window: {
      days: number;
      start: string;
      end: string;
    };
    pageCounts: {
      stripeCharges: number;
      stripeChargePages: number;
      stripeDisputes: number;
      stripeDisputePages: number;
      stripeEarlyFraudWarnings: number;
      stripeEarlyFraudWarningPages: number;
      localDisputes: number;
      localEarlyFraudWarnings: number;
    };
    fullPaginatedVsSampled: {
      fullPaginated: boolean;
      sampleLimit: null;
    };
    apiVersion: string;
    numeratorSource: 'reconciled' | 'stripe_api' | 'local_db';
    gatesHit: string[];
    localCounts: NumeratorCounts;
    stripeCounts: NumeratorCounts;
    denominator: {
      settledCardCharges: number;
      scannedCharges: number;
      skippedNonCardCharges: number;
      skippedUnsettledCharges: number;
      monthlySettledAverage: number;
      filter: 'charges.list(created) + local paid/status/captured/card filter';
    };
    constants: {
      scoreFloorMonthlySettled: number;
      stripeLinePercent: number;
      gaugeMaxPercent: number;
    };
  };
  calculated_at: string;
};

type StoredSnapshotRow = {
  id: string;
  calculated_at: string;
};

export function getVampWindow(now = new Date()): WindowBounds {
  const endMs = now.getTime();
  const startMs = endMs - VAMP_WINDOW_DAYS * MS_PER_DAY;

  return {
    days: VAMP_WINDOW_DAYS,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    startUnix: Math.floor(startMs / 1000),
    endUnix: Math.floor(endMs / 1000),
  };
}

export function calculateVampRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function getConfidenceLevel({
  monthlySettledAverage,
  localNumerator,
  stripeNumerator,
}: {
  monthlySettledAverage: number;
  localNumerator: number;
  stripeNumerator: number;
}): 'low' | 'medium' | 'high' {
  if (monthlySettledAverage < SCORE_FLOOR) return 'low';
  return localNumerator === stripeNumerator ? 'high' : 'medium';
}

export async function computeVampSnapshot({
  supabase,
  stripe,
  connection,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  stripe: Stripe;
  connection: ProcessorConnectionRow;
  now?: Date;
}): Promise<VampSnapshotWrite> {
  const window = getVampWindow(now);

  const [localCounts, stripeCounts, denominator] = await Promise.all([
    countLocalNumerator({ supabase, connection, window }),
    countStripeNumerator({ stripe, connection, window }),
    countStripeSettledCardCharges({ stripe, connection, window }),
  ]);

  const numeratorSource =
    localCounts.dedupedNumerator === stripeCounts.dedupedNumerator
      ? 'reconciled'
      : stripeCounts.dedupedNumerator > localCounts.dedupedNumerator
        ? 'stripe_api'
        : 'local_db';
  const selectedCounts = numeratorSource === 'local_db' ? localCounts : stripeCounts;
  const numerator = Math.max(localCounts.dedupedNumerator, stripeCounts.dedupedNumerator);
  const monthlySettledAverage = denominator.settledCardChargeCount / (VAMP_WINDOW_DAYS / 30);
  const confidenceLevel = getConfidenceLevel({
    monthlySettledAverage,
    localNumerator: localCounts.dedupedNumerator,
    stripeNumerator: stripeCounts.dedupedNumerator,
  });
  const ratio = calculateVampRatio(numerator, denominator.settledCardChargeCount);
  const gatesHit = buildGatesHit({
    denominator: denominator.settledCardChargeCount,
    monthlySettledAverage,
    localCounts,
    stripeCounts,
    numeratorSource,
  });
  const calculatedAt = now.toISOString();

  return {
    merchant_id: connection.merchant_id,
    calculation_window_start: window.startIso,
    calculation_window_end: window.endIso,
    visa_settled_transaction_count: denominator.settledCardChargeCount,
    visa_dispute_count: selectedCounts.disputeCount,
    visa_efw_count: selectedCounts.efwCount,
    excluded_pre_dispute_count: 0,
    excluded_ce3_qualified_count: 0,
    double_count_removed: selectedCounts.doubleCountRemoved,
    estimated_vamp_ratio: ratio,
    confidence_level: confidenceLevel,
    raw_components: {
      schema_version: 'v1',
      window: {
        days: window.days,
        start: window.startIso,
        end: window.endIso,
      },
      pageCounts: {
        stripeCharges: denominator.scannedChargeCount,
        stripeChargePages: denominator.chargePages,
        stripeDisputes: stripeCounts.disputeCount,
        stripeDisputePages: Math.ceil(stripeCounts.disputeCount / PAGE_LIMIT),
        stripeEarlyFraudWarnings: stripeCounts.efwCount,
        stripeEarlyFraudWarningPages: Math.ceil(stripeCounts.efwCount / PAGE_LIMIT),
        localDisputes: localCounts.disputeCount,
        localEarlyFraudWarnings: localCounts.efwCount,
      },
      fullPaginatedVsSampled: {
        fullPaginated: true,
        sampleLimit: null,
      },
      apiVersion: connection.processor_api_version ?? STRIPE_API_VERSION,
      numeratorSource,
      gatesHit,
      localCounts,
      stripeCounts,
      denominator: {
        settledCardCharges: denominator.settledCardChargeCount,
        scannedCharges: denominator.scannedChargeCount,
        skippedNonCardCharges: denominator.skippedNonCardCount,
        skippedUnsettledCharges: denominator.skippedUnsettledCount,
        monthlySettledAverage,
        filter: 'charges.list(created) + local paid/status/captured/card filter',
      },
      constants: {
        scoreFloorMonthlySettled: SCORE_FLOOR,
        stripeLinePercent: STRIPE_LINE,
        gaugeMaxPercent: GAUGE_MAX,
      },
    },
    calculated_at: calculatedAt,
  };
}

export async function writeVampSnapshot({
  supabase,
  snapshot,
}: {
  supabase: SupabaseClient;
  snapshot: VampSnapshotWrite;
}): Promise<StoredSnapshotRow> {
  const dayStart = startOfUtcDay(snapshot.calculated_at);
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

  const existing = await findSnapshotForUtcDay({
    supabase,
    merchantId: snapshot.merchant_id,
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
  });

  if (existing) {
    const { data, error } = await supabase
      .from('vamp_snapshots')
      .update(snapshot)
      .eq('id', existing.id)
      .select('id, calculated_at')
      .single();

    if (error) throw error;
    return data as StoredSnapshotRow;
  }

  const { data, error } = await supabase
    .from('vamp_snapshots')
    .insert(snapshot)
    .select('id, calculated_at')
    .single();

  if (!error) {
    return data as StoredSnapshotRow;
  }

  if (isUniqueViolation(error)) {
    const racedRow = await findSnapshotForUtcDay({
      supabase,
      merchantId: snapshot.merchant_id,
      dayStartIso: dayStart.toISOString(),
      dayEndIso: dayEnd.toISOString(),
    });

    if (racedRow) {
      const { data: updated, error: updateError } = await supabase
        .from('vamp_snapshots')
        .update(snapshot)
        .eq('id', racedRow.id)
        .select('id, calculated_at')
        .single();

      if (updateError) throw updateError;
      return updated as StoredSnapshotRow;
    }
  }

  throw error;
}

async function countLocalNumerator({
  supabase,
  connection,
  window,
}: {
  supabase: SupabaseClient;
  connection: ProcessorConnectionRow;
  window: WindowBounds;
}): Promise<NumeratorCounts> {
  const [disputeResult, efwResult] = await Promise.all([
    supabase
      .from('disputes')
      .select('id, processor_charge_id, ce3_eligible')
      .eq('merchant_id', connection.merchant_id)
      .eq('processor', 'stripe')
      .eq('processor_account_id', connection.processor_account_id)
      .gte('created_at', window.startIso)
      .lt('created_at', window.endIso),
    supabase
      .from('efw_alerts')
      .select('id, processor_charge_id')
      .eq('merchant_id', connection.merchant_id)
      .eq('processor', 'stripe')
      .eq('processor_account_id', connection.processor_account_id)
      .gte('created_at', window.startIso)
      .lt('created_at', window.endIso),
  ]);

  if (disputeResult.error) throw disputeResult.error;
  if (efwResult.error) throw efwResult.error;

  return buildNumeratorCounts({
    disputes: (disputeResult.data ?? []) as LocalDisputeRow[],
    efws: (efwResult.data ?? []) as LocalEfwRow[],
  });
}

async function countStripeNumerator({
  stripe,
  connection,
  window,
}: {
  stripe: Stripe;
  connection: ProcessorConnectionRow;
  window: WindowBounds;
}): Promise<NumeratorCounts> {
  const created = { gte: window.startUnix, lt: window.endUnix };
  const [disputes, efws] = await Promise.all([
    collectStripeList(
      stripe.disputes.list({ created, limit: PAGE_LIMIT }, { stripeAccount: connection.processor_account_id }),
    ),
    collectStripeList(
      stripe.radar.earlyFraudWarnings.list(
        { created, limit: PAGE_LIMIT },
        { stripeAccount: connection.processor_account_id },
      ),
    ),
  ]);

  return buildNumeratorCounts({
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      processor_charge_id: stripeObjectId(dispute.charge),
      ce3_eligible: null,
    })),
    efws: efws.map((efw) => ({
      id: efw.id,
      processor_charge_id: stripeObjectId(efw.charge),
    })),
  });
}

async function countStripeSettledCardCharges({
  stripe,
  connection,
  window,
}: {
  stripe: Stripe;
  connection: ProcessorConnectionRow;
  window: WindowBounds;
}): Promise<StripeChargeCounts> {
  const charges = await collectStripeList(
    stripe.charges.list(
      { created: { gte: window.startUnix, lt: window.endUnix }, limit: PAGE_LIMIT },
      { stripeAccount: connection.processor_account_id },
    ),
  );

  let settledCardChargeCount = 0;
  let skippedNonCardCount = 0;
  let skippedUnsettledCount = 0;

  for (const charge of charges) {
    if (!isSettledCharge(charge)) {
      skippedUnsettledCount += 1;
      continue;
    }

    if (charge.payment_method_details?.type !== 'card') {
      skippedNonCardCount += 1;
      continue;
    }

    settledCardChargeCount += 1;
  }

  return {
    settledCardChargeCount,
    scannedChargeCount: charges.length,
    skippedNonCardCount,
    skippedUnsettledCount,
    chargePages: Math.ceil(charges.length / PAGE_LIMIT),
  };
}

async function collectStripeList<T>(list: Stripe.ApiListPromise<T>): Promise<T[]> {
  const rows: T[] = [];
  await list.autoPagingEach((row) => {
    rows.push(row);
  });
  return rows;
}

function buildNumeratorCounts({
  disputes,
  efws,
}: {
  disputes: LocalDisputeRow[];
  efws: LocalEfwRow[];
}): NumeratorCounts {
  const seenChargeIds = new Set<string>();
  let missingChargeIdCount = 0;
  let doubleCountRemoved = 0;

  for (const row of [...disputes, ...efws]) {
    const chargeId = row.processor_charge_id;
    if (!chargeId) {
      missingChargeIdCount += 1;
      continue;
    }

    if (seenChargeIds.has(chargeId)) {
      doubleCountRemoved += 1;
      continue;
    }

    seenChargeIds.add(chargeId);
  }

  return {
    disputeCount: disputes.length,
    efwCount: efws.length,
    dedupedNumerator: seenChargeIds.size + missingChargeIdCount,
    doubleCountRemoved,
    chargeIds: Array.from(seenChargeIds).sort(),
    missingChargeIdCount,
    ce3EligibleDisputeCount: disputes.filter((row) => row.ce3_eligible === true).length,
  };
}

function buildGatesHit({
  denominator,
  monthlySettledAverage,
  localCounts,
  stripeCounts,
  numeratorSource,
}: {
  denominator: number;
  monthlySettledAverage: number;
  localCounts: NumeratorCounts;
  stripeCounts: NumeratorCounts;
  numeratorSource: VampSnapshotWrite['raw_components']['numeratorSource'];
}): string[] {
  const gates: string[] = [];

  if (denominator === 0) gates.push('zero_denominator');
  if (monthlySettledAverage < SCORE_FLOOR) gates.push('low_monthly_settled_volume');
  if (numeratorSource !== 'reconciled') gates.push('local_stripe_numerator_drift');
  if (stripeCounts.dedupedNumerator > localCounts.dedupedNumerator) {
    gates.push('stripe_api_numerator_used');
  }
  if (localCounts.dedupedNumerator > stripeCounts.dedupedNumerator) {
    gates.push('local_db_numerator_used');
  }
  if (localCounts.doubleCountRemoved > 0 || stripeCounts.doubleCountRemoved > 0) {
    gates.push('charge_id_dedupe_applied');
  }

  return gates;
}

function isSettledCharge(charge: Stripe.Charge): boolean {
  return charge.paid === true && charge.status === 'succeeded' && charge.captured === true;
}

function stripeObjectId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;
  return null;
}

function startOfUtcDay(isoString: string): Date {
  const date = new Date(isoString);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function findSnapshotForUtcDay({
  supabase,
  merchantId,
  dayStartIso,
  dayEndIso,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  dayStartIso: string;
  dayEndIso: string;
}): Promise<StoredSnapshotRow | null> {
  const { data, error } = await supabase
    .from('vamp_snapshots')
    .select('id, calculated_at')
    .eq('merchant_id', merchantId)
    .gte('calculated_at', dayStartIso)
    .lt('calculated_at', dayEndIso)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as StoredSnapshotRow | null) ?? null;
}

function isUniqueViolation(error: { code?: string | null }): boolean {
  return error.code === '23505';
}
