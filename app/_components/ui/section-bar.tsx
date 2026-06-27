import type { ReactNode } from 'react';
import styles from './section-bar.module.css';

/**
 * SectionBar — the shared section-caption divider for app surfaces.
 *
 * Ports the workbench `.sectionBar` treatment (icon tile in verdict-tint + mono
 * uppercase eyebrow + one-line note) so every surface uses the same hierarchy
 * device. Server-safe: pure props in, markup out, no client state.
 *
 * The icon is decorative (aria-hidden via the dash-icons set) and the title
 * carries the meaning, so this stays accessible by text alone.
 */
export interface SectionBarProps {
  /** A 24px icon node, e.g. <ListIcon className={...} /> from dash-icons. */
  icon: ReactNode;
  /** Mono uppercase eyebrow label (the section name). */
  title: string;
  /** Optional one-line plain-English note under the title. */
  note?: string;
  className?: string;
}

export function SectionBar({ icon, title, note, className }: SectionBarProps) {
  return (
    <div className={className ? `${styles.bar} ${className}` : styles.bar}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {note ? <span className={styles.note}>{note}</span> : null}
      </span>
    </div>
  );
}
