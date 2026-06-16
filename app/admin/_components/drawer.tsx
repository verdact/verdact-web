'use client';

import { useEffect, useRef } from 'react';
import s from '../admin.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Master-detail Drawer — the signature interaction of the operating console.
// Clicking any number, row, or worklist item opens a right-side panel with the
// records (who), the trigger (why), and the next action (what-next). Not a modal:
// it slides in from the right, dims the rest, traps focus, closes on Esc /
// backdrop / close button, and restores focus to the trigger on close.
// ─────────────────────────────────────────────────────────────────────────────

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 'standard',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'standard' | 'wide';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Move focus into the panel (close button) once it opens.
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={s.drawerRoot} role="presentation">
      <button
        type="button"
        className={s.drawerBackdrop}
        aria-label="Close panel"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={`${s.drawer} ${width === 'wide' ? s.drawerWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={s.drawerHead}>
          <div className={s.drawerHeadText}>
            {eyebrow ? <p className={s.drawerEyebrow}>{eyebrow}</p> : null}
            <h2 className={s.drawerTitle}>{title}</h2>
          </div>
          <button type="button" className={s.drawerClose} onClick={onClose} aria-label="Close panel">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </header>
        <div className={s.drawerBody}>{children}</div>
        {footer ? <footer className={s.drawerFoot}>{footer}</footer> : null}
      </div>
    </div>
  );
}

// ── Drawer content primitives (shared by every surface's detail panel) ───────

export function DrawerSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className={s.drawerSection}>
      {title ? <p className={s.drawerSectionTitle}>{title}</p> : null}
      {children}
    </section>
  );
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.detailRow}>
      <span className={s.detailLabel}>{label}</span>
      <span className={s.detailValue}>{children}</span>
    </div>
  );
}

/** A "why now" callout — the trigger that makes this record worth acting on. */
export function WhyNow({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'verdict' | 'gap' | 'neutral' }) {
  const toneClass = tone === 'verdict' ? s.whyNowVerdict : tone === 'gap' ? s.whyNowGap : '';
  return <div className={`${s.whyNow} ${toneClass}`}>{children}</div>;
}
