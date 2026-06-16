import type { FinancialInputs } from './financials';

// ─────────────────────────────────────────────────────────────────────────────
// Economics engine.
//
// Pure functions only — no I/O. Takes the founder's tunable inputs plus real
// drivers pulled from the operational tables, and returns the full business-
// metrics suite (MRR/ARR, unit economics, cost structure, break-even, runway,
// and a forward projection). Every division is guarded: an undefined ratio is
// `null`, never NaN/Infinity, and the view renders null as "—".
//
// Revenue model (locked two-tier pricing, editable):
//   - Subscription: monitoring price per paying customer per month (recurring).
//   - Filing: charged on WON disputes only, buyer's choice = min(success-fee %
//     of recovered amount, flat fee). This is the conservative, success-based
//     reading of "25% success fee OR $49 flat".
// ─────────────────────────────────────────────────────────────────────────────

/** Real, DB-derived inputs to the model. Money values are whole USD. */
export type EconomicsDrivers = {
  totalMerchants: number;
  activeMerchants: number; // Stripe-connected (activated)
  payingCustomers: number; // actual paying subscriptions (0 during beta)
  disputesTotal: number;
  disputesWon: number;
  disputesLost: number;
  disputesOpen: number;
  disputesLast30d: number; // recent volume, for actual variable-cost estimate
  newMerchantsLast30d: number; // acquisition proxy for monthly CAC
  avgDisputeAmountUsd: number | null; // real average, null when no disputes on record
};

export type MetricFormat = 'usd' | 'usd2' | 'pct' | 'ratio' | 'months' | 'integer' | 'number';
export type MetricTone = 'good' | 'warn' | 'bad' | 'neutral';

export type Metric = {
  key: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  definition: string;
  tone?: MetricTone;
  hint?: string;
};

export type CostLine = { key: string; label: string; monthly: number };

export type ProjectionRow = {
  payingCustomers: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  isBreakEven: boolean;
};

export type EconomicsModel = {
  currency: string;
  // Headline current-state snapshot (reflects beta reality: ~$0 revenue).
  snapshot: Metric[];
  // Per-customer unit economics (modeled — meaningful even at 0 paying).
  unitEconomics: Metric[];
  // Growth & efficiency (MRR growth, Rule of 40, burn multiple, gross profit).
  efficiency: Metric[];
  // Per-dispute economics (modeled; uses real avg amount where available).
  perDispute: Metric[];
  // Cost structure.
  fixedCostLines: CostLine[];
  fixedMonthlyCost: number;
  costStructure: Metric[];
  // Break-even.
  breakEven: Metric[];
  breakEvenCustomers: number | null;
  // Forward projection at scale milestones.
  projection: ProjectionRow[];
  // Derived context surfaced in the UI.
  context: {
    payingCustomers: number;
    winRatePct: number;
    winRateIsReal: boolean;
    avgDisputeAmount: number;
    avgDisputeAmountIsReal: boolean;
    arpu: number;
    grossMarginPct: number | null;
    contributionPerCustomer: number;
    revenuePerWonDispute: number;
  };
};

const PROJECTION_MILESTONES = [10, 25, 50, 100, 250];

function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Buyer's-choice take per won dispute: min(success fee, flat fee). */
function takePerWonDispute(amount: number, successFee: number, flatFee: number): number {
  if (amount <= 0) return 0;
  return Math.min(successFee * amount, flatFee);
}

