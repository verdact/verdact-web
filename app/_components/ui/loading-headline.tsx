import styles from './loading-headline.module.css';

/**
 * LoadingHeadline — a calm, on-brand header for skeleton loading states.
 *
 * Renders a mono eyebrow over a Schibsted Grotesk display title in the
 * workbench voice, so a loading screen still feels like the product. Pair it
 * above the existing `.skel` shimmer bars (globals.css) for the body. Pure
 * server-safe markup, theme-aware via tokens, no motion of its own.
 */
export interface LoadingHeadlineProps {
  /** Optional mono uppercase eyebrow above the title. */
  eyebrow?: string;
  title: string;
  className?: string;
}

export function LoadingHeadline({ eyebrow, title, className }: LoadingHeadlineProps) {
  return (
    <div
      className={className ? `${styles.head} ${className}` : styles.head}
      aria-busy="true"
    >
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <p className={styles.title}>{title}</p>
    </div>
  );
}
