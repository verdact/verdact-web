import 'server-only';

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Founder-tunable economics inputs. Money fields are whole USD. Percentage
 * fields are percent numbers (25 = 25%). The engine converts percent -> fraction.
 * Mirrors the columns in `platform_financials` (singleton row id = true).
 */
export type FinancialInputs = {
  // Fixed monthly infrastructure / SaaS costs (USD/mo).
  costVercel: number;
  costSupabase: number;
  costInngest: number;
  costResend: number;
  costPosthog: number;
  costAnthropicFixed: number;
  costDomains: number;
  costOtherFixed: number;
  // Variable / per-unit cost assumptions.
  aiCostPerDispute: number;
  variableCostPerDisputeOther: number;
  supportCostPerCustomer: number;
  processingFeePct: number;
  processingFeeFixed: number;
  // Pricing (locked two-tier model; editable for scenarios).
  priceMonitoringMonthly: number;
  successFeePct: number;
  flatFee: number;
  // Go-to-market / business inputs.
  marketingSpendMonthly: number;
  acquisitionSpendTotal: number;
  cashOnHand: number;
  priorPeriodMrr: number;
  monthlyChurnPct: number;
  avgDisputesPerCustomerMonthly: number;
  assumedWinRatePct: number;
  assumedAvgDisputeAmount: number;
  payingCustomersOverride: number | null;
  // Meta.
  currency: string;
  updatedAt: string | null;
};

export const DEFAULT_FINANCIALS: FinancialInputs = {
  costVercel: 20,
  costSupabase: 25,
  costInngest: 0,
  costResend: 0,
  costPosthog: 0,
  costAnthropicFixed: 0,
  costDomains: 5,
  costOtherFixed: 0,
  aiCostPerDispute: 0.5,
  variableCostPerDisputeOther: 0,
  supportCostPerCustomer: 0,
  processingFeePct: 2.9,
  processingFeeFixed: 0.3,
  priceMonitoringMonthly: 19,
  successFeePct: 25,
  flatFee: 49,
  marketingSpendMonthly: 0,
  acquisitionSpendTotal: 0,
  cashOnHand: 0,
  priorPeriodMrr: 0,
  monthlyChurnPct: 5,
  avgDisputesPerCustomerMonthly: 2,
  assumedWinRatePct: 65,
  assumedAvgDisputeAmount: 120,
  payingCustomersOverride: null,
  currency: 'USD',
  updatedAt: null,
};

/** Column <-> field map, single source of truth for read + write. */
const COLUMN_MAP: Record<keyof Omit<FinancialInputs, 'currency' | 'updatedAt'>, string> = {
  costVercel: 'cost_vercel',
  costSupabase: 'cost_supabase',
  costInngest: 'cost_inngest',
  costResend: 'cost_resend',
  costPosthog: 'cost_posthog',
  costAnthropicFixed: 'cost_anthropic_fixed',
  costDomains: 'cost_domains',
  costOtherFixed: 'cost_other_fixed',
  aiCostPerDispute: 'ai_cost_per_dispute',
  variableCostPerDisputeOther: 'variable_cost_per_dispute_other',
  supportCostPerCustomer: 'support_cost_per_customer',
  processingFeePct: 'processing_fee_pct',
  processingFeeFixed: 'processing_fee_fixed',
  priceMonitoringMonthly: 'price_monitoring_monthly',
  successFeePct: 'success_fee_pct',
  flatFee: 'flat_fee',
  marketingSpendMonthly: 'marketing_spend_monthly',
  acquisitionSpendTotal: 'acquisition_spend_total',
  cashOnHand: 'cash_on_hand',
  priorPeriodMrr: 'prior_period_mrr',
  monthlyChurnPct: 'monthly_churn_pct',
  avgDisputesPerCustomerMonthly: 'avg_disputes_per_customer_monthly',
  assumedWinRatePct: 'assumed_win_rate_pct',
  assumedAvgDisputeAmount: 'assumed_avg_dispute_amount',
  payingCustomersOverride: 'paying_customers_override',
};

const SELECT_COLUMNS = [...Object.values(COLUMN_MAP), 'currency', 'updated_at'].join(', ');

