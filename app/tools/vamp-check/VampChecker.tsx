'use client';

import { useState } from 'react';
import { VerdactLogo } from '../../_components/verdact-logo';

// ─── Types ───────────────────────────────────────────────────────────────────

type VampStatus = 'empty' | 'safe' | 'watch' | 'critical' | 'excessive';

interface FormValues {
  settledTx: string;
  disputes: string;
  efws: string;
  efwsRefunded: string;
}

interface VampResult {
  ratio: number;
  status: VampStatus;
  numerator: number;
  bufferToExcessive: number;
  hasInputs: boolean;
}

// ─── VAMP logic ──────────────────────────────────────────────────────────────

const EXCESSIVE = 1.5;
const CRITICAL = 1.0;
const WATCH = 0.5;

function computeVamp(form: FormValues): VampResult {
  const settledTx = parseFloat(form.settledTx) || 0;
  const disputes = parseFloat(form.disputes) || 0;
  const efws = parseFloat(form.efws) || 0;

  if (settledTx <= 0) {
    return { ratio: 0, status: 'empty', numerator: 0, bufferToExcessive: 0, hasInputs: false };
  }

  const numerator = disputes + efws;
  const ratio = (numerator / settledTx) * 100;
  const bufferToExcessive = Math.floor(settledTx * (EXCESSIVE / 100) - numerator);

  let status: VampStatus;
  if (ratio < WATCH) status = 'safe';
  else if (ratio < CRITICAL) status = 'watch';
  else if (ratio < EXCESSIVE) status = 'critical';
  else status = 'excessive';

  return { ratio, status, numerator, bufferToExcessive, hasInputs: true };
}

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META = {
  empty:     { label: '',          color: 'var(--ink-faint)' },
  safe:      { label: 'Safe',      color: 'var(--trust)' },
  watch:     { label: 'Watch',     color: 'var(--warning)' },
  critical:  { label: 'Critical',  color: 'var(--danger)' },
  excessive: { label: 'Excessive', color: 'var(--accent)' },
} as const;

// ─── Recommendations (3 per status) ──────────────────────────────────────────

const RECS: Record<Exclude<VampStatus, 'empty'>, string[]> = {
  safe: [
    'Review any open EFW within 24 hours. A refund can reduce the chance of a later dispute, but it does not erase a TC40 report already counted by Visa.',
    'Set a monthly VAMP review. Counts move by program month, so today\'s buffer can close fast.',
    'Tighten your refund and cancellation policy now, before disputes arrive.',
  ],
  watch: [
    'Review all open EFWs today. Refund where appropriate to reduce the chance of a second event from the same payment.',
    'Find your top-3 products by dispute count. Concentration in one tier inflates the ratio.',
    'Tighten the cancellation flow. Most "services not rendered" disputes come from unclear cancel paths.',
    'Add Stripe Radar rules for cards flagged in the EFW feed. Blocking before authorization prevents disputes from forming.',
  ],
  critical: [
    'Review every open EFW today and stop the same pattern from creating follow-on disputes.',
    'Suspend or restrict your highest-dispute products or customer segments until the ratio drops below 1.0%.',
    'Contact Stripe with a written remediation plan. Proactive disclosure changes how this is handled.',
    'Check whether any Visa fraud reports qualify for Compelling Evidence 3.0 treatment in Stripe.',
    'First-time violation? You have a 3-month grace period before Visa\'s $8 per dispute fees apply.',
  ],
  excessive: [
    'Your estimated ratio is at or above the 1.5% excessive line. Confirm final status in Stripe because Visa also considers count and regional rules.',
    'First identification can have a grace period, but repeat or sustained excess requires immediate remediation.',
    'Review every open EFW today. Suspend your highest-dispute products until the ratio trend is under control.',
    'Notify Stripe in writing with a remediation timeline. Proactive disclosure changes how this is handled.',
    'Review whether any Visa fraud reports qualify for Compelling Evidence 3.0 treatment in Stripe.',
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

// ─── UI ──────────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header className="border-b border-rule bg-surface-2">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <a href="/" className="flex items-center">
          <VerdactLogo variant="lockup" className="h-10 w-auto" />
        </a>
        <nav className="flex min-w-0 items-center gap-2 text-sm sm:gap-3" aria-label="Primary">
          <a className="btn-ghost whitespace-nowrap px-2 py-2 text-sm sm:px-3" href="/login">Sign in</a>
          <a href="/signup" className="btn-primary hidden whitespace-nowrap px-4 py-2 text-sm sm:inline-flex">Create workspace</a>
        </nav>
      </div>
    </header>
  );
}

function PageFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-8 md:px-10">
        <p className="label-mono">Verdact</p>
        <div className="flex flex-wrap items-center gap-5 text-sm text-ink-mute">
          <a className="hover:text-ink" href="/privacy">Privacy</a>
          <a className="hover:text-ink" href="/terms">Terms</a>
          <a className="hover:text-ink" href="mailto:admin@verdact.io">admin@verdact.io</a>
        </div>
      </div>
    </footer>
  );
}

