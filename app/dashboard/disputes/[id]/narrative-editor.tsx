'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveNarrativeAction, generateNarrativeAction } from './actions';
import { AlertIcon, CheckIcon, PencilIcon, LoaderIcon } from '../../dash-icons';
import styles from './workbench.module.css';

/**
 * The merchant's own account of what happened, persisted to
 * disputes.evidence_draft (JSONB) via saveNarrativeAction. Debounced autosave
 * (1.5s) plus an immediate save on blur — the locked auto-save pattern. The
 * translation / QA panels react to this on the next refresh.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 1500;
const MAX_NARRATIVE_CHARS = 20_000;

// Below this length the AI draft button is offered; above it we assume the
// merchant has substantive text and never silently overwrite their work.
const AI_OVERWRITE_GUARD_CHARS = 500;

export function NarrativeEditor({
  disputeId,
  initialNarrative,
  aiEnabled = false,
}: {
  disputeId: string;
  initialNarrative: string;
  /** When true, offer the AI-draft button (server gates on VERDACT_AI_NARRATIVE_ENABLED). */
  aiEnabled?: boolean;
}) {
  const [value, setValue] = useState(initialNarrative);
  const [state, setState] = useState<SaveState>('idle');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDrafted, setAiDrafted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialNarrative);

  const save = useCallback(
    async (text: string) => {
      if (text === lastSaved.current) return;
      setState('saving');
      const res = await saveNarrativeAction({ disputeId, narrative: text });
      if (res.ok) {
        lastSaved.current = text;
        setState('saved');
      } else {
        setState('error');
      }
    },
    [disputeId],
  );

  const scheduleSave = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(text), DEBOUNCE_MS);
    },
    [save],
  );

  // Generate an AI draft and drop it into the textarea for review. We do NOT
  // auto-save it — the merchant edits, and the existing autosave persists their
  // version. So the AI text never enters a packet without the merchant's own save.
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setAiError(null);
    try {
      const res = await generateNarrativeAction({ disputeId });
      if (res.ok && res.text) {
        setValue(res.text);
        setAiDrafted(true);
        setState('idle');
      } else {
        setAiError(res.error ?? 'Could not draft right now. Please write in your own words.');
      }
    } finally {
      setGenerating(false);
    }
  }, [disputeId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>Your account of what happened</p>
          <p className={`${styles.labelMono} mt-1.5`}>
            In your words. We restate it in bank language for the packet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {aiEnabled ? (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || value.length > AI_OVERWRITE_GUARD_CHARS}
              title={
                value.length > AI_OVERWRITE_GUARD_CHARS
                  ? 'Clear your draft first to start one with AI.'
                  : 'Draft a first version with AI, then edit it to make it yours.'
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-action/60 disabled:opacity-50 disabled:hover:border-rule-strong"
            >
              {generating ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  Drafting…
                </>
              ) : (
                <>
                  <PencilIcon className="h-3.5 w-3.5" />
                  Draft with AI
                </>
              )}
            </button>
          ) : null}
          <SaveBadge state={state} />
        </div>
      </header>
      <div className="px-6 py-5">
        <textarea
          className="min-h-[180px] w-full resize-y rounded-md border border-rule-strong bg-surface px-4 py-3 text-sm leading-6 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
          placeholder="What did the customer buy, what did you deliver, and when did they accept or use it? Plain language is fine."
          value={value}
          maxLength={MAX_NARRATIVE_CHARS}
          onChange={(e) => {
            setValue(e.target.value);
            setState('idle');
            scheduleSave(e.target.value);
          }}
          onBlur={() => {
            if (timer.current) clearTimeout(timer.current);
            void save(value);
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-ink-mute">
          <span>Saved automatically as you type.</span>
          <span>
            {value.length.toLocaleString()} / {MAX_NARRATIVE_CHARS.toLocaleString()}
          </span>
        </div>
        {aiDrafted && !aiError ? (
          <p className="mt-2 text-xs text-ink-mute">
            This is an AI-assisted first draft built from your dispute details.
            Read it, fix anything that is off, and make it yours — your edits are
            what get saved.
          </p>
        ) : null}
        {aiError ? (
          <p className={`${styles.pillGap} mt-2 inline-flex`} role="status">
            <AlertIcon className="h-3 w-3" />
            {aiError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className={styles.pillNeutral}>Saving</span>;
  if (state === 'saved')
    return (
      <span className={styles.pillVerdict}>
        <CheckIcon className="h-3 w-3" />
        Saved
      </span>
    );
  if (state === 'error')
    return (
      <span className={styles.pillGap}>
        <AlertIcon className="h-3 w-3" />
        Could not save
      </span>
    );
  return null;
}
