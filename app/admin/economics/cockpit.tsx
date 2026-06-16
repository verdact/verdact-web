'use client';

import { useMemo, useState } from 'react';
import {
  computeEconomics,
  formatMetricValue,
  type EconomicsDrivers,
  type EconomicsModel,
} from '@/lib/admin/economics';
import type { FinancialInputs } from '@/lib/admin/financials';
import { ValueBar } from '../_components/charts';
import { Notice } from '../_components/ui';
import { saveScenarioAction, updateFinancialsAction } from './actions';
import type { EconomicsScenario, ScenarioKind } from './data';
import {
  buildTornado,
  compactUsd,
  findMetric,
  formatAffix,
  hiddenValue,
  sameInputs,
  SAVE_KEYS,
  scenarioInputs,
  serializeForSave,
  type NumericInputKey,
  type TargetMetric,
} from './cockpit-model';
import s from '../admin.module.css';
import c from './economics.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// The interactive cockpit. computeEconomics() is pure, so we run it client-side
// on every keystroke/drag and the whole surface recomputes instantly. The saved
// inputs seed the working state; drivers are fixed (real, from the DB).
// Honest beta framing: revenue ~$0 today, costs real; this models monetization.
// ─────────────────────────────────────────────────────────────────────────────

const NOTICE_COPY = {
  notices: {
    saved: 'Economics inputs saved as the working baseline.',
    'scenario-saved': 'Scenario saved.',
  },
  errors: {
    invalid: 'Some values were not valid numbers. Nothing was saved.',
    'save-failed': 'Could not save. Please try again.',
    'scenario-invalid': 'Scenario name or inputs were not valid. Nothing was saved.',
    'scenario-failed': 'Could not save the scenario. The scenarios table may not be set up yet.',
  },
};

type SliderDef = {
  key: NumericInputKey;
  label: string;
  min: number;
  max: number;
  step: number;
  affix: '$' | '%' | '#';
  hint?: string;
};

// The headline levers, in the order a founder reaches for them.
const SLIDERS: SliderDef[] = [
  { key: 'priceMonitoringMonthly', label: 'Monitoring price / mo', min: 0, max: 99, step: 1, affix: '$' },
  { key: 'successFeePct', label: 'Success fee', min: 0, max: 50, step: 1, affix: '%' },
  { key: 'monthlyChurnPct', label: 'Monthly churn', min: 0, max: 25, step: 0.5, affix: '%' },
  { key: 'avgDisputesPerCustomerMonthly', label: 'Disputes / customer / mo', min: 0, max: 10, step: 0.5, affix: '#' },
  { key: 'assumedWinRatePct', label: 'Assumed win rate', min: 0, max: 100, step: 1, affix: '%', hint: 'Used until real decided disputes exist' },
  { key: 'marketingSpendMonthly', label: 'Marketing / mo', min: 0, max: 5000, step: 50, affix: '$' },
  { key: 'acquisitionSpendTotal', label: 'Acquisition spend (total)', min: 0, max: 50000, step: 250, affix: '$' },
  { key: 'cashOnHand', label: 'Cash on hand', min: 0, max: 500000, step: 1000, affix: '$' },
  { key: 'aiCostPerDispute', label: 'AI cost / dispute', min: 0, max: 10, step: 0.1, affix: '$' },
];

// The paying-customers slider drives the projection/break-even directly.
const PAYING_SLIDER: SliderDef = {
  key: 'payingCustomersOverride',
  label: 'Paying customers (model)',
  min: 0,
  max: 250,
  step: 1,
  affix: '#',
  hint: 'Drag to model scale; clears to live count',
};

