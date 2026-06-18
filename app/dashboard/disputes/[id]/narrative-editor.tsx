'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveNarrativeAction } from './actions';
import { AlertIcon, CheckIcon } from '../../dash-icons';
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

export function NarrativeEditor({
  disputeId,
  initialNarrative,
}: {
  disputeId: string;
  initialNarrative: string;
}) {
  const [value, setValue] = useState(initialNarrative);
  const [state, setState] = useState<SaveState>('idle');
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
        <SaveBadge state={state} />
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
