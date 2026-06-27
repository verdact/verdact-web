import type { ReactNode } from 'react';
import styles from './reassure-card.module.css';

/**
 * ReassureCard — the shared reassurance tile, ported from the workbench
 * `.reCard`. An icon tile + title + short body that lowers anxiety around a
 * surface (e.g. "Nothing is filed without your say-so"). Server-safe,
 * theme-aware, no motion.
 *
 * tone="verdict" (default) for safe/forward reassurance; tone="watch" for calm
 * monitoring copy. Never vermilion — reassurance is never an alarm.
 */
export type ReassureTone = 'verdict' | 'watch';

export interface ReassureCardProps {
  /** A 24px icon node (dash-icons), decorative. */
  icon: ReactNode;
  title: string;
  tone?: ReassureTone;
  children: ReactNode;
  className?: string;
}

export function ReassureCard({
  icon,
  title,
  tone = 'verdict',
  children,
  className,
}: ReassureCardProps) {
  const iconClass =
    tone === 'watch'
      ? `${styles.icon} ${styles.iconWatch}`
      : `${styles.icon} ${styles.iconVerdict}`;

  return (
    <div className={className ? `${styles.card} ${className}` : styles.card}>
      <span className={iconClass} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        <p className={styles.body}>{children}</p>
      </div>
    </div>
  );
}
