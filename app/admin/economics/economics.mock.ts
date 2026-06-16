import { DEFAULT_FINANCIALS } from '@/lib/admin/financials';
import type { EconomicsCockpitData } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// Static sample data for the dev preview (/dev/admin?view=economics). No DB, no
// 'server-only': so the cockpit can render and be dragged without a session.
// Numbers are illustrative: costs are realistic, paying customers are overridden
// to a non-zero count so the projection and break-even visuals are meaningful.
// ─────────────────────────────────────────────────────────────────────────────

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

export const MOCK_ECONOMICS: EconomicsCockpitData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  inputs: {
    ...DEFAULT_FINANCIALS,
    costVercel: 20,
    costSupabase: 25,
    costInngest: 0,
    costResend: 0,
    costAnthropicFixed: 0,
    costDomains: 5,
    priceMonitoringMonthly: 19,
    successFeePct: 25,
    flatFee: 49,
    marketingSpendMonthly: 300,
    acquisitionSpendTotal: 1800,
    cashOnHand: 42000,
    priorPeriodMrr: 190,
    monthlyChurnPct: 4,
    avgDisputesPerCustomerMonthly: 2,
    assumedWinRatePct: 65,
    assumedAvgDisputeAmount: 120,
    payingCustomersOverride: 14,
    updatedAt: daysAgo(1),
  },
  drivers: {
    totalMerchants: 31,
    activeMerchants: 18,
    payingCustomers: 0,
    disputesTotal: 47,
    disputesWon: 19,
    disputesLost: 8,
    disputesOpen: 12,
    disputesLast30d: 9,
    newMerchantsLast30d: 5,
    avgDisputeAmountUsd: 142.5,
  },
  scenarios: [
    {
      id: 'mock-base',
      name: 'Base: locked pricing',
      kind: 'base',
      inputs: {
        priceMonitoringMonthly: 19,
        successFeePct: 25,
        monthlyChurnPct: 5,
        avgDisputesPerCustomerMonthly: 2,
        assumedWinRatePct: 65,
        marketingSpendMonthly: 200,
        payingCustomersOverride: 12,
      },
      notes: 'Conservative read at locked pricing.',
      isPinned: true,
      createdAt: daysAgo(6),
    },
    {
      id: 'mock-upside',
      name: 'Upside: premium price + low churn',
      kind: 'upside',
      inputs: {
        priceMonitoringMonthly: 29,
        successFeePct: 25,
        monthlyChurnPct: 2,
        avgDisputesPerCustomerMonthly: 3,
        assumedWinRatePct: 72,
        marketingSpendMonthly: 600,
        payingCustomersOverride: 40,
      },
      notes: 'If retention holds and disputes-per-customer run higher.',
      isPinned: false,
      createdAt: daysAgo(4),
    },
    {
      id: 'mock-risk',
      name: 'Risk: high churn, thin volume',
      kind: 'risk',
      inputs: {
        priceMonitoringMonthly: 15,
        successFeePct: 20,
        monthlyChurnPct: 9,
        avgDisputesPerCustomerMonthly: 1,
        assumedWinRatePct: 55,
        marketingSpendMonthly: 100,
        payingCustomersOverride: 8,
      },
      notes: 'Stress case: churn bites and volume stays thin.',
      isPinned: false,
      createdAt: daysAgo(2),
    },
  ],
  scenariosAvailable: true,
};
