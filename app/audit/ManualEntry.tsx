'use client';

import type { AuditDispute, DisputeOutcome, ReasonCode } from '@/lib/audit/types';
import styles from './audit.module.css';

// Manual-entry rows for the audit funnel. Each row collects the minimum the
// scoring brain needs: amount, reason code, outcome, and which proof the
// merchant holds (delivery / usage / comms). Mirrors the manual path the
// strategy doc describes (amount, reason code, date, won/lost, proof flags).

const MAX_ROWS = 40;

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'product_not_received', label: 'Services / product not received (Visa 13.1)' },
  { value: 'subscription_canceled', label: 'Subscription cancelled (Visa 13.2)' },
  { value: 'product_unacceptable', label: 'Not as described (Visa 13.3)' },
  { value: 'fraudulent', label: 'Fraudulent / unauthorized (Visa 10.4)' },
  { value: 'credit_not_processed', label: 'Credit not processed (Visa 13.6)' },
  { value: 'duplicate', label: 'Duplicate charge (Visa 12.6)' },
  { value: 'unrecognized', label: 'Unrecognized charge' },
  { value: 'general', label: 'Other / general dispute' },
];

const OUTCOME_OPTIONS: { value: DisputeOutcome; label: string }[] = [
  { value: 'lost', label: 'Lost' },
  { value: 'won', label: 'Won' },
  { value: 'open', label: 'Still open' },
  { value: 'unknown', label: 'Not sure' },
];

let rowSeq = 0;

export function makeBlankRow(): AuditDispute {
  rowSeq += 1;
  return {
    id: `manual-${rowSeq}-${Math.random().toString(36).slice(2, 7)}`,
    amount: null,
    currency: 'usd',
    // `reasonRaw: null` marks an untouched row so it is ignored until the
    // merchant actively picks a reason.
    reasonCode: 'product_not_received',
    reasonRaw: null,
    createdAt: null,
    outcome: 'lost',
    proof: { delivery: false, usage: false, comms: false },
    source: 'manual',
  };
}

interface ManualDisputeRowsProps {
  rows: AuditDispute[];
  setRows: React.Dispatch<React.SetStateAction<AuditDispute[]>>;
}

export function ManualDisputeRows({ rows, setRows }: ManualDisputeRowsProps) {
  const update = (id: string, patch: Partial<AuditDispute>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateProof = (id: string, key: keyof AuditDispute['proof'], value: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, proof: { ...r.proof, [key]: value } } : r)),
    );
  };

  const addRow = () => setRows((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, makeBlankRow()]));
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length <= 1 ? [makeBlankRow()] : prev.filter((r) => r.id !== id)));

  return (
    <div className={styles.manualPane}>
      {rows.map((row, i) => (
        <fieldset className={styles.manualRow} key={row.id}>
          <legend className={styles.manualRowLegend}>Dispute {i + 1}</legend>

          <div className={styles.manualGrid}>
            <label className={styles.manualField}>
              <span>Amount</span>
              <input
                className="inp"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 490"
                value={row.amount == null ? '' : String(row.amount)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d.]/g, '');
                  const n = cleaned === '' ? null : Number.parseFloat(cleaned);
                  update(row.id, { amount: n != null && Number.isFinite(n) ? n : null });
                }}
              />
            </label>

            <label className={styles.manualField}>
              <span>Reason</span>
              <select
                className="inp"
                value={row.reasonRaw === null ? '' : row.reasonCode}
                onChange={(e) =>
                  update(row.id, {
                    reasonCode: e.target.value as ReasonCode,
                    reasonRaw: e.target.value,
                  })
                }
              >
                <option value="" disabled>
                  Choose a reason
                </option>
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.manualField}>
              <span>Outcome</span>
              <select
                className="inp"
                value={row.outcome}
                onChange={(e) => update(row.id, { outcome: e.target.value as DisputeOutcome })}
              >
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.proofRow}>
            <span className={styles.proofLabel}>What proof do you have?</span>
            <div className={styles.proofChecks}>
              <ProofCheck
                checked={row.proof.delivery}
                onChange={(v) => updateProof(row.id, 'delivery', v)}
                label="Delivery / fulfillment proof"
              />
              <ProofCheck
                checked={row.proof.usage}
                onChange={(v) => updateProof(row.id, 'usage', v)}
                label="Usage / login logs"
              />
              <ProofCheck
                checked={row.proof.comms}
                onChange={(v) => updateProof(row.id, 'comms', v)}
                label="Email / Slack threads"
              />
            </div>
          </div>

          {rows.length > 1 && (
            <button
              type="button"
              className={styles.removeRow}
              onClick={() => removeRow(row.id)}
              aria-label={`Remove dispute ${i + 1}`}
            >
              Remove
            </button>
          )}
        </fieldset>
      ))}

      <button type="button" className={styles.addRow} onClick={addRow} disabled={rows.length >= MAX_ROWS}>
        + Add another dispute
      </button>
    </div>
  );
}

function ProofCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className={`${styles.proofCheck} ${checked ? styles.proofCheckOn : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
