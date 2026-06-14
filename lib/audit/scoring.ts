/**
 * Audit scoring brain.
 *
 * Given merchant-supplied disputes + settled card volume, deterministically
 * computes:
 *   (a) a dispute-rate read vs Stripe's 0.75% action line (the operative line
 *       for the ICP), reusing the vamp-snapshots / VampChecker constants and
 *       the same math, and
 *   (b) a per-dispute winnability read (see reason-codes.ts), flagging the
 *       comms-grounded 13.1 / subscription cases that "should have won".
 *
 * UNIT DISCIPLINE (critical): the dispute rate is computed as a FRACTION first
 * (numerator / settled) and only multiplied by 100 for display. The gauge marker
 * and bands all derive from the percent value. Never mix fraction and percent.
 */

import type {
  AuditDispute,
  AuditScore,
  AuditWindowInput,
  DisputeRateRead,
  ScoredDispute,
  StandingBand,
} from './types';
import { getReasonProfile, scoreWinnability } from './reason-codes';

// ─── Thresholds (mirrors VampChecker.tsx + vamp-snapshots.ts) ────────────────
export const SCORE_FLOOR = 50; // settled charges below which one event is noise
export const HEALTHY_MAX = 0.65; // percent — under this is normal
export const STRIPE_LINE = 0.75; // percent — Stripe acts here
export const GAUGE_MAX = 1.5; // percent — gauge right edge = Visa excessive

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Compute the dispute-rate read. `numerator` = disputes + fraud events counted
 * the way networks measure (every dispute counts, even ones later won).
 */
export function scoreDisputeRate(
  numerator: number,
  window: AuditWindowInput,
): DisputeRateRead {
  const settled = window.settledTransactionCount;

  const base: DisputeRateRead = {
    band: 'unknown',
    ratioPercent: null,
    numerator,
    settledTransactionCount: settled,
    bufferEvents: null,
    markerPercent: null,
    belowScoreFloor: settled < SCORE_FLOOR,
  };

  if (settled <= 0 || numerator < 0 || numerator > settled) {
    return base;
  }

  // FRACTION first, then percent for display.
  const fraction = numerator / settled;
  const ratioPercent = fraction * 100;

  // Headroom: how many more events before crossing the 0.75% line at this volume.
  const bufferEvents = Math.floor(settled * (STRIPE_LINE / 100)) - numerator;
  const markerPercent = clamp((ratioPercent / GAUGE_MAX) * 100, 1.5, 98.5);

  let band: StandingBand;
  if (settled < SCORE_FLOOR) band = 'tooEarly';
  else if (ratioPercent < HEALTHY_MAX) band = 'healthy';
  else if (ratioPercent < STRIPE_LINE) band = 'close';
  else band = 'atRisk';

  return {
    band,
    ratioPercent,
    numerator,
    settledTransactionCount: settled,
    bufferEvents,
    markerPercent,
    belowScoreFloor: settled < SCORE_FLOOR,
  };
}

/**
 * Score a single dispute: attach winnability tier, evidence locus, the
 * plain-English "why", and the should-have-won flag.
 */
export function scoreDispute(dispute: AuditDispute): ScoredDispute {
  const profile = getReasonProfile(dispute.reasonCode);
  const { tier, commsHinged } = scoreWinnability(dispute.reasonCode, dispute.proof);

  const shouldHaveWon =
    dispute.outcome === 'lost' && (tier === 'strong' || tier === 'moderate');

  return {
    ...dispute,
    tier,
    evidenceLocus: profile.evidenceLocus,
    networkLabel: profile.networkLabel,
    shortReason: profile.shortReason,
    commsHinged,
    why: buildWhy(dispute, tier, commsHinged),
    shouldHaveWon,
  };
}

function buildWhy(
  dispute: AuditDispute,
  tier: ScoredDispute['tier'],
  commsHinged: boolean,
): string {
  const profile = getReasonProfile(dispute.reasonCode);
  const hasComms = dispute.proof.comms;
  const hasDelivery = dispute.proof.delivery;
  const hasUsage = dispute.proof.usage;

  if (commsHinged && (hasComms || hasDelivery)) {
    return `${profile.networkLabel} hinges on showing the customer received and engaged with what they paid for. You said you have ${[
      hasComms ? 'email or Slack threads' : null,
      hasDelivery ? 'delivery proof' : null,
      hasUsage ? 'usage logs' : null,
    ]
      .filter(Boolean)
      .join(' and ')} — the evidence Stripe-native tools cannot reach. That is the proof profile that typically wins this code.`;
  }

  if (profile.isCommsWedge && !hasComms && !hasDelivery) {
    return `${profile.networkLabel} is usually winnable, but the deciding proof lives in your email, Slack, and delivery logs. You did not flag any of that here, so the read is cautious until that evidence is attached.`;
  }

  if (profile.evidenceLocus === 'transactional') {
    return `${profile.networkLabel} is decided mostly on payment and device data rather than your communications. ${
      dispute.reasonCode === 'fraudulent'
        ? 'Compelling Evidence 3.0 (Visa 10.4 only) can sometimes clear it, which Stripe evaluates automatically.'
        : 'Transactional records carry this one.'
    }`;
  }

  if (tier === 'weak' || tier === 'unlikely') {
    return `${profile.networkLabel} rarely wins on representment. Often the better move is to refund and protect the ratio rather than fight.`;
  }

  return `${profile.networkLabel}: winnability depends on the strength of your delivery and communication records.`;
}

/**
 * Full audit score: dispute-rate read + per-dispute scoring + roll-up summary.
 */
export function computeAuditScore(
  disputes: AuditDispute[],
  window: AuditWindowInput,
): AuditScore {
  const scored = disputes.map(scoreDispute);
  const rate = scoreDisputeRate(disputes.length, window);

  const lost = scored.filter((d) => d.outcome === 'lost');
  const shouldHaveWon = scored.filter((d) => d.shouldHaveWon);
  const commsHinged = scored.filter((d) => d.commsHinged);
  const strong = scored.filter((d) => d.tier === 'strong');

  const currency = firstCurrency(disputes);
  const recoverableAmount = shouldHaveWon.reduce(
    (sum, d) => sum + (d.amount && d.amount > 0 ? d.amount : 0),
    0,
  );

  return {
    rate,
    disputes: scored,
    summary: {
      totalDisputes: scored.length,
      lostDisputes: lost.length,
      shouldHaveWonCount: shouldHaveWon.length,
      commsHingedCount: commsHinged.length,
      strongCount: strong.length,
      recoverableAmount,
      currency,
    },
  };
}

function firstCurrency(disputes: AuditDispute[]): string | null {
  for (const d of disputes) {
    if (d.currency) return d.currency;
  }
  return null;
}
