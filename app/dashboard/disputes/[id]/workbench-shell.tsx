'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, ChevronRightIcon, LockIcon } from '../../dash-icons';
import styles from './workbench-shell.module.css';

/**
 * Guided 3-stage workbench shell (Redesign 2026-06-26).
 *
 * Replaces the single 13-section scroll with a calm, sequenced flow:
 *   Build evidence  ->  Review  ->  Approve and file
 *
 * Architecture: `page.tsx` stays a server component and computes everything; it
 * passes pre-rendered server subtrees here as ReactNode slots. This shell holds
 * ONLY UI state (active stage + whether Review has been opened) — it never
 * re-fetches and never imports the stage modules.
 *
 * Inactive stages are kept MOUNTED but `hidden`, so client state (the narrative
 * textarea, in-flight uploads) and their autosave timers survive a stage switch,
 * and every deep-link anchor target stays in the DOM. A click delegate catches
 * in-page links (`#add-evidence`, `#stage-review`, ...) inside the server-rendered
 * subtrees and expands the owning stage BEFORE scrolling, so no deep link is ever
 * a dead anchor.
 */

export type Stage = 'build' | 'review' | 'file';
const STAGE_ORDER: Stage[] = ['build', 'review', 'file'];
const STAGE_LABELS: Record<Stage, string> = {
  build: 'Build evidence',
  review: 'Review',
  file: 'Approve and file',
};

// Each preserved deep-link anchor -> the stage that hosts its target node.
const ANCHOR_STAGE: Record<string, Stage> = {
  'add-evidence': 'build',
  'import-slack': 'build',
  'acceptance-gap': 'build',
  resolve: 'build',
  'your-account': 'review',
};

export interface StageDoneState {
  build: boolean; // resolutionPlan === null (no open gap to push on)
  review: boolean; // approved
  file: boolean; // submitted
}

export interface WorkbenchShellProps {
  defaultStage: Stage;
  doneState: StageDoneState;
  // Honest gentle gate: the Approve and file step unlocks once Review has been
  // opened. Never a trap — Build and Review stay reachable at all times.
  requireReviewBeforeFile: boolean;
  // Slim, non-numeric readiness line shown on the right of the step bar.
  readinessSummary: string;
  focusCard: ReactNode;
  buildStage: ReactNode;
  reviewStage: ReactNode;
  fileStage: ReactNode;
  stageSummaries: Record<Stage, string>;
}

