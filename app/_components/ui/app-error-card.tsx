'use client';

import type { ReactNode } from 'react';
import { AlertIcon, LoaderIcon } from '@/app/dashboard/dash-icons';
import styles from './app-error-card.module.css';

/**
 * AppErrorCard — the shared calm error surface for app route `error.tsx` files.
 *
 * 'use client' because Next.js error boundaries hand down a `reset()` callback
 * that the page wires to `onPrimary` (e.g. "Try again"). The card stays calm by
 * design: a neutral icon tile (an error is a snag, not a vermilion gap), a
 * display headline, a plain-English body, an optional verdict primary button,
 * and an optional ghost secondary link. Status is icon + text; theme-aware;
 * reduced-motion-safe.
 */
export interface AppErrorCardProps {
  /** Optional mono eyebrow above the title. Defaults to "SOMETHING WENT WRONG". */
  eyebrow?: string;
  title: string;
  body: ReactNode;
  /** Label for the primary action button. Renders only when onPrimary is set. */
  primaryLabel?: string;
  /** Primary action (typically the Next.js error-boundary reset()). */
  onPrimary?: () => void;
  /** Optional ghost secondary link (e.g. back to the dashboard). */
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
}

export function AppErrorCard({
  eyebrow = 'Something went wrong',
  title,
  body,
  primaryLabel = 'Try again',
  onPrimary,
  secondaryHref,
  secondaryLabel,
  className,
}: AppErrorCardProps) {
  const hasPrimary = typeof onPrimary === 'function';
  const hasSecondary = Boolean(secondaryHref && secondaryLabel);

  return (
    <div
      className={className ? `${styles.card} ${className}` : styles.card}
      role="alert"
    >
      <span className={styles.iconTile} aria-hidden="true">
        <AlertIcon />
      </span>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.body}>{body}</p>

      {(hasPrimary || hasSecondary) && (
        <div className={styles.actions}>
          {hasPrimary && (
            <button type="button" className={styles.primary} onClick={onPrimary}>
              <LoaderIcon aria-hidden="true" />
              {primaryLabel}
            </button>
          )}
          {hasSecondary && (
            <a href={secondaryHref} className={styles.secondary}>
              {secondaryLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