export function computeEconomics(
  inputs: FinancialInputs,
  drivers: EconomicsDrivers,
): EconomicsModel {
  // ── Normalize percent inputs to fractions ───────────────────────────────────
  const successFee = inputs.successFeePct / 100;
  const processingFee = inputs.processingFeePct / 100;
  const churn = inputs.monthlyChurnPct / 100;

  // ── Real-vs-assumed driver resolution ───────────────────────────────────────
  const decidedDisputes = drivers.disputesWon + drivers.disputesLost;
  const realWinRate = decidedDisputes > 0 ? drivers.disputesWon / decidedDisputes : null;
  const winRate = realWinRate ?? inputs.assumedWinRatePct / 100;
  const winRateIsReal = realWinRate !== null;

  const avgDisputeAmount = drivers.avgDisputeAmountUsd ?? inputs.assumedAvgDisputeAmount;
  const avgDisputeAmountIsReal = drivers.avgDisputeAmountUsd !== null;

  const payingCustomers =
    inputs.payingCustomersOverride != null ? inputs.payingCustomersOverride : drivers.payingCustomers;

  // ── Fixed monthly cost structure ────────────────────────────────────────────
  const fixedCostLines: CostLine[] = [
    { key: 'vercel', label: 'Vercel (hosting)', monthly: inputs.costVercel },
    { key: 'supabase', label: 'Supabase (DB + auth)', monthly: inputs.costSupabase },
    { key: 'inngest', label: 'Inngest (jobs)', monthly: inputs.costInngest },
    { key: 'resend', label: 'Resend (email)', monthly: inputs.costResend },
    { key: 'posthog', label: 'PostHog (analytics)', monthly: inputs.costPosthog },
    { key: 'anthropic', label: 'Anthropic (fixed/min)', monthly: inputs.costAnthropicFixed },
    { key: 'domains', label: 'Domains + misc', monthly: inputs.costDomains },
    { key: 'other', label: 'Other fixed', monthly: inputs.costOtherFixed },
  ];
  const fixedMonthlyCost = fixedCostLines.reduce((sum, line) => sum + line.monthly, 0);

  // ── Per-customer revenue (ARPU) ─────────────────────────────────────────────
  const perCustomerSubscription = inputs.priceMonitoringMonthly;
  const revenuePerWonDispute = takePerWonDispute(avgDisputeAmount, successFee, inputs.flatFee);
  const wonDisputesPerCustomer = inputs.avgDisputesPerCustomerMonthly * winRate;
  const perCustomerFilingRev = wonDisputesPerCustomer * revenuePerWonDispute;
  const arpu = perCustomerSubscription + perCustomerFilingRev;

  // ── Per-customer variable cost (cost to serve) ──────────────────────────────
  const perDisputeProcessingCost = inputs.aiCostPerDispute + inputs.variableCostPerDisputeOther;
  const customerDisputeCost = inputs.avgDisputesPerCustomerMonthly * perDisputeProcessingCost;
  // Payment processing fee applies to revenue we actually collect (subscription
  // every month + each won-dispute fee).
  const collectedTxnsPerCustomer = 1 + wonDisputesPerCustomer;
  const processingFeeCost = processingFee * arpu + inputs.processingFeeFixed * collectedTxnsPerCustomer;
  const variableCostPerCustomer =
    customerDisputeCost + processingFeeCost + inputs.supportCostPerCustomer;

  const contributionPerCustomer = arpu - variableCostPerCustomer;
  const contributionMarginPct = safeDiv(contributionPerCustomer, arpu);
  const grossMarginPct = contributionMarginPct; // cost-to-serve == COGS here

  // ── Customer lifetime value ─────────────────────────────────────────────────
  const avgLifetimeMonths = safeDiv(1, churn);
  // Cap lifetime at 120 months (10y) for LTV so a near-zero churn assumption
  // can't produce an absurd lifetime value.
  const ltvLifetimeMonths = avgLifetimeMonths == null ? null : Math.min(avgLifetimeMonths, 120);
  const ltv =
    grossMarginPct != null && ltvLifetimeMonths != null
      ? arpu * grossMarginPct * ltvLifetimeMonths
      : null;

  // ── Acquisition cost ────────────────────────────────────────────────────────
  // CAC = acquisition spend ÷ customers acquired. Use the most "real" base
  // available — paying, else activated (Stripe-connected), else total signups —
  // because total signups over-counts never-activated merchants and understates CAC.
  const cacBase =
    payingCustomers > 0
      ? payingCustomers
      : drivers.activeMerchants > 0
        ? drivers.activeMerchants
        : drivers.totalMerchants;
  const cacBasis = payingCustomers > 0 ? 'paying' : drivers.activeMerchants > 0 ? 'activated' : 'signup';
  const blendedCac =
    inputs.acquisitionSpendTotal > 0 && cacBase > 0 ? safeDiv(inputs.acquisitionSpendTotal, cacBase) : 0;
  const ltvCacRatio = ltv != null && blendedCac && blendedCac > 0 ? safeDiv(ltv, blendedCac) : null;
  const cacPayback =
    blendedCac && blendedCac > 0 && grossMarginPct != null && grossMarginPct > 0
      ? safeDiv(blendedCac, arpu * grossMarginPct)
      : null;

  // ── Actual current-state snapshot (beta: revenue ≈ 0) ───────────────────────
  const mrr = payingCustomers * perCustomerSubscription;
  const arr = mrr * 12;
  const actualFilingRevenue = payingCustomers * perCustomerFilingRev;
  const totalMonthlyRevenue = mrr + actualFilingRevenue;

  const actualVariableCost =
    drivers.disputesLast30d * perDisputeProcessingCost + payingCustomers * variableCostPerCustomer;
  const totalMonthlyCost = fixedMonthlyCost + actualVariableCost + inputs.marketingSpendMonthly;
  const netMonthlyProfit = totalMonthlyRevenue - totalMonthlyCost;
  const netBurn = netMonthlyProfit < 0 ? -netMonthlyProfit : 0;
  const grossBurn = totalMonthlyCost; // total cash out, regardless of revenue
  const runwayMonths = netBurn > 0 ? safeDiv(inputs.cashOnHand, netBurn) : null;

  // ── Growth & efficiency ─────────────────────────────────────────────────────
  const grossProfitMonthly = totalMonthlyRevenue - actualVariableCost; // revenue − cost to serve (COGS)
  const mrrGrowthFraction =
    inputs.priorPeriodMrr > 0 ? safeDiv(mrr - inputs.priorPeriodMrr, inputs.priorPeriodMrr) : null;
  const netNewArr = (mrr - inputs.priorPeriodMrr) * 12;
  const burnMultiple = netNewArr > 0 ? safeDiv(netBurn, netNewArr) : null;
  const profitMarginFraction = totalMonthlyRevenue > 0 ? safeDiv(netMonthlyProfit, totalMonthlyRevenue) : null;
  const ruleOf40 =
    mrrGrowthFraction != null && profitMarginFraction != null
      ? (mrrGrowthFraction + profitMarginFraction) * 100
      : null;

  // ── Break-even ──────────────────────────────────────────────────────────────
  // Overhead = every monthly cost that does NOT scale with customer count
  // (infrastructure + recurring marketing). This must match the projection,
  // which also adds marketing to monthly cost.
  const overheadMonthly = fixedMonthlyCost + inputs.marketingSpendMonthly;
  const breakEvenCustomers =
    contributionPerCustomer > 0 ? Math.ceil(overheadMonthly / contributionPerCustomer) : null;
  const breakEvenMrr = grossMarginPct && grossMarginPct > 0 ? safeDiv(overheadMonthly, grossMarginPct) : null;
  const costPerWonDispute =
    perDisputeProcessingCost + processingFee * revenuePerWonDispute + inputs.processingFeeFixed;
  const contributionPerWonDispute = revenuePerWonDispute - costPerWonDispute;
  const breakEvenWonDisputes =
    contributionPerWonDispute > 0 ? Math.ceil(overheadMonthly / contributionPerWonDispute) : null;

  const takeRate = safeDiv(revenuePerWonDispute, avgDisputeAmount);

  // ── Projection at scale milestones ──────────────────────────────────────────
  const milestones = breakEvenCustomers
    ? Array.from(new Set([...PROJECTION_MILESTONES, breakEvenCustomers])).sort((a, b) => a - b)
    : PROJECTION_MILESTONES;
  const projection: ProjectionRow[] = milestones.map((n) => {
    const revenue = n * arpu;
    const cost = fixedMonthlyCost + n * variableCostPerCustomer + inputs.marketingSpendMonthly;
    const profit = revenue - cost;
    return {
      payingCustomers: n,
      revenue,
      cost,
      profit,
      margin: safeDiv(profit, revenue),
      isBreakEven: breakEvenCustomers != null && n === breakEvenCustomers,
    };
  });

  // ── Metric assembly ─────────────────────────────────────────────────────────
  const snapshot: Metric[] = [
    m('mrr', 'MRR', mrr, 'usd', 'Monthly Recurring Revenue — recurring subscription revenue from paying customers. $0 during the free beta.', toneForProfit(mrr)),
    m('arr', 'ARR', arr, 'usd', 'Annual Recurring Revenue — MRR × 12, the annualized run-rate.'),
    m('paying', 'Paying customers', payingCustomers, 'integer', 'Customers on a paid subscription right now. 0 during the beta unless overridden.'),
    m('total_rev', 'Total monthly revenue', totalMonthlyRevenue, 'usd', 'Subscription + filing fees actually earned this month.', toneForProfit(totalMonthlyRevenue)),
    m('total_cost', 'Total monthly cost', totalMonthlyCost, 'usd', 'Fixed infrastructure + variable processing + marketing spend per month.'),
    m('net_profit', 'Net profit / (burn)', netMonthlyProfit, 'usd', 'Total revenue minus total cost. Negative = you are burning cash.', toneForProfit(netMonthlyProfit)),
    m('burn', 'Net burn', netBurn, 'usd', 'Cash lost per month after revenue (gross cost − revenue, floored at 0).', netBurn > 0 ? 'warn' : 'good'),
    m('gross_burn', 'Gross burn', grossBurn, 'usd', 'Total cash out per month regardless of revenue (= total monthly cost). Pre-revenue this ≈ net burn.', netBurn > 0 ? 'warn' : 'neutral'),
    m('runway', 'Runway', runwayMonths, 'months', 'Months of cash left at the current burn = cash on hand ÷ net burn. Set cash on hand to see this.', toneForRunway(runwayMonths)),
  ];

  const unitEconomics: Metric[] = [
    m('arpu', 'ARPU', arpu, 'usd2', 'Average Revenue Per User per month = subscription + expected filing fees per customer.'),
    m('cm_cust', 'Contribution margin', contributionPerCustomer, 'usd2', 'Revenue per customer minus the variable cost to serve them. What each customer adds toward fixed costs + profit.', toneForProfit(contributionPerCustomer)),
    m('cm_pct', 'Contribution margin %', pctValue(contributionMarginPct), 'pct', 'Contribution margin as a share of ARPU.', toneForMarginPct(contributionMarginPct)),
    m('gross_margin', 'Gross margin %', pctValue(grossMarginPct), 'pct', 'Share of revenue left after the direct cost to serve (COGS). SaaS targets 70%+.', toneForMarginPct(grossMarginPct)),
    m('var_cost_cust', 'Variable cost / customer', variableCostPerCustomer, 'usd2', 'Monthly cost to serve one customer: dispute processing + payment fees + support.'),
    m('ltv', 'LTV', ltv, 'usd', 'Lifetime Value = ARPU × gross margin × average customer lifetime. Gross profit one customer brings over their life.'),
    m('cac', 'CAC (blended)', blendedCac === 0 ? 0 : blendedCac, 'usd', `Customer Acquisition Cost = acquisition spend ÷ customers acquired (per ${cacBasis} customer). Set acquisition spend to populate.`, undefined, cacBasis),
    m('ltv_cac', 'LTV : CAC', ltvCacRatio, 'ratio', 'LTV divided by CAC. Healthy SaaS is ≥ 3×. Needs acquisition spend to compute.', toneForLtvCac(ltvCacRatio)),
    m('payback', 'CAC payback', cacPayback, 'months', 'Months of gross profit to recover CAC. Under 12 months is strong.', toneForPayback(cacPayback)),
    m('lifetime', 'Avg customer lifetime', avgLifetimeMonths, 'months', 'Expected months a customer stays = 1 ÷ monthly churn.'),
  ];

  const efficiency: Metric[] = [
    m('mrr_growth', 'MRR growth (MoM)', pctValue(mrrGrowthFraction), 'pct', 'Month-over-month MRR growth = (MRR − prior-month MRR) ÷ prior-month MRR. Set prior-month MRR in the inputs.', mrrGrowthFraction == null ? undefined : toneForProfit(mrrGrowthFraction)),
    m('rule40', 'Rule of 40', ruleOf40, 'number', 'MRR growth % + profit margin %. ≥ 40 is the healthy-SaaS benchmark. Needs revenue + prior-month MRR.', toneForRule40(ruleOf40)),
    m('burn_multiple', 'Burn multiple', burnMultiple, 'ratio', 'Net burn ÷ net new ARR — cash burned per $1 of new ARR added. Lower is better (< 1 excellent). Needs MRR growth.', toneForBurnMultiple(burnMultiple)),
    m('gross_profit', 'Gross profit / mo', grossProfitMonthly, 'usd', 'Monthly revenue minus the variable cost to serve (COGS). Negative in beta = serving cost with ~no revenue.', toneForProfit(grossProfitMonthly)),
  ];

  const perDispute: Metric[] = [
    m('rev_won', 'Revenue per won dispute', revenuePerWonDispute, 'usd2', `What you earn on a won dispute at the average amount (${avgDisputeAmountIsReal ? 'from real data' : 'assumed'}): min(success-fee %, flat fee).`),
    m('cost_dispute', 'Cost per won dispute', costPerWonDispute, 'usd2', 'Direct cost to file + collect on a won dispute: AI tokens + processing fees.'),
    m('cm_dispute', 'Contribution per won dispute', contributionPerWonDispute, 'usd2', 'Revenue per won dispute minus its direct cost.', toneForProfit(contributionPerWonDispute)),
    m('take_rate', 'Take rate', pctValue(takeRate), 'pct', 'Share of the recovered amount you keep as your fee.'),
    m('win_rate', 'Win rate', inputs.assumedWinRatePct === 0 && !winRateIsReal ? 0 : winRate * 100, 'pct', winRateIsReal ? 'Actual win rate from decided disputes on the platform.' : 'Assumed win rate (no decided disputes yet).', undefined, winRateIsReal ? 'live' : 'assumed'),
    m('avg_amount', 'Avg dispute amount', avgDisputeAmount, 'usd', avgDisputeAmountIsReal ? 'Average disputed amount across real disputes.' : 'Assumed average disputed amount (no disputes on record yet).', undefined, avgDisputeAmountIsReal ? 'live' : 'assumed'),
  ];

  const costStructure: Metric[] = [
    m('fixed', 'Fixed monthly cost', fixedMonthlyCost, 'usd', 'Recurring infrastructure + tooling that does not scale with customers.'),
    m('var_now', 'Variable cost (now)', actualVariableCost, 'usd', 'This month’s usage-based cost: AI on recent disputes + processing fees on collected revenue.'),
    m('marketing', 'Marketing spend', inputs.marketingSpendMonthly, 'usd', 'Monthly acquisition spend (ads, tools, outreach).'),
    m('total', 'Total monthly cost', totalMonthlyCost, 'usd', 'Fixed + variable + marketing.'),
    m('cost_per_cust_served', 'Cost / customer served', variableCostPerCustomer, 'usd2', 'Variable cost to serve one active customer per month.'),
  ];

  const breakEven: Metric[] = [
    m('be_customers', 'Break-even customers', breakEvenCustomers, 'integer', 'Paying customers needed to cover monthly overhead (fixed infra + marketing) = overhead ÷ contribution margin per customer.', breakEvenCustomers != null ? 'neutral' : 'warn'),
    m('be_mrr', 'Break-even revenue', breakEvenMrr, 'usd', 'Monthly revenue needed to break even = monthly overhead ÷ gross margin.'),
    m('be_disputes', 'Break-even won disputes', breakEvenWonDisputes, 'integer', 'Won disputes per month (filing-only) needed to cover monthly overhead.'),
    m('cm_per_cust', 'Contribution / customer', contributionPerCustomer, 'usd2', 'Each paying customer’s monthly contribution toward fixed cost.', toneForProfit(contributionPerCustomer)),
  ];

  return {
    currency: inputs.currency,
    snapshot,
    unitEconomics,
    efficiency,
    perDispute,
    fixedCostLines,
    fixedMonthlyCost,
    costStructure,
    breakEven,
    breakEvenCustomers,
    projection,
    context: {
      payingCustomers,
      winRatePct: winRate * 100,
      winRateIsReal,
      avgDisputeAmount,
      avgDisputeAmountIsReal,
      arpu,
      grossMarginPct: pctValue(grossMarginPct),
      contributionPerCustomer,
      revenuePerWonDispute,
    },
  };
}

