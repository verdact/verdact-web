import type { ReactNode } from 'react';
import type { GatedAction } from '@/lib/entitlements/actions';
import { ACTION_LABELS } from '@/lib/entitlements/actions';
import styles from './paid-gate.module.css';

/**
 * Presentational gate for a Paid action (entitlements A1).
 *
 * Container/presentational split: a server component resolves the entitlement
 * via `can(user, action)` and passes the boolean `allowed` down. This component
 * renders the real action when allowed, or a Paid affordance (beta-framed, never
 * a price) plus the watermarked-preview note when gated. It contains no
 * server imports and reads no state — pure props in, UI out.
 *
 * The watermarked-preview concept: on Free (post-beta), the merchant can still
 * SEE the packet as a visible, non-submission-ready preview. The gate copy makes
 * that explicit so it never reads as a blank paywall-tease.
 */
export interface PaidGateProps {
  action: GatedAction;
  allowed: boolean;
  // The real action UI (e.g. a submit/download button). Rendered when allowed.
  children: ReactNode;
  // Optional override for the gated headline; defaults to the action label.
  gatedLabel?: string;
  // When true, show the "you can still preview a watermarked copy" line.
  previewAvailable?: boolean;
}

export function PaidGate({
  action,
  allowed,
  children,
  gatedLabel,
  previewAvailable = true,
}: PaidGateProps) {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className={styles.gate} role="group" aria-label="Paid feature">
      <p className={styles.label}>{gatedLabel ?? ACTION_LABELS[action]}</p>
      <p className={styles.note}>
        This is on the paid plan. During the beta it is open to every merchant at
        no charge.
      </p>
      {previewAvailable && (
        <p className={styles.preview}>
          You can still preview a watermarked copy of the packet for free.
        </p>
      )}
    </div>
  );
}