// Full editable set (collapsible) — everything not already a headline slider.
type Affix = '$' | '%' | '#';
const ALL_FIELDS: { key: NumericInputKey; label: string; affix: Affix }[] = [
  { key: 'costVercel', label: 'Vercel', affix: '$' },
  { key: 'costSupabase', label: 'Supabase', affix: '$' },
  { key: 'costInngest', label: 'Inngest', affix: '$' },
  { key: 'costResend', label: 'Resend', affix: '$' },
  { key: 'costPosthog', label: 'PostHog', affix: '$' },
  { key: 'costAnthropicFixed', label: 'Anthropic (fixed)', affix: '$' },
  { key: 'costDomains', label: 'Domains + misc', affix: '$' },
  { key: 'costOtherFixed', label: 'Other fixed', affix: '$' },
  { key: 'variableCostPerDisputeOther', label: 'Other cost / dispute', affix: '$' },
  { key: 'supportCostPerCustomer', label: 'Support / customer', affix: '$' },
  { key: 'processingFeePct', label: 'Processing fee', affix: '%' },
  { key: 'processingFeeFixed', label: 'Processing fixed / txn', affix: '$' },
  { key: 'flatFee', label: 'Flat fee / win', affix: '$' },
  { key: 'priorPeriodMrr', label: 'Prior-month MRR', affix: '$' },
  { key: 'assumedAvgDisputeAmount', label: 'Assumed avg dispute', affix: '$' },
];

// Drivers used in the tornado — vary +/-20% and measure impact on the target.
const TORNADO_DRIVERS: { key: NumericInputKey; label: string }[] = [
  { key: 'priceMonitoringMonthly', label: 'Monitoring price' },
  { key: 'successFeePct', label: 'Success fee' },
  { key: 'avgDisputesPerCustomerMonthly', label: 'Disputes / customer' },
  { key: 'assumedWinRatePct', label: 'Win rate' },
  { key: 'monthlyChurnPct', label: 'Churn' },
  { key: 'marketingSpendMonthly', label: 'Marketing spend' },
  { key: 'aiCostPerDispute', label: 'AI cost / dispute' },
];