// ── Metric helpers ─────────────────────────────────────────────────────────────

function m(
  key: string,
  label: string,
  value: number | null,
  format: MetricFormat,
  definition: string,
  tone?: MetricTone,
  hint?: string,
): Metric {
  return { key, label, value, format, definition, tone, hint };
}

/** Convert a fraction (0–1) ratio to a percent number for display, preserving null. */
function pctValue(fraction: number | null): number | null {
  return fraction == null ? null : fraction * 100;
}

function toneForProfit(value: number): MetricTone {
  if (value > 0) return 'good';
  if (value < 0) return 'bad';
  return 'neutral';
}

function toneForMarginPct(fraction: number | null): MetricTone | undefined {
  if (fraction == null) return undefined;
  if (fraction >= 0.7) return 'good';
  if (fraction >= 0.4) return 'warn';
  return 'bad';
}

function toneForLtvCac(ratio: number | null): MetricTone | undefined {
  if (ratio == null) return undefined;
  if (ratio >= 3) return 'good';
  if (ratio >= 1) return 'warn';
  return 'bad';
}

function toneForPayback(months: number | null): MetricTone | undefined {
  if (months == null) return undefined;
  if (months <= 12) return 'good';
  if (months <= 24) return 'warn';
  return 'bad';
}

function toneForRunway(months: number | null): MetricTone | undefined {
  if (months == null) return undefined;
  if (months >= 18) return 'good';
  if (months >= 6) return 'warn';
  return 'bad';
}

