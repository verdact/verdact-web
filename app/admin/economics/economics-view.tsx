import type { EconomicsModel } from '@/lib/admin/economics';
import { DEFAULT_FINANCIALS, type FinancialInputs } from '@/lib/admin/financials';
import { EconomicsCockpit } from './cockpit';
import type { EconomicsCockpitData } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// EconomicsView — thin server-rendered wrapper around the interactive cockpit.
//
// Two call shapes are supported so the frozen dev preview keeps working:
//   • New (the real page):  <EconomicsView data={cockpitData} notice error />
//   • Legacy (dev preview): <EconomicsView model inputs notice error />
//
// When called the legacy way we synthesize the cockpit inputs from `inputs` and
// reconstruct conservative drivers from the precomputed model so the cockpit can
// still recompute as levers move. Scenarios degrade to an unavailable empty set.
// ─────────────────────────────────────────────────────────────────────────────

type EconomicsViewProps =
  | {
      data: EconomicsCockpitData;
      notice: string | null;
      error: string | null;
      model?: undefined;
      inputs?: undefined;
    }
  | {
      // Legacy shape used by /dev/admin preview.
      model: EconomicsModel;
      inputs: FinancialInputs;
      notice: string | null;
      error: string | null;
      data?: undefined;
    };

export function EconomicsView(props: EconomicsViewProps) {
  const cockpit = 'data' in props && props.data ? props.data : legacyToCockpit(props.inputs, props.model);

  return (
    <EconomicsCockpit
      inputs={cockpit.inputs}
      drivers={cockpit.drivers}
      scenarios={cockpit.scenarios}
      scenariosAvailable={cockpit.scenariosAvailable}
      notice={props.notice}
      error={props.error}
      role={cockpit.admin.role}
    />
  );
}

/**
 * Build cockpit data from the legacy preview props. We can recover the real
 * driver win-rate / avg-amount from the precomputed model context so the cockpit
 * starts in the same state the read-only view showed.
 */
function legacyToCockpit(
  inputs: FinancialInputs | undefined,
  model: EconomicsModel | undefined,
): EconomicsCockpitData {
  const resolvedInputs = inputs ?? { ...DEFAULT_FINANCIALS };
  const ctx = model?.context;
  return {
    admin: {
      userId: 'preview',
      email: 'rishi@verdact.io',
      emailNormalized: 'rishi@verdact.io',
      role: 'owner',
      source: 'database',
    },
    inputs: resolvedInputs,
    drivers: {
      totalMerchants: 0,
      activeMerchants: 0,
      payingCustomers: 0,
      disputesTotal: 0,
      disputesWon: 0,
      disputesLost: 0,
      disputesOpen: 0,
      disputesLast30d: 0,
      newMerchantsLast30d: 0,
      // Use the model's resolved avg amount only when it came from real data;
      // otherwise leave null so the cockpit falls back to the assumed input.
      avgDisputeAmountUsd: ctx?.avgDisputeAmountIsReal ? ctx.avgDisputeAmount : null,
    },
    scenarios: [],
    scenariosAvailable: false,
  };
}