export function EconomicsCockpit({
  inputs: savedInputs,
  drivers,
  scenarios,
  scenariosAvailable,
  notice,
  error,
  role,
}: {
  inputs: FinancialInputs;
  drivers: EconomicsDrivers;
  scenarios: EconomicsScenario[];
  scenariosAvailable: boolean;
  notice: string | null;
  error: string | null;
  role: 'owner' | 'admin';
}) {
  const [inputs, setInputs] = useState<FinancialInputs>(savedInputs);
  const [target, setTarget] = useState<TargetMetric>('profit');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const model = useMemo(() => computeEconomics(inputs, drivers), [inputs, drivers]);
  const currency = model.currency;

  const isDirty = useMemo(() => !sameInputs(inputs, savedInputs), [inputs, savedInputs]);

  function setField(key: NumericInputKey, value: number | null): void {
    setActiveScenarioId(null);
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function loadScenario(scenario: EconomicsScenario): void {
    setActiveScenarioId(scenario.id);
    setInputs((prev) => ({ ...prev, ...scenario.inputs }));
  }

  function resetToSaved(): void {
    setActiveScenarioId(null);
    setInputs(savedInputs);
  }

  function toggleCompare(id: string): void {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  // Serialize the current tunable inputs for the save-scenario action. Strip meta.
  const inputsJson = useMemo(() => JSON.stringify(serializeForSave(inputs)), [inputs]);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Economics cockpit</h1>
          <p className={s.sectionLead}>
            Drag a lever and the whole model moves. Costs are real (from your saved inputs); revenue is ~$0 during the
            free beta, so the projections model what the locked pricing earns at scale. Nothing here is sent or charged.
          </p>
        </div>
      </header>

      <Notice notice={notice} error={error} copy={NOTICE_COPY} />

      <HeroBand model={model} currency={currency} payingCustomers={model.context.payingCustomers} />

      <div className={c.cockpitGrid}>
        {/* ── Driver rail ── */}
        <div className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Levers</p>
              <h2 className={s.panelTitle}>Drivers</h2>
            </div>
            {isDirty ? <span className={s.countPill}>Unsaved changes</span> : null}
          </div>

          <div className={c.sliderStack}>
            <Slider def={PAYING_SLIDER} value={inputs.payingCustomersOverride} onChange={setField} clearable />
            {SLIDERS.map((def) => (
              <Slider key={def.key} def={def} value={inputs[def.key]} onChange={setField} />
            ))}
          </div>

          <details className={c.disclosure}>
            <summary className={c.disclosureSummary}>All inputs</summary>
            <div className={c.allInputsGrid}>
              {ALL_FIELDS.map((field) => (
                <NumberField
                  key={field.key}
                  field={field}
                  value={inputs[field.key]}
                  onChange={setField}
                />
              ))}
            </div>
          </details>

          <div className={c.rowActions}>
            <button type="button" className={c.resetBtn} onClick={resetToSaved} disabled={!isDirty}>
              Reset to saved
            </button>
          </div>
        </div>

        {/* ── Visuals ── */}
        <div className={c.visualsCol}>
          {/* Projection to target */}
          <div className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.panelKicker}>Projection</p>
                <h2 className={s.panelTitle}>Path to profit</h2>
              </div>
              <span className={s.countPill}>
                {model.breakEvenCustomers != null
                  ? `Break-even at ${model.breakEvenCustomers} paying`
                  : 'No break-even at these inputs'}
              </span>
            </div>
            <ProjectionChart model={model} currency={currency} />
          </div>

          {/* Cost structure value bars */}
          <div className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.panelKicker}>Costs</p>
                <h2 className={s.panelTitle}>Monthly cost structure</h2>
              </div>
              <span className={s.countPill}>
                {formatMetricValue(model.fixedMonthlyCost, 'usd', currency)} fixed
              </span>
            </div>
            <CostStructure model={model} currency={currency} />
          </div>

          {/* Tornado sensitivity */}
          <div className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.panelKicker}>Sensitivity</p>
                <h2 className={s.panelTitle}>What moves the needle</h2>
              </div>
              <div className={c.targetPicker} role="group" aria-label="Target metric">
                <button
                  type="button"
                  className={`${c.targetPickerBtn} ${target === 'profit' ? c.targetPickerActive : ''}`}
                  onClick={() => setTarget('profit')}
                >
                  Net profit
                </button>
                <button
                  type="button"
                  className={`${c.targetPickerBtn} ${target === 'breakeven' ? c.targetPickerActive : ''}`}
                  onClick={() => setTarget('breakeven')}
                >
                  Break-even
                </button>
              </div>
            </div>
            <p className={s.sectionLead}>
              Each lever varied {'±'}20% from its current value. Bars show the change in{' '}
              {target === 'profit' ? 'monthly net profit' : 'break-even customer count'}; green improves, vermilion hurts.
            </p>
            <Tornado inputs={inputs} drivers={drivers} target={target} currency={currency} />
          </div>
        </div>
      </div>

      {/* ── Scenarios ── */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Scenarios</p>
            <h2 className={s.panelTitle}>Saved scenarios</h2>
          </div>
          {scenarios.length > 0 ? <span className={s.countPill}>{scenarios.length} saved</span> : null}
        </div>

        {!scenariosAvailable ? (
          <div className={c.emptyState}>
            The scenarios table is not set up yet. Once the migration is applied, saved scenarios appear here as chips
            you can load and compare.
          </div>
        ) : scenarios.length === 0 ? (
          <div className={c.emptyState}>
            No scenarios saved yet. Tune the levers above, then save the current state as a named scenario below.
          </div>
        ) : (
          <>
            <div className={c.scenarioRow}>
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={`${c.scenarioCard} ${activeScenarioId === scenario.id ? c.scenarioCardActive : ''}`}
                  onClick={() => loadScenario(scenario)}
                >
                  <span className={`${c.scenarioKind} ${kindClass(scenario.kind)}`}>{scenario.kind}</span>
                  <span className={c.scenarioName}>{scenario.name}</span>
                  {scenario.notes ? <span className={c.scenarioMeta}>{scenario.notes}</span> : null}
                </button>
              ))}
            </div>

            <CompareSection
              scenarios={scenarios}
              drivers={drivers}
              currency={currency}
              compareIds={compareIds}
              onToggle={toggleCompare}
            />
          </>
        )}

        {/* Save current as scenario */}
        <div className={s.panelHead} style={{ marginTop: 20 }}>
          <div>
            <p className={s.panelKicker}>Save</p>
            <h2 className={s.panelTitle}>Save current as scenario</h2>
          </div>
        </div>
        <p className={s.sectionLead}>
          Snapshots the levers above (not your real saved baseline) under a name so you can compare directions later.
        </p>
        <form action={saveScenarioAction} className={c.saveForm}>
          <input type="hidden" name="inputs" value={inputsJson} />
          <div className={c.saveField}>
            <label className={c.saveFieldLabel} htmlFor="scenario-name">
              Name
            </label>
            <input
              id="scenario-name"
              name="name"
              className={c.saveInput}
              placeholder="e.g. Upside: premium price"
              maxLength={80}
              required
              autoComplete="off"
            />
          </div>
          <div className={c.saveField}>
            <label className={c.saveFieldLabel} htmlFor="scenario-kind">
              Kind
            </label>
            <select id="scenario-kind" name="kind" className={c.saveSelect} defaultValue="custom">
              <option value="base">Base</option>
              <option value="upside">Upside</option>
              <option value="risk">Risk</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <button type="submit" className={s.primaryBtn} disabled={!scenariosAvailable}>
            Save scenario
          </button>
        </form>
      </div>

      {/* ── Save real baseline ── */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Baseline</p>
            <h2 className={s.panelTitle}>Save real inputs as baseline</h2>
          </div>
        </div>
        <p className={s.sectionLead}>
          Persist the current lever values as your working baseline (the numbers the read-only economics view and every
          fresh cockpit load start from). Money is in {currency}; percentages are whole numbers.
        </p>
        <form action={updateFinancialsAction}>
          {SAVE_KEYS.map((key) => (
            <input key={key} type="hidden" name={key} value={hiddenValue(inputs[key])} />
          ))}
          <div className={c.rowActions}>
            <button type="submit" className={s.primaryBtn}>
              Save current as baseline
            </button>
            {role !== 'owner' ? <span className={s.sectionLead}>Saving is available to all admins.</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Hero band ────────────────────────────────────────────────────────────────

function HeroBand({
  model,
  currency,
  payingCustomers,
}: {
  model: EconomicsModel;
  currency: string;
  payingCustomers: number;
}) {
  const netProfit = findMetric(model.snapshot, 'net_profit');
  const runway = findMetric(model.snapshot, 'runway');
  const ltvCac = findMetric(model.unitEconomics, 'ltv_cac');
  const beCustomers = model.breakEvenCustomers;
  const beReached = beCustomers != null && payingCustomers >= beCustomers;

  return (
    <section className={c.heroBand} aria-label="Headline metrics">
      <HeroCell
        label="Net profit / (burn)"
        value={netProfit ? formatMetricValue(netProfit.value, netProfit.format, currency) : '—'}
        sub={netProfit && (netProfit.value ?? 0) >= 0 ? 'Profitable at these inputs' : 'Burning cash'}
        tone={netProfit && (netProfit.value ?? 0) >= 0 ? 'good' : 'bad'}
      />
      <HeroCell
        label="Runway"
        value={runway ? formatMetricValue(runway.value, runway.format, currency) : '—'}
        sub={runway && runway.value == null ? 'Set cash on hand' : 'At current net burn'}
        tone={toneFromMetric(runway?.tone)}
      />
      <HeroCell
        label="Break-even customers"
        value={beCustomers != null ? beCustomers.toLocaleString('en-US') : '—'}
        sub={
          beCustomers == null
            ? 'No positive contribution'
            : beReached
              ? 'Past the line'
              : `${payingCustomers} of ${beCustomers} now`
        }
        tone={beCustomers == null ? 'bad' : beReached ? 'good' : 'warn'}
      />
      <HeroCell
        label="LTV : CAC"
        value={ltvCac ? formatMetricValue(ltvCac.value, ltvCac.format, currency) : '—'}
        sub={ltvCac && ltvCac.value == null ? 'Set acquisition spend' : '3x+ is healthy'}
        tone={toneFromMetric(ltvCac?.tone)}
      />
    </section>
  );
}

function HeroCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'good' ? c.heroValueGood : tone === 'bad' ? c.heroValueBad : tone === 'warn' ? c.heroValueWarn : '';
  return (
    <div className={c.heroCell}>
      <p className={c.heroLabel}>{label}</p>
      <span className={`${c.heroValue} ${toneClass}`}>{value}</span>
      <span className={c.heroSub}>{sub}</span>
    </div>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────

function Slider({
  def,
  value,
  onChange,
  clearable = false,
}: {
  def: SliderDef;
  value: number | null;
  onChange: (key: NumericInputKey, value: number | null) => void;
  clearable?: boolean;
}) {
  const numeric = value == null ? def.min : value;
  const isCleared = clearable && value == null;
  const readout = isCleared ? 'live count' : formatAffix(numeric, def.affix);

  return (
    <div className={c.sliderRow}>
      <div className={c.sliderHead}>
        <span className={c.sliderLabel}>{def.label}</span>
        <span className={`${c.sliderReadout} ${isCleared ? c.sliderReadoutDim : ''}`}>{readout}</span>
      </div>
      <input
        type="range"
        className={c.sliderInput}
        min={def.min}
        max={def.max}
        step={def.step}
        value={numeric}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
        aria-label={def.label}
      />
      {def.hint ? <span className={c.sliderHint}>{def.hint}</span> : null}
      {clearable && !isCleared ? (
        <button type="button" className={c.resetBtn} onClick={() => onChange(def.key, null)} style={{ marginTop: 4 }}>
          Use live count
        </button>
      ) : null}
    </div>
  );
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: { key: NumericInputKey; label: string; affix: Affix };
  value: number | null;
  onChange: (key: NumericInputKey, value: number | null) => void;
}) {
  const display = value == null ? '' : String(value);
  return (
    <div className={c.miniField}>
      <label className={c.miniFieldLabel} htmlFor={`mf-${field.key}`}>
        {field.label}
      </label>
      <div className={c.miniFieldInputWrap}>
        {field.affix === '$' ? <span className={c.miniFieldAffix}>$</span> : null}
        <input
          id={`mf-${field.key}`}
          className={`${c.miniFieldInput} ${field.affix === '$' ? c.miniFieldInputPad : ''}`}
          inputMode="decimal"
          value={display}
          autoComplete="off"
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onChange(field.key, 0);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(field.key, n);
          }}
        />
      </div>
    </div>
  );
}

