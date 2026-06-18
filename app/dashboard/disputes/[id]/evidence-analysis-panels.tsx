import type { EvidenceAnalysis } from '@/lib/evidence';
import type { NarrativeBlock, QaFinding, Severity } from '@/lib/evidence';
import { AlertIcon, CheckIcon, InfoCircleIcon } from '../../dash-icons';
import styles from './workbench.module.css';

// Cap the rendered activity bars so a long history stays a compact strip.
const MAX_ACTIVITY_DAYS_SHOWN = 40;
// Floor (in %) so a low-count day still renders a visible bar, never zero-height.
const MIN_ACTIVITY_BAR_PCT = 8;

/**
 * Presentational rendering of the per-dispute evidence analysis (Revano-adopted
 * features). Pure props in, UI out — the workbench server component computes the
 * `EvidenceAnalysis` and passes it here. No data fetching, no state.
 *
 * Argument column (main):
 *   - Argument narratives (geo consistency, activity, policy binding) — #1/#2/#3
 *   - Founder → bank translation side-by-side — #4 (C-E1 raw -> bank-ready)
 *
 * Pre-submission QA (#5) is exported separately as `QaPanel`; the workbench
 * renders it in the right rail next to Account risk (decision-first IA).
 */
export function EvidenceAnalysisPanels({ analysis }: { analysis: EvidenceAnalysis }) {
  return (
    <>
      <ArgumentNarratives narratives={analysis.narratives} timeline={analysis.timeline} />
      <TranslationPanel pairs={analysis.translation} />
    </>
  );
}

// ─── Pre-submission QA (rail panel) ──────────────────────────────────────────

// R5: each finding is one of Revano's three failure modes. The kind label is
// surfaced explicitly so a merchant sees WHY a flag blocks (missing / weak /
// mismatched), each tied to the reason code via the finding detail.
const QA_KIND_LABEL: Record<QaFinding['kind'], string> = {
  missing: 'Missing',
  weak: 'Weak',
  mismatch: 'Mismatched',
  ok: 'Clear',
};

/** Rail-placed QA panel. Pulls block/warn/ok findings from the analysis. */
export function QaPanel({ analysis }: { analysis: EvidenceAnalysis }) {
  return (
    <QaFindingsPanel qa={analysis.qa} summary={analysis.qaSummary} blocked={analysis.filingBlocked} />
  );
}

function QaFindingsPanel({
  qa,
  summary,
  blocked,
}: {
  qa: QaFinding[];
  summary: { blocks: number; warns: number; oks: number };
  blocked: boolean;
}) {
  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <p className={styles.labelMonoStrong}>Pre-submission QA</p>
        <span className={blocked ? styles.pillGap : summary.warns > 0 ? styles.pillWarning : styles.pillVerdict}>
          {blocked ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
          {blocked
            ? `${summary.blocks} to resolve`
            : summary.warns > 0
              ? `${summary.warns} to review`
              : 'Clear'}
        </span>
      </header>
      <p className={`${styles.labelMono} px-5 pt-3`}>
        Checks for missing, weak, and mismatched evidence before you file.
      </p>
      <ul className="px-5 py-1">
        {qa.map((f) => (
          <li className="flex gap-3 border-b border-rule py-3 last:border-b-0" key={f.id}>
            <span
              className={`mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-[4px] ${
                f.status === 'block'
                  ? styles.statusDotGap
                  : f.status === 'warn'
                    ? styles.statusDotNeutral
                    : styles.statusDotOk
              }`}
            >
              {f.status === 'ok' ? (
                <CheckIcon className="h-3 w-3" />
              ) : f.status === 'warn' ? (
                <InfoCircleIcon className="h-3 w-3" />
              ) : (
                <AlertIcon className="h-3 w-3" />
              )}
            </span>
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold leading-snug text-ink">{f.title}</span>
                {f.kind !== 'ok' ? (
                  <span className={styles.labelMono}>{QA_KIND_LABEL[f.kind]}</span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-ink-mute">{f.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Argument narratives (geo / activity / policy) ───────────────────────────

const SEVERITY_PILL: Record<Severity, string> = {
  strong: styles.pillVerdict,
  present: styles.pillNeutral,
  missing: styles.pillNeutral,
  mismatch: styles.pillGap,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  strong: 'Strong',
  present: 'Present',
  missing: 'Not yet connected',
  mismatch: 'Conflict',
};

function ArgumentNarratives({
  narratives,
  timeline,
}: {
  narratives: NarrativeBlock[];
  timeline: { day: string; count: number }[];
}) {
  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>The argument, in bank language</p>
          <p className={`${styles.labelMono} mt-1.5`}>
            Built only from what your evidence actually supports
          </p>
        </div>
      </header>
      <div className="px-6 py-2">
        {narratives.map((n) => (
          <div key={n.id} className="border-b border-rule py-4 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{n.heading}</span>
              <span className={SEVERITY_PILL[n.severity]}>
                {n.severity === 'strong' ? (
                  <CheckIcon className="h-3 w-3" />
                ) : n.severity === 'mismatch' ? (
                  <AlertIcon className="h-3 w-3" />
                ) : (
                  <InfoCircleIcon className="h-3 w-3" />
                )}
                {SEVERITY_LABEL[n.severity]}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{n.body}</p>
          </div>
        ))}
        {timeline.length > 0 && <ActivityBars timeline={timeline} />}
      </div>
    </section>
  );
}

function ActivityBars({ timeline }: { timeline: { day: string; count: number }[] }) {
  const max = Math.max(...timeline.map((t) => t.count), 1);
  const shown = timeline.slice(-MAX_ACTIVITY_DAYS_SHOWN);
  return (
    <div className="border-t border-rule py-4">
      <p className={`${styles.labelMono} mb-3`}>Activity over time</p>
      <div className="flex h-16 items-end gap-[2px]" aria-hidden="true">
        {shown.map((t) => (
          <span
            key={t.day}
            className="flex-1 rounded-sm bg-action/70"
            style={{ height: `${Math.max(MIN_ACTIVITY_BAR_PCT, (t.count / max) * 100)}%` }}
            title={`${t.day}: ${t.count}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-mute">
        {shown.length} active {shown.length === 1 ? 'day' : 'days'} shown, steady engagement reads as a
        real user.
      </p>
    </div>
  );
}

// ─── Founder → bank translation (C-E1 raw in / bank-ready out) ────────────────

function TranslationPanel({ pairs }: { pairs: { founder: string; bank: string }[] }) {
  if (pairs.length === 0) return null;
  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="border-b border-rule bg-surface-3/60 px-6 py-4">
        <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>From your words to the bank&rsquo;s</p>
        <p className={`${styles.labelMono} mt-1.5`}>
          Raw on the left, mapped to the required field on the right
        </p>
      </header>
      <div className="px-6 py-2">
        {pairs.map((p) => (
          <div
            key={`${p.founder}::${p.bank}`}
            className="grid gap-3 border-b border-rule py-4 last:border-b-0 sm:grid-cols-2"
          >
            <div className="rounded-md border border-rule bg-surface-2 px-4 py-3">
              <p className={`${styles.labelMono} mb-1.5`}>You said (raw)</p>
              <p className="text-sm leading-6 text-ink-soft">{p.founder}</p>
            </div>
            <div className="rounded-md border border-trust-rule bg-trust-soft px-4 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-trust-deep">
                <CheckIcon className="h-3 w-3" />
                Mapped to required field
              </p>
              <p className="text-sm leading-6 text-ink">{p.bank}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
