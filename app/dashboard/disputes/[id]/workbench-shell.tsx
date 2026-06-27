'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  LoaderIcon,
  LockIcon,
  PencilIcon,
} from '../../dash-icons';
import styles from './workbench-shell.module.css';

/**
 * Guided 3-stage workbench shell — Stage-Panels redesign (v2, 2026-06-27).
 *
 * The page IS the three steps: Build -> Review -> Approve and file, rendered as
 * a single-open accordion with a loud "where you are" spine. State lives here
 * (active stage + whether Review has been opened). page.tsx stays a server
 * component: it computes everything and passes pre-rendered server subtrees as
 * ReactNode slots (header, the three stage bodies, reassurance).
 *
 * Inactive stages are kept MOUNTED but `hidden`, so client state (the narrative
 * textarea, in-flight uploads, autosave timers) survives a stage switch and
 * every deep-link target stays in the DOM. A click delegate catches in-page
 * links (`#stage-review`, `#add-evidence`, ...) inside the server-rendered
 * subtrees and opens the owning stage BEFORE scrolling, so a deep link is never
 * a dead anchor. The Step 3 "take me to what's missing" hero routes through the
 * same delegate, opening Build and flagging the gap.
 *
 * Honest spine: a step shows "Done" only when its work is genuinely complete,
 * never just because it was visited. Navigation is never hard-blocked.
 */

export type Stage = 'build' | 'review' | 'file';
const STAGE_ORDER: Stage[] = ['build', 'review', 'file'];

// Short names for the spine; the stage heads carry the full titles.
const SPINE_NAME: Record<Stage, string> = {
  build: 'Build',
  review: 'Review',
  file: 'Approve & file',
};

type StageMeta = { eyebrow: string; title: string; lede: string; ledeIncomplete?: string };
const STAGE_META: Record<Stage, StageMeta> = {
  build: {
    eyebrow: 'You are here',
    title: 'Build the proof',
    lede: 'Gather everything that shows the work was delivered. We collect it, you confirm it.',
  },
  review: {
    eyebrow: 'Review',
    title: 'Review the record',
    lede: 'See the exact packet the bank will read. Mapped fields and exhibits, in their order.',
  },
  file: {
    eyebrow: 'Final step',
    title: 'Approve and file',
    lede: 'You approve first. Nothing is sent before you do, and filing to Stripe opens after beta.',
    ledeIncomplete:
      'A couple of things still stand between you and filing. We show you exactly what, and guide you back.',
  },
};

// Each preserved deep-link anchor -> the stage that hosts its target node.
const ANCHOR_STAGE: Record<string, Stage> = {
  'add-evidence': 'build',
  'import-slack': 'build',
  'acceptance-gap': 'build',
  'your-account': 'review',
};
// Anchors that should pulse-flag their target after the jump (the gap).
const FLAG_ANCHORS = new Set(['add-evidence', 'acceptance-gap']);

export interface StageDoneState {
  build: boolean; // resolutionPlan === null (no open gap to push on)
  review: boolean; // approved
  file: boolean; // submitted
}

type SpineStatus = 'done' | 'attention' | 'todo' | 'locked';

export interface WorkbenchShellProps {
  defaultStage: Stage;
  doneState: StageDoneState;
  // Honest gentle gate: Approve and file unlocks once Review has been opened.
  // Never a trap — Build and Review stay reachable at all times.
  requireReviewBeforeFile: boolean;
  // Genuinely-missing required items, for the honest "N to add" spine state.
  missingCount: number;
  // Build complete -> the File stage shows its ready lede; otherwise the
  // "guide you back" lede.
  fileReady: boolean;
  header: ReactNode;
  reassurance: ReactNode;
  buildStage: ReactNode;
  reviewStage: ReactNode;
  fileStage: ReactNode;
}

