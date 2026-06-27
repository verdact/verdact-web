/**
 * Dashboard guidance signals — the single source of truth for turning the
 * merchant's fetched data into GuidanceSignals, shared by the server wrapper
 * (page.tsx, which runs the engine + cadence) and the presentational view
 * (which still derives its own render structures). Keeping the math here stops
 * the two from drifting.
 *
 * Pure: no DB, no side effects.
 */

import type { Dispute, EfwAlert } from '@/lib/dal';
import type { GuidanceSignals, HealthBand } from '@/lib/guidance';

// Stripe's operative dispute-rate line; the gauge runs to 1.5% (network ceiling).
export const STRIPE_LINE_FRACTION = 0.0075;
export const GAUGE_MAX_FRACTION = 0.015;

// Open = still actionable on the dashboard docket (excludes submitted/closed).
export const OPEN_STATUSES = new Set(['needs_response', 'under_review']);

// "Needs you now" = a dispute the merchant still has to respond to. under_review
// is filed-and-waiting on the issuer (the comp's "Filed, waiting" strip), so it
// does NOT count toward the attention trigger; only needs_response does.
export const NEEDS_ATTENTION_STATUSES = new Set(['needs_response']);

export function bandFor(ratio: number | null): HealthBand {
  if (ratio === null) return 'unknown';
  if (ratio < 0.005) return 'healthy';
  if (ratio < STRIPE_LINE_FRACTION) return 'close';
  return 'at-risk';
}

export function daysUntil(dueBy: string): number {
  const now = new Date();
  const due = new Date(dueBy);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Deadline pressure tiers (redesign 2026-06-27). Drives the calm de-alarm law:
// only an urgent/over-deadline deadline earns vermilion (--gap); everything
// comfortable or merely "soon" stays neutral/watch. Surfaces map the tier to a
// StatusBadge tone — they never re-derive these thresholds.
export const SOON_DAYS = 7;

export type DeadlineTier = 'none' | 'comfortable' | 'soon' | 'urgent';

export function deadlineTier(daysLeft: number | null): DeadlineTier {
  if (daysLeft === null) return 'none';
  if (daysLeft <= 2) return 'urgent';
  if (daysLeft <= SOON_DAYS) return 'soon';
  return 'comfortable';
}

export function byDeadlineThenCreated(a: Dispute, b: Dispute): number {
  if (a.due_by && b.due_by) return new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
  if (a.due_by) return -1;
  if (b.due_by) return 1;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * The adaptive-dashboard trigger (redesign plan §2.2). Counts only the work that
 * genuinely needs the merchant right now:
 *   - disputes in "Needs response" (open, not yet filed) PLUS
 *   - any open early-fraud-warning that is actionable and still pending a decision.
 * Filed-and-waiting (under_review / submitted) and resolved cases do NOT count, so
 * a filed case never drags the page back into the dispute-led MODE B.
 *   needsAttentionCount === 0 → MODE A (health-hero, vermilion-free)
 *   needsAttentionCount >= 1  → MODE B (dispute-hero)
 */
export function deriveNeedsAttentionCount(
  disputes: Dispute[],
  efwAlerts: EfwAlert[],
): number {
  const disputesNeedingResponse = disputes.filter((d) =>
    NEEDS_ATTENTION_STATUSES.has(d.status),
  ).length;
  const openEfw = efwAlerts.filter(
    (e) => e.actionable === true && e.merchant_decision === 'pending',
  ).length;
  return disputesNeedingResponse + openEfw;
}

// Minutes-since-sync → the freshness stamp copy ("Synced from Stripe N min ago").
// connected_at is the last successful sync we can honestly cite without inventing
// a separate sync timestamp; null connection → null (caller shows nothing).
export function freshnessLabel(connectedAt: string | null | undefined): string | null {
  if (!connectedAt) return null;
  const then = new Date(connectedAt).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface DashboardSignalInput {
  hasStripe: boolean;
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  vampRatio: number | null;
  vampConfidence: 'low' | 'medium' | 'high' | null;
  profileComplete: boolean;
  personaKnown: boolean;
}

export function deriveGuidanceSignals(input: DashboardSignalInput): GuidanceSignals {
  const openDisputes = input.disputes.filter((d) => OPEN_STATUSES.has(d.status));
  const needsActionCount = input.disputes.filter((d) => d.status === 'needs_response').length;
  const nearestWithDeadline = openDisputes
    .filter((d) => d.due_by)
    .sort(byDeadlineThenCreated)[0];
  const nearestDeadlineDays = nearestWithDeadline?.due_by
    ? daysUntil(nearestWithDeadline.due_by)
    : null;
  const actionableEfwCount = input.efwAlerts.filter(
    (e) => e.actionable === true && e.merchant_decision === 'pending',
  ).length;

  return {
    hasStripe: input.hasStripe,
    openDisputeCount: openDisputes.length,
    needsActionCount,
    healthBand: bandFor(input.vampRatio),
    healthConfident: input.vampConfidence === 'medium' || input.vampConfidence === 'high',
    actionableEfwCount,
    profileComplete: input.profileComplete,
    nearestDeadlineDays,
    personaKnown: input.personaKnown,
  };
}