function toneForRule40(value: number | null): MetricTone | undefined {
  if (value == null) return undefined;
  if (value >= 40) return 'good';
  if (value >= 20) return 'warn';
  return 'bad';
}

function toneForBurnMultiple(value: number | null): MetricTone | undefined {
  if (value == null) return undefined;
  if (value < 1) return 'good';
  if (value <= 1.5) return 'warn';
  return 'bad';
}

// ── Formatting (shared by views + dev previews) ──────────────────────────────

export function formatMetricValue(
  value: number | null,
  format: MetricFormat,
  currency = 'USD',
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (format) {
    case 'usd':
      return formatUsd(value, currency, 0);
    case 'usd2':
      return formatUsd(value, currency, 2);
    case 'pct':
      return `${roundTo(value, 1)}%`;
    case 'ratio':
      return `${roundTo(value, 1)}×`;
    case 'months':
      return value >= 1000 ? '∞' : `${roundTo(value, 1)} mo`;
    case 'integer':
      return new Intl.NumberFormat('en-US').format(Math.round(value));
    case 'number':
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
    default:
      return String(value);
  }
}

function formatUsd(value: number, currency: string, decimals: number): string {
  const abs = Math.abs(value);
  // Compact large dollar values for headline tiles.
  if (decimals === 0 && abs >= 100_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
