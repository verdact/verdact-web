'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { getGlossaryEntry } from '@/lib/glossary';
import styles from './glossary-term.module.css';

/**
 * GlossaryTerm — renders a plain-English label plus a small "?" button that
 * toggles a focusable, ESC-closable popover with the term's definition. Keeps
 * jargon behind progressive disclosure (CLAUDE-mandated "plain English first").
 *
 * 'use client' for the open/close interaction. Accessibility:
 *   - the trigger is a real <button> with aria-expanded + aria-controls;
 *   - Escape closes and returns focus to the trigger;
 *   - a click outside closes;
 *   - the popover content is plain text from lib/glossary.ts (S41-safe).
 *
 * Unknown term ids degrade gracefully to just the literal label (or the id).
 */
export interface GlossaryTermProps {
  /** A key in lib/glossary.ts (e.g. "vamp", "ce3", "chargeback"). */
  term: string;
  /** Optional override for the inline label; defaults to the entry label. */
  children?: string;
  className?: string;
}

export function GlossaryTerm({ term, children, className }: GlossaryTermProps) {
  const entry = getGlossaryEntry(term);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Stop here so a single Escape closes only this inline definition, not an
        // enclosing native <dialog> opened via showModal().
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const label = children ?? entry?.label ?? term;

  // No definition on file: render the label plainly, no affordance.
  if (!entry) {
    return <span className={className}>{label}</span>;
  }

  return (
    <span
      ref={wrapRef}
      className={className ? `${styles.wrap} ${className}` : styles.wrap}
    >
      <span className={styles.label}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`What is ${entry.label}?`}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span id={popoverId} role="tooltip" className={styles.popover}>
          <span className={styles.popoverTitle}>{entry.label}</span>
          <span className={styles.popoverBody}>{entry.definition}</span>
        </span>
      )}
    </span>
  );
}
