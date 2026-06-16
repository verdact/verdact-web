import { computeEconomics, type EconomicsModel } from '@/lib/admin/economics';
import type { FinancialInputs } from '@/lib/admin/financials';
import type { EconomicsScenario } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// Pure cockpit model helpers — no React, no CSS. The cockpit recomputes the
// whole model client-side with computeEconomics(); these utilities feed it
// (scenario resolution, sensitivity deltas) and read values back out. Pure so
// they stay cheap to call on every drag and are unit-testable in isolation.
// ─────────────────────────────────────────────────────────────────────────────

export type TargetMetric = 'profit' | 'breakeven';

/** The numeric (or nullable-number) input keys — excludes string meta fields. */
export type NumericInputKey = {
  [K in keyof FinancialInputs]: FinancialInputs[K] extends string | null ? never : K;
}[keyof FinancialInputs];

// Keys we persist to the real baseline (everything tunable, not meta).
export const SAVE_KEYS: NumericInputKey[] = [
  'costVercel', 'costSupabase', 'costInngest', 'costResend', 'costPosthog', 'costAnthropicFixed',
  'costDomains', 'costOtherFixed', 'aiCostPerDispute', 'variableCostPerDisputeOther',
  'supportCostPerCustomer', 'processingFeePct', 'processingFeeFixed', 'priceMonitoringMonthly',
  'successFeePct', 'flatFee', 'marketingSpendMonthly', 'acquisitionSpendTotal', 'cashOnHand',
  'priorPeriodMrr', 'monthlyChurnPct', 'avgDisputesPerCustomerMonthly', 'assumedWinRatePct',
  'assumedAvgDisputeAmount', 'payingCustomersOverride',
];

// A neutral base for scenario comparison when a scenario omits some fields. The
// scenario blob overrides whatever it specifies; the rest fall back to defaults.
export const BASE_FOR_COMPARE: FinancialInputs = {
  costVercel: 20, costSupabase: 25, costInngest: 0, costResend: 0, costPosthog: 0,
  costAnthropicFixed: 0, costDomains: 5, costOtherFixed: 0, aiCostPerDispute: 0.5,
  variableCostPerDisputeOther: 0, supportCostPerCustomer: 0, processingFeePct: 2.9,
  processingFeeFixed: 0.3, priceMonitoringMonthly: 19, successFeePct: 25, flatFee: 49,
  marketingSpendMonthly: 0, acquisitionSpendTotal: 0, cashOnHand: 0, priorPeriodMrr: 0,
  monthlyChurnPct: 5, avgDisputesPerCustomerMonthly: 2, assumedWinRatePct: 65,
  assumedAvgDisputeAmount: 120, payingCustomersOverride: null, currency: 'USD', updatedAt: null,
};

export function findMetric(metrics: EconomicsModel['snapshot'], key: string) {
  return metrics.find((m) => m.key === key) ?? null;
}

export function targetValue(model: EconomicsModel, target: TargetMetric): number | null {
  if (target === 'breakeven') return model.breakEvenCustomers;
  return findMetric(model.snapshot, 'net_profit')?.value ?? null;
}

/**
 * Change in the target metric vs baseline. For break-even, fewer customers is
 * better, so we flip the sign so a positive delta always means "improvement".
 */
export function deltaFor(value: number | null, base: number | null, target: TargetMetric): number | null {
  if (value == null || base == null) return null;
  const raw = value - base;
  return target === 'breakeven' ? -raw : raw;
}

export type TornadoRow = {
  key: NumericInputKey;
  label: string;
  deltaLow: number | null;
  deltaHigh: number | null;
};

/**
 * Tornado sensitivity: vary each driver ±20% from its current value and measure
 * the signed impact on the chosen target metric. Pure — runs computeEconomics
 * 2× per driver, all client-side.
 */
export function buildTornado(
  inputs: FinancialInputs,
  drivers: Parameters<typeof computeEconomics>[1],
  target: TargetMetric,
  driverDefs: { key: NumericInputKey; label: string }[],
): TornadoRow[] {
  const base = numOrNull(targetValue(computeEconomics(inputs, drivers), target));
  return driverDefs.map((d) => {
    const current = Number(inputs[d.key] ?? 0);
    const low = numOrNull(targetValue(computeEconomics({ ...inputs, [d.key]: current * 0.8 }, drivers), target));
    const high = numOrNull(targetValue(computeEconomics({ ...inputs, [d.key]: current * 1.2 }, drivers), target));
    return {
      key: d.key,
      label: d.label,
      deltaLow: deltaFor(low, base, target),
      deltaHigh: deltaFor(high, base, target),
    };
  });
}

export function numOrNull(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/** Resolve a scenario's stored (partial) inputs against the neutral base. */
export function scenarioInputs(scenario: EconomicsScenario): FinancialInputs {
  return { ...BASE_FOR_COMPARE, ...scenario.inputs };
}

export function serializeForSave(inputs: FinancialInputs): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of SAVE_KEYS) {
    out[key] = inputs[key];
  }
  return out;
}

export function sameInputs(a: FinancialInputs, b: FinancialInputs): boolean {
  return SAVE_KEYS.every((k) => a[k] === b[k]);
}

export function hiddenValue(value: number | null): string {
  // Blank for a cleared override clears it server-side; numbers go through as-is.
  return value == null ? '' : String(value);
}

export function formatAffix(value: number, affix: '$' | '%' | '#'): string {
  if (affix === '$') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  }
  if (affix === '%') return `${value % 1 === 0 ? value : value.toFixed(1)}%`;
  return `${value % 1 === 0 ? value : value.toFixed(1)}`;
}

export function compactUsd(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