type FinancialsRow = Record<string, unknown>;

function toNumber(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowToInputs(row: FinancialsRow | null): FinancialInputs {
  if (!row) return { ...DEFAULT_FINANCIALS };
  const out = { ...DEFAULT_FINANCIALS };
  for (const [field, column] of Object.entries(COLUMN_MAP) as [
    keyof typeof COLUMN_MAP,
    string,
  ][]) {
    if (field === 'payingCustomersOverride') {
      const raw = row[column];
      out.payingCustomersOverride = raw == null ? null : toNumber(raw, 0);
    } else {
      out[field] = toNumber(row[column], DEFAULT_FINANCIALS[field] as number);
    }
  }
  out.currency = typeof row.currency === 'string' && row.currency ? row.currency : 'USD';
  out.updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
  return out;
}

/** Read the singleton financial inputs. Falls back to defaults if the row is absent. */
export async function getFinancials(service?: ServiceClient): Promise<FinancialInputs> {
  const client = service ?? createServiceClient();
  const { data, error } = await client
    .from('platform_financials')
    .select(SELECT_COLUMNS)
    .eq('id', true)
    .maybeSingle();

  if (error) {
    // Degrade gracefully (e.g. before the migration is applied): the economics
    // page still renders on sensible defaults rather than 500-ing. Saving will
    // surface its own error until the table exists.
    console.error('[admin] could not load platform financials, using defaults:', error.message);
    return { ...DEFAULT_FINANCIALS };
  }
  return rowToInputs((data as FinancialsRow | null) ?? null);
}

// ── Update validation ────────────────────────────────────────────────────────

const money = z.coerce.number().min(0).max(10_000_000).finite();
const pct = z.coerce.number().min(0).max(100).finite();

/**
 * Zod schema for the editable form. Every field optional so the action can patch
 * partial submissions; `payingCustomersOverride` accepts blank -> null.
 */
export const financialsInputSchema = z.object({
  costVercel: money.optional(),
  costSupabase: money.optional(),
  costInngest: money.optional(),
  costResend: money.optional(),
  costPosthog: money.optional(),
  costAnthropicFixed: money.optional(),
  costDomains: money.optional(),
  costOtherFixed: money.optional(),
  aiCostPerDispute: money.optional(),
  variableCostPerDisputeOther: money.optional(),
  supportCostPerCustomer: money.optional(),
  processingFeePct: pct.optional(),
  processingFeeFixed: money.optional(),
  priceMonitoringMonthly: money.optional(),
  successFeePct: pct.optional(),
  flatFee: money.optional(),
  marketingSpendMonthly: money.optional(),
  acquisitionSpendTotal: money.optional(),
  cashOnHand: money.optional(),
  priorPeriodMrr: money.optional(),
  monthlyChurnPct: pct.optional(),
  avgDisputesPerCustomerMonthly: z.coerce.number().min(0).max(10_000).finite().optional(),
  assumedWinRatePct: pct.optional(),
  assumedAvgDisputeAmount: money.optional(),
  payingCustomersOverride: z
    .union([z.literal(''), z.coerce.number().int().min(0).max(10_000_000)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

export type FinancialsPatch = z.infer<typeof financialsInputSchema>;

/** Persist a validated patch to the singleton row. */
export async function updateFinancials(
  patch: FinancialsPatch,
  updatedBy: string,
  service?: ServiceClient,
): Promise<void> {
  const client = service ?? createServiceClient();
  const update: FinancialsRow = { updated_at: new Date().toISOString(), updated_by: updatedBy };

  for (const [field, column] of Object.entries(COLUMN_MAP) as [
    keyof typeof COLUMN_MAP,
    string,
  ][]) {
    const value = (patch as Record<string, unknown>)[field];
    if (field === 'payingCustomersOverride') {
      // Always write override (null clears it) when the key is present.
      if (field in patch) update[column] = value ?? null;
    } else if (value !== undefined) {
      update[column] = value;
    }
  }

  const { error } = await client.from('platform_financials').update(update).eq('id', true);
  if (error) {
    throw new Error(`Could not update platform financials: ${error.message}`);
  }
}