// ── Projection chart (SVG, recomputes live) ──────────────────────────────────

function ProjectionChart({ model, currency }: { model: EconomicsModel; currency: string }) {
  const W = 640;
  const H = 240;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 34;

  const rows = model.projection;
  if (rows.length === 0) {
    return <p className={s.sectionLead}>No projection available at these inputs.</p>;
  }

  const xs = rows.map((r) => r.payingCustomers);
  const profits = rows.map((r) => r.profit);
  const maxX = Math.max(...xs, 1);
  const maxProfit = Math.max(0, ...profits);
  const minProfit = Math.min(0, ...profits);
  const profitRange = maxProfit - minProfit || 1;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xFor = (x: number): number => padL + (x / maxX) * innerW;
  const yFor = (p: number): number => padT + (1 - (p - minProfit) / profitRange) * innerH;
  const yZero = yFor(0);

  const linePts = rows.map((r) => [xFor(r.payingCustomers), yFor(r.profit)] as const);
  const linePath = linePts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Area between line and the zero baseline. Above zero = profit (green tint),
  // below zero = shortfall (vermilion tint). We render two clipped fills using
  // the same line path closed to the zero baseline.
  const areaToZero = `${linePath} L${linePts[linePts.length - 1][0].toFixed(1)},${yZero.toFixed(1)} L${linePts[0][0].toFixed(1)},${yZero.toFixed(1)} Z`;

  const be = model.breakEvenCustomers;
  const beX = be != null ? xFor(be) : null;

  return (
    <div>
      <svg className={c.projChart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profit by paying-customer count">
        {/* horizontal gridlines */}
        {[0, 0.5, 1].map((f) => {
          const y = padT + f * innerH;
          return <line key={f} className={c.projGrid} x1={padL} y1={y} x2={W - padR} y2={y} />;
        })}

        {/* split fill: vermilion shortfall below zero, green above */}
        <defs>
          <clipPath id="below-zero">
            <rect x={padL} y={yZero} width={innerW} height={Math.max(0, padT + innerH - yZero)} />
          </clipPath>
          <clipPath id="above-zero">
            <rect x={padL} y={padT} width={innerW} height={Math.max(0, yZero - padT)} />
          </clipPath>
        </defs>
        <path d={areaToZero} className={c.shortfallBand} clipPath="url(#below-zero)" />
        <path d={areaToZero} className={c.projArea} clipPath="url(#above-zero)" />

        {/* zero baseline */}
        <line className={c.projZeroLine} x1={padL} y1={yZero} x2={W - padR} y2={yZero} />

        {/* break-even target line */}
        {beX != null ? (
          <>
            <line className={c.targetLine} x1={beX} y1={padT} x2={beX} y2={padT + innerH} />
            <text className={c.projAxisLabel} x={Math.min(beX + 4, W - padR - 60)} y={padT + 10}>
              break-even {be}
            </text>
          </>
        ) : null}

        {/* profit line + dots */}
        <path d={linePath} className={c.projLine} />
        {rows.map((r) => (
          <circle
            key={r.payingCustomers}
            cx={xFor(r.payingCustomers)}
            cy={yFor(r.profit)}
            r={3}
            className={`${c.projDot} ${r.profit < 0 ? c.projDotBad : ''}`}
          >
            <title>{`${r.payingCustomers} paying: ${formatMetricValue(r.profit, 'usd', currency)} / mo`}</title>
          </circle>
        ))}

        {/* y-axis labels */}
        <text className={c.projAxisLabel} x={4} y={yFor(maxProfit) + 4}>
          {compactUsd(maxProfit, currency)}
        </text>
        <text className={c.projAxisLabel} x={4} y={yZero + 4}>
          $0
        </text>
        {minProfit < 0 ? (
          <text className={c.projAxisLabel} x={4} y={yFor(minProfit)}>
            {compactUsd(minProfit, currency)}
          </text>
        ) : null}

        {/* x-axis endpoints */}
        <text className={c.projAxisLabel} x={padL} y={H - 12}>
          0
        </text>
        <text className={c.projAxisLabel} x={W - padR} y={H - 12} textAnchor="end">
          {maxX} paying
        </text>
      </svg>
      <div className={c.projLegend}>
        <span className={c.projLegendItem}>
          <span className={`${c.projSwatch} ${c.projSwatchLine}`} /> Monthly profit
        </span>
        <span className={c.projLegendItem}>
          <span className={`${c.projSwatch} ${c.projSwatchShortfall}`} /> Shortfall (below $0)
        </span>
        <span className={c.projLegendItem}>
          <span className={`${c.projSwatch} ${c.projSwatchTarget}`} /> Break-even line
        </span>
      </div>
    </div>
  );
}

function CostStructure({ model, currency }: { model: EconomicsModel; currency: string }) {
  const lines = model.fixedCostLines.filter((l) => l.monthly > 0).sort((a, b) => b.monthly - a.monthly);
  if (lines.length === 0) {
    return (
      <p className={s.sectionLead}>No fixed costs entered yet. Add infrastructure spend in the all-inputs panel.</p>
    );
  }
  const total = model.fixedMonthlyCost || 1;
  return (
    <div className={s.funnel}>
      {lines.map((line) => (
        <ValueBar
          key={line.key}
          label={line.label}
          valueLabel={formatMetricValue(line.monthly, 'usd2', currency)}
          fraction={line.monthly / total}
          tone="neutral"
        />
      ))}
    </div>
  );
}

// ── Tornado ──────────────────────────────────────────────────────────────────

function Tornado({
  inputs,
  drivers,
  target,
  currency,
}: {
  inputs: FinancialInputs;
  drivers: EconomicsDrivers;
  target: TargetMetric;
  currency: string;
}) {
  const rows = useMemo(
    () => buildTornado(inputs, drivers, target, TORNADO_DRIVERS),
    [inputs, drivers, target],
  );

  const maxAbs = Math.max(
    1,
    ...rows.flatMap((r) => [Math.abs(r.deltaLow ?? 0), Math.abs(r.deltaHigh ?? 0)]),
  );

  const fmt = (v: number | null): string => {
    if (v == null) return '—';
    if (target === 'profit') return formatMetricValue(v, 'usd', currency);
    return `${v > 0 ? '+' : ''}${Math.round(v)}`;
  };

  return (
    <div className={c.tornado}>
      {rows.map((row) => {
        // Most negative of the two = left bar; most positive = right bar.
        const lo = Math.min(row.deltaLow ?? 0, row.deltaHigh ?? 0);
        const hi = Math.max(row.deltaLow ?? 0, row.deltaHigh ?? 0);
        const negW = lo < 0 ? (Math.abs(lo) / maxAbs) * 100 : 0;
        const posW = hi > 0 ? (hi / maxAbs) * 100 : 0;
        return (
          <div key={String(row.key)} className={c.tornadoRow}>
            <span className={c.tornadoLabel} title={row.label}>
              {row.label}
            </span>
            <div className={c.tornadoBars}>
              <span className={c.tornadoAxis} aria-hidden="true" />
              <div className={`${c.tornadoCol} ${c.tornadoColNeg}`}>
                {negW > 0 ? <span className={c.tornadoValue}>{fmt(lo)}</span> : null}
                <span className={c.tornadoNeg} style={{ width: `${negW}%` }} />
              </div>
              <div className={c.tornadoCol}>
                <span className={c.tornadoPos} style={{ width: `${posW}%` }} />
                {posW > 0 ? <span className={c.tornadoValue}>{fmt(hi)}</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Compare ──────────────────────────────────────────────────────────────────

function CompareSection({
  scenarios,
  drivers,
  currency,
  compareIds,
  onToggle,
}: {
  scenarios: EconomicsScenario[];
  drivers: EconomicsDrivers;
  currency: string;
  compareIds: string[];
  onToggle: (id: string) => void;
}) {
  const selected = scenarios.filter((s2) => compareIds.includes(s2.id));

  // Compute each selected scenario's model once (not once per table cell).
  const computed = useMemo(
    () => selected.map((sc) => ({ scenario: sc, model: computeEconomics(scenarioInputs(sc), drivers) })),
    [selected, drivers],
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div className={c.compareControls}>
        <span className={s.panelKicker}>Compare (pick up to 3)</span>
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={`${c.compareToggle} ${compareIds.includes(scenario.id) ? c.compareToggleActive : ''}`}
            onClick={() => onToggle(scenario.id)}
            aria-pressed={compareIds.includes(scenario.id)}
          >
            {scenario.name}
          </button>
        ))}
      </div>

      {selected.length >= 2 ? (
        <div className={c.compareTableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Metric</th>
                {selected.map((sc) => (
                  <th key={sc.id} className={s.numCell}>
                    {sc.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((cr) => (
                <tr key={cr.label}>
                  <td className={s.strong}>{cr.label}</td>
                  {computed.map(({ scenario, model }) => (
                    <td key={scenario.id} className={`${s.mono} ${s.numCell}`}>
                      {cr.get(model, currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={s.sectionLead}>Pick two or three scenarios above to compare their key outputs side by side.</p>
      )}
    </div>
  );
}

const COMPARE_ROWS: { label: string; get: (m: EconomicsModel, currency: string) => string }[] = [
  {
    label: 'Net profit / mo',
    get: (m, cur) => formatMetricValue(findMetric(m.snapshot, 'net_profit')?.value ?? null, 'usd', cur),
  },
  {
    label: 'Break-even customers',
    get: (m) => (m.breakEvenCustomers != null ? m.breakEvenCustomers.toLocaleString('en-US') : '—'),
  },
  {
    label: 'ARPU',
    get: (m, cur) => formatMetricValue(m.context.arpu, 'usd2', cur),
  },
  {
    label: 'LTV : CAC',
    get: (m, cur) => formatMetricValue(findMetric(m.unitEconomics, 'ltv_cac')?.value ?? null, 'ratio', cur),
  },
  {
    label: 'Gross margin',
    get: (m, cur) => formatMetricValue(m.context.grossMarginPct, 'pct', cur),
  },
  {
    label: 'Runway',
    get: (m, cur) => formatMetricValue(findMetric(m.snapshot, 'runway')?.value ?? null, 'months', cur),
  },
];

// ── CSS-bound helpers (depend on the cockpit stylesheet) ─────────────────────

function kindClass(kind: ScenarioKind): string {
  if (kind === 'base') return c.scenarioKindBase;
  if (kind === 'upside') return c.scenarioKindUpside;
  if (kind === 'risk') return c.scenarioKindRisk;
  return '';
}

function toneFromMetric(tone: 'good' | 'warn' | 'bad' | 'neutral' | undefined): 'good' | 'bad' | 'warn' | 'neutral' {
  if (tone === 'good' || tone === 'bad' || tone === 'warn') return tone;
  return 'neutral';
}
