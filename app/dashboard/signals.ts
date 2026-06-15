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

export function byDeadlineThenCreated(a: Dispute, b: Dispute): number {
  if (a.due_by && b.due_by) return new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
  if (a.due_by) return -1;
  if (b.due_by) return 1;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