export function WorkbenchShell({
  defaultStage,
  doneState,
  requireReviewBeforeFile,
  readinessSummary,
  focusCard,
  buildStage,
  reviewStage,
  fileStage,
  stageSummaries,
}: WorkbenchShellProps) {
  const [stage, setStage] = useState<Stage>(defaultStage);
  const [hasOpenedReview, setHasOpenedReview] = useState(
    defaultStage === 'review' || defaultStage === 'file' || doneState.review,
  );
  const [liveMsg, setLiveMsg] = useState('');
  const bodyRefs = useRef<Record<Stage, HTMLDivElement | null>>({
    build: null,
    review: null,
    file: null,
  });

  const fileUnlocked = !requireReviewBeforeFile || hasOpenedReview;
  const currentIndex = STAGE_ORDER.indexOf(stage);
  const stageContent: Record<Stage, ReactNode> = {
    build: buildStage,
    review: reviewStage,
    file: fileStage,
  };

  const goToStage = useCallback((next: Stage) => {
    if (next === 'review') setHasOpenedReview(true);
    setStage(next);
    setLiveMsg(`Step ${STAGE_ORDER.indexOf(next) + 1} of 3, ${STAGE_LABELS[next]}`);
    // Move focus to the newly revealed stage body on the next paint.
    requestAnimationFrame(() => {
      bodyRefs.current[next]?.focus();
    });
  }, []);

  const goToAnchor = useCallback(
    (anchor: string) => {
      const owner = ANCHOR_STAGE[anchor] ?? 'build';
      goToStage(owner);
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Double rAF so the owning stage has un-hidden and painted before we open a
      // collapsed <details> target and scroll. Honor reduced-motion explicitly: a
      // JS smooth scroll ignores the CSS scroll-behavior override.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(anchor);
          if (el instanceof HTMLDetailsElement) el.open = true;
          el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        });
      });
    },
    [goToStage],
  );

  // Delegate in-page link clicks from server-rendered stage subtrees + the focus
  // card. `#stage-*` hops between stages; a known content anchor expands its owner
  // then scrolls. Everything else (e.g. /settings) falls through to the browser.
  const handleInPageNav = useCallback(
    (e: React.MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const hash = (link.getAttribute('href') ?? '').slice(1);
      if (!hash) return;
      if (hash.startsWith('stage-')) {
        const target = hash.slice('stage-'.length) as Stage;
        if (STAGE_ORDER.includes(target)) {
          if (target === 'file' && !fileUnlocked) {
            e.preventDefault();
            setLiveMsg('Open Review first, then you can approve and file.');
            goToStage('review');
            return;
          }
          e.preventDefault();
          goToStage(target);
        }
        return;
      }
      if (hash in ANCHOR_STAGE) {
        e.preventDefault();
        goToAnchor(hash);
      }
    },
    [fileUnlocked, goToStage, goToAnchor],
  );

  return (
    <>
      <nav className={styles.bar} aria-label="Dispute filing progress">
        <div className={styles.barInner}>
          <ol className={styles.prog}>
            {STAGE_ORDER.map((st, i) => {
              const active = st === stage;
              const done = doneState[st];
              const locked = st === 'file' && !fileUnlocked;
              const cls = [
                styles.progBtn,
                active ? styles.progCurrent : done ? styles.progDone : '',
                locked ? styles.progDisabled : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={st} className={styles.progStep}>
                  <button
                    type="button"
                    className={cls}
                    aria-current={active ? 'step' : undefined}
                    aria-disabled={locked || undefined}
                    onClick={() => {
                      if (locked) {
                        setLiveMsg('Open Review first, then you can approve and file.');
                        goToStage('review');
                        return;
                      }
                      goToStage(st);
                    }}
                  >
                    <span className={styles.progNum} aria-hidden="true">
                      {done ? <CheckIcon className="h-3.5 w-3.5" /> : locked ? <LockIcon className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={styles.progLabel}>{STAGE_LABELS[st]}</span>
                    <span className="sr-only">
                      {`Step ${i + 1} of 3${done ? ', done' : active ? ', current step' : ''}${
                        locked ? ', locked until you open Review' : ''
                      }`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span className={styles.barSummary}>{readinessSummary}</span>
          <span className={styles.barStepLabel}>
            {`Step ${currentIndex + 1} of 3 · ${STAGE_LABELS[stage]}`}
          </span>
        </div>
      </nav>

      <div onClickCapture={handleInPageNav}>
        <div className={styles.stages}>
          {focusCard}

          {STAGE_ORDER.map((st, i) => {
            const active = st === stage;
            const done = doneState[st];
            const locked = st === 'file' && !fileUnlocked;
            return (
              <section key={st} className={styles.stageSection} aria-label={STAGE_LABELS[st]}>
                {!active && (
                  <button
                    type="button"
                    className={styles.stageSummary}
                    onClick={() => {
                      if (locked) {
                        setLiveMsg('Open Review first, then you can approve and file.');
                        goToStage('review');
                        return;
                      }
                      goToStage(st);
                    }}
                  >
                    <span
                      className={`${styles.stageSummaryNum} ${done ? styles.stageSummaryNumDone : ''}`}
                      aria-hidden="true"
                    >
                      {done ? <CheckIcon className="h-4 w-4" /> : locked ? <LockIcon className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={styles.stageSummaryText}>
                      <span className={styles.stageSummaryTitle}>{STAGE_LABELS[st]}</span>
                      <span className={styles.stageSummaryHint}>
                        {locked ? 'Open Review first' : stageSummaries[st]}
                      </span>
                    </span>
                    <ChevronRightIcon className={`h-4 w-4 ${styles.stageSummaryChevron}`} />
                  </button>
                )}
                <div
                  ref={(el) => {
                    bodyRefs.current[st] = el;
                  }}
                  hidden={!active}
                  tabIndex={-1}
                  aria-label={STAGE_LABELS[st]}
                  className={styles.stageBody}
                >
                  {stageContent[st]}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </>
  );
}