function NumberInput({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0'}
        className="field-input"
      />
      <p className="mt-1.5 text-xs leading-5 text-ink-faint">{hint}</p>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function VampChecker() {
  const [form, setForm] = useState<FormValues>({
    settledTx: '',
    disputes: '',
    efws: '',
    efwsRefunded: '',
  });

  const result = computeVamp(form);
  const meta = STATUS_META[result.status];
  const hasStatus = result.hasInputs && result.status !== 'empty';
  const ratioDisplay = result.hasInputs ? `${result.ratio.toFixed(2)}%` : '—';

  const bufferText =
    result.hasInputs && result.status !== 'excessive'
      ? `${fmt(Math.max(0, result.bufferToExcessive))} more dispute/EFW events before the 1.5% ratio line`
      : null;

  const setField = (field: keyof FormValues) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      <PageHeader />

      {/* Hero */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-12 md:px-10 md:py-14">
          <p className="label-mono text-accent">Free manual tool</p>
          <h1 className="font-display-light mt-4 text-[2.2rem] leading-[1.1] text-ink md:text-[3.2rem]">
            VAMP Risk Checker
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            Enter a current or recent Visa program month to estimate your VAMP ratio.{' '}
            <span className="text-ink-mute">
              With a Verdact workspace, this runs automatically every day from your Stripe data.
            </span>
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="border-b border-rule">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-12 md:px-10">

          {/* Automatic with Verdact callout */}
          <div
            className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border bg-surface-2 px-4 py-2.5"
            style={{ borderColor: 'var(--rule-strong)' }}
          >
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: 'var(--action)' }}
            />
            <span className="label-mono-strong">Automatic with Verdact</span>
            <span className="text-sm leading-6 text-ink-soft">
              Connect Stripe and these numbers update daily, with alerts before each threshold.
            </span>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">

            {/* Inputs */}
          <div>
              <p className="label-mono">Your numbers (Visa program month)</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <NumberInput
                  id="settled-tx"
                  label="Settled transactions"
                  hint="Successful card charges (TC05). Stripe → Balance Transactions, type=payment."
                  value={form.settledTx}
                  onChange={setField('settledTx')}
                  placeholder="e.g. 4200"
                />
                <NumberInput
                  id="disputes"
                  label="Disputes received"
                  hint="Chargebacks and retrievals (TC15). Stripe → Disputes dashboard."
                  value={form.disputes}
                  onChange={setField('disputes')}
                  placeholder="e.g. 12"
                />
                <NumberInput
                  id="efws"
                  label="EFWs received"
                  hint="Early Fraud Warnings (TC40). Stripe → Radar → Reviews."
                  value={form.efws}
                  onChange={setField('efws')}
                  placeholder="e.g. 8"
                />
                <NumberInput
                  id="efws-refunded"
                  label="EFWs already refunded"
                  hint="For action guidance only. A refund can prevent a later dispute, but it does not remove an EFW already reported to Visa."
                  value={form.efwsRefunded}
                  onChange={setField('efwsRefunded')}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            {/* Result */}
            <div>
              <p className="label-mono">Estimated ratio</p>
              <div className="surface-card mt-6 p-6">
                <div className="flex items-baseline gap-4">
                  <span
                    className="font-display text-[3.6rem] leading-none font-light tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {ratioDisplay}
                  </span>
                  {hasStatus && (
                    <span className="text-sm font-medium" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {bufferText && (
                  <p className="mt-4 text-sm leading-6 text-ink-soft">{bufferText}</p>
                )}

                {result.status === 'excessive' && (
                  <p className="mt-4 text-sm leading-6" style={{ color: 'var(--accent)' }}>
                    Your ratio estimate is at or above the Visa excessive line. Confirm final status in Stripe.
                  </p>
                )}

                {!result.hasInputs && (
                  <p className="mt-4 text-sm leading-6 text-ink-faint">
                    Enter your numbers to see your estimated ratio.
                  </p>
                )}

                {/* Threshold reference */}
                <div className="mt-6 space-y-1.5 border-t border-rule pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Visa non-compliant</span>
                    <span className="tabular-nums" style={{ color: 'var(--trust)' }}>0.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Internal warning</span>
                    <span className="tabular-nums" style={{ color: 'var(--warning)' }}>1.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-mute">Visa excessive ratio</span>
                    <span className="tabular-nums" style={{ color: 'var(--accent)' }}>1.5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recommendations */}
      {hasStatus && (
        <section className="border-b border-rule bg-surface-2">
          <div className="mx-auto w-full max-w-[1100px] px-6 py-12 md:px-10">
            <p className="label-mono">Recommended next steps</p>
            <ol className="mt-6 grid gap-3 md:grid-cols-2">
              {RECS[result.status as Exclude<VampStatus, 'empty'>].map((rec, i) => (
                <li key={i} className="surface-card-flat p-4">
                  <span className="label-mono text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">{rec}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* CTA */}
      <section>
        <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-6 py-12 md:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="label-mono">Stop tracking VAMP by hand</p>
            <p className="font-display-light mt-3 text-[1.6rem] leading-tight text-ink md:text-[2rem]">
              Connect Stripe once. Verdact updates this daily.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn-primary" href="/signup">Create workspace</a>
              <a className="btn-secondary" href="/">Learn more</a>
            </div>
          </div>

          <div className="surface-card-flat p-5">
            <p className="label-mono">What changes inside Verdact</p>
            <ul className="mt-4 space-y-3">
              {[
                {
                  manual: 'Manual entry each time you check.',
                  auto: 'Daily auto-pull from your Stripe account.',
                },
                {
                  manual: 'You check this when you remember.',
                  auto: 'Alerts before you cross 0.5%, 1.0%, and 1.5%.',
                },
                {
                  manual: 'Generic recommendations.',
                  auto: 'Tied to your products, customers, and dispute reason codes.',
                },
              ].map((row, i) => (
                <li
                  key={i}
                  className="grid gap-1 border-b border-rule pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="text-xs leading-5 text-ink-faint">
                    <span className="label-mono mr-2">Here</span>
                    {row.manual}
                  </p>
                  <p className="text-sm leading-6 text-ink">
                    <span
                      className="label-mono-strong mr-2"
                      style={{ color: 'var(--action)' }}
                    >
                      With Verdact
                    </span>
                    {row.auto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex-1" />
      <PageFooter />
    </div>
  );
}