export function WorkbenchShell({
  defaultStage,
  doneState,
  requireReviewBeforeFile,
  missingCount,
  fileReady,
  header,
  reassurance,
  buildStage,
  reviewStage,
  fileStage,
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

  // Honest per-step status, derived from real completion, not from what was
  // visited. "done" requires genuine completion; Approve is never "done" here
  // (only the FileStage body reflects a submitted record).
  const stepStatus = useCallback(
    (st: Stage): SpineStatus => {
      if (st === 'build') {
        if (doneState.build) return 'done';
        return missingCount > 0 ? 'attention' : 'todo';
      }
      if (st === 'review') {
        if (doneState.review) return 'done';
        return doneState.build ? 'todo' : 'locked';
      }
      if (doneState.file) return 'done';
      return fileUnlocked ? 'todo' : 'locked';
    },
    [doneState, missingCount, fileUnlocked],
  );

  const goToStage = useCallback((next: Stage) => {
    if (next === 'review') setHasOpenedReview(true);
    setStage(next);
    setLiveMsg(`Step ${STAGE_ORDER.indexOf(next) + 1} of 3, ${SPINE_NAME[next]}`);
    requestAnimationFrame(() => {
      bodyRefs.current[next]?.focus({ preventScroll: true });
      const section = document.getElementById(`wb-stage-${next}`);
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      section?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  }, []);

  const goToAnchor = useCallback(
    (anchor: string) => {
      const owner = ANCHOR_STAGE[anchor] ?? 'build';
      if (owner === 'review') setHasOpenedReview(true);
      setStage(owner);
      setLiveMsg(`Opened ${SPINE_NAME[owner]} and moved you to the item to resolve.`);
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Double rAF so the owning stage has un-hidden and painted before we open a
      // collapsed <details> target, scroll, focus, and flag it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(anchor);
          if (el instanceof HTMLDetailsElement) el.open = true;
          el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
          // Always move focus to a deterministic target. The link that was clicked
          // often lives in the stage we just hid, so without this keyboard focus
          // drops to <body> (WCAG 2.4.3/2.4.7).
          let focusTarget: HTMLElement | null = null;
          if (el) {
            focusTarget = el.querySelector<HTMLElement>(
              'input, textarea, button, a[href], [tabindex]',
            );
            if (!focusTarget) {
              if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
              focusTarget = el;
            }
          }
          const target = focusTarget ?? bodyRefs.current[owner];
          try {
            target?.focus({ preventScroll: true });
          } catch {
            /* focus is best-effort */
          }
          if (el && FLAG_ANCHORS.has(anchor)) {
            el.classList.remove(styles.flagPulse);
            // restart the cue reliably
            void (el as HTMLElement).offsetWidth;
            el.classList.add(styles.flagPulse);
            window.setTimeout(() => el.classList.remove(styles.flagPulse), reduce ? 2400 : 3400);
          }
        });
      });
    },
    [],
  );

  // Delegate in-page link clicks from server-rendered subtrees. `#stage-*` hops
  // between stages; a known content anchor opens its owner then scrolls/flags.
  // Everything else (e.g. /settings) falls through to the browser.
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
    <div className={styles.root}>
      {header}

      {/* ── Workflow spine: the loud "where you are" ── */}
      <section className={styles.spine} aria-label="Workflow progress">
        <p className={styles.spineLabel}>
          Guided workflow <span aria-hidden="true">·</span>{' '}
          <span className={styles.spinePos}>{`step ${currentIndex + 1} of 3`}</span>{' '}
          <span aria-hidden="true">·</span> <span className={styles.spineFlow}>Build, Review, Approve</span>
        </p>
        <div className={styles.spineTrack}>
          {STAGE_ORDER.map((st, i) => {
            const isCurrent = st === stage;
            const status = stepStatus(st);
            const chip = spineChip(status, isCurrent, missingCount, i === 2);
            const cls = [styles.spineStep, isCurrent ? styles.isActive : chip.cls]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={st} style={{ display: 'contents' }}>
                {i > 0 && (
                  <span
                    className={`${styles.spineConn} ${
                      stepStatus(STAGE_ORDER[i - 1]) === 'done' ? styles.connLit : ''
                    }`}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className={cls}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => {
                    if (st === 'file' && !fileUnlocked) {
                      setLiveMsg('Open Review first, then you can approve and file.');
                      goToStage('review');
                      return;
                    }
                    goToStage(st);
                  }}
                >
                  <span className={styles.stepNum} aria-hidden="true">
                    {status === 'done' && !isCurrent ? <CheckIcon /> : i + 1}
                  </span>
                  <span className={styles.stepTxt} aria-hidden="true">
                    <span className={styles.stepName}>{SPINE_NAME[st]}</span>
                    <span className={styles.stepState}>
                      <chip.Icon className={chip.spin ? styles.spin : undefined} />
                      <span className={styles.stateWord}>{chip.word}</span>
                    </span>
                  </span>
                  <span className="sr-only">
                    {`Step ${i + 1} of 3, ${SPINE_NAME[st]}: ${chip.word}${
                      isCurrent ? ', current step' : ''
                    }`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Stage accordion ── */}
      <div onClickCapture={handleInPageNav}>
        {STAGE_ORDER.map((st, i) => {
          const active = st === stage;
          const status = stepStatus(st);
          const done = status === 'done';
          const locked = st === 'file' && !fileUnlocked;
          const meta = STAGE_META[st];
          const lede =
            st === 'file' && !fileReady && meta.ledeIncomplete ? meta.ledeIncomplete : meta.lede;
          const stageCls = [
            styles.stage,
            active ? styles.stageActive : styles.stageCollapsed,
            !active && done ? styles.stageDone : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <section
              key={st}
              id={`wb-stage-${st}`}
              className={stageCls}
              aria-label={meta.title}
            >
              {active ? (
                <div className={styles.stageHead}>
                  <span className={styles.stageNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.stageHeadtext}>
                    <span className={styles.stageEyebrow}>{meta.eyebrow}</span>
                    <h2 className={styles.stageTitle}>{meta.title}</h2>
                    <span className={styles.stageFor}>{lede}</span>
                  </span>
                  <span className={styles.stageHeadright}>
                    <span className={`${styles.stageBadge} ${styles.badgeNow}`}>
                      <PencilIcon /> <span>Working now</span>
                    </span>
                    <span className={styles.chev} aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.stageHead}
                  aria-expanded={false}
                  aria-controls={`wb-body-${st}`}
                  onClick={() => {
                    if (locked) {
                      setLiveMsg('Open Review first, then you can approve and file.');
                      goToStage('review');
                      return;
                    }
                    goToStage(st);
                  }}
                >
                  <span className={styles.stageNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.stageHeadtext}>
                    <span className={styles.stageEyebrow}>{done ? 'Done' : meta.eyebrow}</span>
                    <span className={styles.stageTitle}>{meta.title}</span>
                    <span className={styles.stageFor}>{locked ? 'Open Review first' : lede}</span>
                  </span>
                  <span className={styles.stageHeadright}>
                    <span
                      className={`${styles.stageBadge} ${
                        done ? styles.badgeDone : styles.badgeNext
                      }`}
                    >
                      {done ? (
                        <>
                          <CheckIcon /> <span>Done</span>
                        </>
                      ) : locked ? (
                        <>
                          <LockIcon /> <span>{`Step ${i + 1}`}</span>
                        </>
                      ) : (
                        <>
                          <ClockIcon /> <span>{`Step ${i + 1}`}</span>
                        </>
                      )}
                    </span>
                    <span className={styles.chev} aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </span>
                </button>
              )}

              <div
                id={`wb-body-${st}`}
                ref={(el) => {
                  bodyRefs.current[st] = el;
                }}
                hidden={!active}
                tabIndex={-1}
                aria-label={meta.title}
                className={styles.stageBody}
              >
                {stageContent[st]}
              </div>
            </section>
          );
        })}
      </div>

      {reassurance}

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}

type ChipIcon = ({ className }: { className?: string }) => React.ReactElement;
type SpineChip = { cls: string; Icon: ChipIcon; word: string; spin?: boolean };

function spineChip(
  status: SpineStatus,
  isCurrent: boolean,
  missingCount: number,
  isLast: boolean,
): SpineChip {
  if (isCurrent) {
    if (status === 'done') return { cls: styles.isActive, Icon: CheckIcon, word: 'Reviewing' };
    if (status === 'attention')
      return { cls: styles.isActive, Icon: AlertIcon, word: `${missingCount} to add` };
    return { cls: styles.isActive, Icon: LoaderIcon, word: 'In progress', spin: true };
  }
  if (status === 'done') return { cls: styles.isDone, Icon: CheckIcon, word: 'Done' };
  if (status === 'attention')
    return { cls: styles.isAttention, Icon: AlertIcon, word: `${missingCount} to add` };
  if (status === 'locked')
    return { cls: styles.isLocked, Icon: LockIcon, word: isLast ? 'Locked' : 'Not yet' };
  return { cls: '', Icon: ClockIcon, word: isLast ? 'Last step' : 'Up next' };
}
