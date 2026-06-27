import type { ReactNode } from 'react';
import styles from './status-badge.module.css';

/**
 * StatusBadge — the single, shared enforcement point for the two-color
 * de-alarm law. Every status chip in the app routes through here.
 *
 * Tone selects the token set (see status-badge.module.css). Status is ALWAYS
 * icon + text: pass the matching dash-icon so colour is never the only signal.
 * The chip is decorative-icon + literal-text, so it stays legible to screen
 * readers and in high-contrast.
 *
 * Tone guidance:
 *   done    — completed / safe / forward motion (verdict green)
 *   watch   — calm monitoring, "we're tracking it", your-call, under-review
 *   gap     — a genuinely-missing, merchant-closable blocker, or truly urgent
 *   warning — amber caution that is not a hard blocker
 *   neutral — informational, no state pressure
 *
 * Reserve `gap` (vermilion). If you reach for it for "waiting on the issuer" or
 * "monitoring", use `watch` instead.
 */
export type StatusTone = 'done' | 'watch' | 'gap' | 'warning' | 'neutral';

export interface StatusBadgeProps {
  tone: StatusTone;
  /** A 16px icon node (dash-icons), paired with the text. Always supply one. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<StatusTone, string> = {
  done: styles.done,
  watch: styles.watch,
  gap: styles.gap,
  warning: styles.warning,
  neutral: styles.neutral,
};

export function StatusBadge({ tone, icon, children, className }: StatusBadgeProps) {
  const classes = [styles.badge, TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {icon}
      <span>{children}</span>
    </span>
  );
}
