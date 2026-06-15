/**
 * The guidance rule catalogue (Standing Docket build plan §2).
 *
 * Ported and expanded from the dashboard's old inline `buildInsights`. Each rule
 * fires only when its claim is truthfully computed from the merchant's signals
 * (the honesty gate). Higher `weight` ranks first. `fallback` rules only fill the
 * band to its minimum so a calm account is never a blank panel.
 */

import { URGENT_DAYS } from './cadence';
import type { GuidanceRule } from './types';

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

export const GUIDANCE_RULES: GuidanceRule[] = [
  // ── Layer 1 — dashboard band (real-signal rules, ranked by urgency) ─────────
  {
    id: 'connect-stripe',
    layer: 'band',
    target: 'dashboard',
    weight: 100,
    trigger: (s) => !s.hasStripe,
    render: () => ({
      text: 'Connect Stripe to start seeing your disputes and account health.',
      action: 'Connect Stripe',
      actionHref: '/api/stripe/connect/start',
      severity: 'gap',
    }),
  },
  {
    id: 'needs-response',
    layer: 'band',
    target: 'dashboard',
    weight: 90,
    // Urgent only when a deadline is close — a dispute due in weeks can rest;
    // one due within URGENT_DAYS must keep showing until it is answered.
    urgent: (s) => s.nearestDeadlineDays !== null && s.nearestDeadlineDays <= URGENT_DAYS,
    trigger: (s) => s.hasStripe && s.needsActionCount > 0,
    render: (s) => ({
      text: `${s.needsActionCount} dispute${plural(s.needsActionCount)} need${
        s.needsActionCount === 1 ? 's' : ''
      } a response. Review the proof on file before you write.`,
      action: 'Open the nearest deadline',
      actionHref: '/dashboard/disputes?filter=needs-action',
      severity: 'gap',
    }),
  },
  {
    id: 'health-watch',
    layer: 'band',
    target: 'dashboard',
    weight: 80,
    // Urgent only once over the line; "getting close" can rest between renders.
    urgent: (s) => s.healthBand === 'at-risk',
    // Only when the health read is a real, confident number.
    trigger: (s) =>
      s.hasStripe && s.healthConfident && (s.healthBand === 'close' || s.healthBand === 'at-risk'),
    render: (s) => ({
      text:
        s.healthBand === 'at-risk'
          ? "Your dispute rate is over Stripe's 0.75% line. Fight the strongest cases first and act on the nearest deadlines."
          : "Your dispute rate is approaching Stripe's 0.75% line. Winning the strongest cases first protects your headroom.",
      action: 'See account health',
      actionHref: '/account-health',
      severity: 'gap',
    }),
  },
  {
    id: 'efw-prevent',
    layer: 'band',
    target: 'dashboard',
    weight: 70,
    // Early fraud warnings are time-critical (the refund window is short), so
    // the prevention nudge stays until the alerts are actioned.
    urgent: true,
    trigger: (s) => s.actionableEfwCount > 0,
    render: (s) => ({
      text: `You have ${s.actionableEfwCount} early fraud warning${plural(
        s.actionableEfwCount,
      )}. Refunding now may stop a dispute before it counts against your rate.`,
      action: 'Review early fraud warnings',
      actionHref: '/dashboard/disputes',
      severity: 'gap',
    }),
  },
  {
    // The "complete your profile" nudge (moved here from the workbench LOW set):
    // a real-signal rule, not a generic tip — fires only when the profile is thin.
    id: 'complete-profile',
    layer: 'band',
    target: 'dashboard',
    weight: 60,
    trigger: (s) => s.hasStripe && !s.profileComplete,
    render: () => ({
      text: 'Add your business profile so your refund policy and delivery details are ready the moment a dispute lands.',
      action: 'Complete your profile',
      actionHref: '/settings',
      severity: 'neutral',
    }),
    // Nudge a touch harder for the personas whose disputes lean on documented
    // policies/scope. Kept ≤1.1 so the effective weight (≤66) never crosses the
    // w70 efw-prevent spine rule.
    personaWeight: { marcus: 0.9, priya: 1.0, david: 1.1, aisha: 1.0 },
  },

  // ── Layer 1 — band fallbacks (fill to the minimum; never displace the above) ─
  {
    id: 'fallback-watching',
    layer: 'band',
    target: 'dashboard',
    weight: 20,
    fallback: true,
    trigger: (s) => s.hasStripe,
    render: () => ({
      text: 'Verdact is watching your account between disputes. New disputes and early fraud warnings surface here the moment they land.',
      action: 'See what Verdact monitors',
      actionHref: '/account-health',
      severity: 'neutral',
    }),
  },
  {
    id: 'fallback-prep-evidence',
    layer: 'band',
    target: 'dashboard',
    weight: 10,
    fallback: true,
    trigger: (s) => s.hasStripe && s.profileComplete,
    render: () => ({
      text: 'Add your refund policy and delivery confirmation now so they are ready when a dispute lands.',
      action: 'Set up evidence sources',
      actionHref: '/settings',
      severity: 'neutral',
    }),
  },

  // ── Layer 4 — educational primers (pull-only, network-neutral, never pushed) ──
  {
    id: 'primer-account-health',
    layer: 'primer',
    target: 'dashboard',
    weight: 20,
    trigger: () => true,
    render: () => ({
      text: 'How account health works',
      action: "Learn how the 0.75% line is measured",
      actionHref: '/account-health',
      severity: 'neutral',
    }),
    // Primers rank only among themselves (their own layer), so persona weighting
    // here is spine-safe. VAMP-anxious personas see the health primer first.
    personaWeight: { priya: 1.3, aisha: 1.3 },
  },
  {
    id: 'primer-rc-131',
    layer: 'primer',
    target: 'dashboard',
    weight: 10,
    trigger: (s) => s.hasStripe,
    render: () => ({
      text: 'Reason code 13.1 is the most common dispute type for service merchants.',
      action: 'See how scope and delivery proof apply',
      actionHref: '/account-health',
      severity: 'neutral',
    }),
    // Service-delivery personas see the 13.1 primer first.
    personaWeight: { marcus: 1.3, david: 1.3, priya: 1.2 },
  },
  {
    // Gentle, pull-only re-prompt to set persona (ask-only; never inferred).
    // Shows quietly while persona is unknown and disappears once it is set.
    id: 'primer-set-persona',
    layer: 'primer',
    target: 'dashboard',
    weight: 5,
    trigger: (s) => s.hasStripe && !s.personaKnown,
    render: () => ({
      text: 'Tailor these tips to your business',
      action: 'Set your business type in Settings',
      actionHref: '/settings?tab=business',
      severity: 'neutral',
    }),
  },
];
