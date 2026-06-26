import type { PacketReadinessCheck, ReadinessKey } from '@/lib/evidence/packet';
import type { EvidenceStrength } from '@/lib/evidence/resolution';
import { AlertIcon, CheckIcon, InfoCircleIcon } from '../../dash-icons';
import styles from './workbench.module.css';

/**
 * Readiness as a concrete checklist (Redesign 2026-06-26) — replaces the abstract
 * percentage dial. Each row is a named item the merchant understands, drawn from
 * the SAME `packet.readiness.checks`, so it can never disagree with the step-bar
 * "N of M items confirmed" summary. The percentage data still exists upstream and
 * is exposed behind a "Show readiness detail" disclosure in the Build stage.
 *
 * Every row is icon + text (WCAG 1.4.1). Vermilion appears only on a genuinely
 * missing, merchant-closable item; system checks are neutral; the strength pill
 * is never vermilion (completeness is not a blocker, and never a win prediction).
 */

// Items the merchant can actually close by adding evidence. The rest
// (charge_attached, qa_clear) are derived/system checks, shown neutral.
const MERCHANT_CLOSABLE: ReadinessKey[] = [
  'delivery_proof',
  'policy',
  'product_description',
  'narrative',
];

function strengthPillClass(tone: EvidenceStrength['tone']): string {
  if (tone === 'trust') return styles.pillVerdict;
  if (tone === 'warning') return styles.pillWarning;
  return styles.pillNeutral;
}

export function ReadinessChecklist({
  checks,
  confirmedCount,
  totalChecks,
  strength,
}: {
  checks: PacketReadinessCheck[];
  confirmedCount: number;
  totalChecks: number;
  strength: EvidenceStrength;
}) {
  const open = checks.filter((c) => !c.done);
  const done = checks.filter((c) => c.done);

  return (
    <section className={`${styles.card} overflow-hidden`} aria-label="Evidence completeness">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>What is in your evidence</p>
          <p className={`${styles.labelMono} mt-1.5`}>How complete your evidence is. Not a win prediction.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={strengthPillClass(strength.tone)}>
            {strength.tone === 'trust' ? (
              <CheckIcon className="h-3 w-3" />
            ) : (
              <InfoCircleIcon className="h-3 w-3" />
            )}
            {strength.label}
          </span>
          <span className={styles.labelMono}>
            {confirmedCount} of {totalChecks} confirmed
          </span>
        </div>
      </header>

      <ul className="px-6 py-1">
        {open.length > 0 ? (
          open.map((check) => <ChecklistRow key={check.key} check={check} />)
        ) : (
          <li className="flex items-center gap-3 py-4 text-sm text-ink-soft">
            <span className={`${styles.statusDotOk} h-5 w-5`} aria-hidden="true">
              <CheckIcon className="h-3 w-3" />
            </span>
            Every expected item is confirmed.
          </li>
        )}
      </ul>

      {done.length > 0 ? (
        <details className="border-t border-rule px-6 py-3">
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>
            Show {done.length} confirmed {done.length === 1 ? 'item' : 'items'}
          </summary>
          <ul className="mt-2">
            {done.map((check) => (
              <ChecklistRow key={check.key} check={check} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ChecklistRow({ check }: { check: PacketReadinessCheck }) {
  const closable = MERCHANT_CLOSABLE.includes(check.key);
  const dotClass = check.done
    ? styles.statusDotOk
    : closable
      ? styles.statusDotGap
      : styles.statusDotNeutral;
  const pillClass = check.done ? styles.pillVerdict : closable ? styles.pillGap : styles.pillNeutral;
  const statusWord = check.done ? 'Confirmed' : closable ? 'Add this' : 'Pending';
  const icon = check.done ? (
    <CheckIcon className="h-3 w-3" />
  ) : closable ? (
    <AlertIcon className="h-3 w-3" />
  ) : (
    <InfoCircleIcon className="h-3 w-3" />
  );

  return (
    <li className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 border-b border-rule py-3 last:border-b-0">
      <span className={`${dotClass} h-5 w-5`} aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm font-medium text-ink">{check.label}</span>
      <span className={pillClass}>
        {icon}
        {statusWord}
      </span>
    </li>
  );
}
