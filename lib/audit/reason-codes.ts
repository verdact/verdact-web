/**
 * Reason-code winnability rubric — the documented, deterministic source of truth
 * for the audit scoring brain.
 *
 * DESIGN PRINCIPLES (kept honest per the strategy doc):
 *  - This is a RUBRIC, not a guarantee. A "strong" tier means "this dispute has
 *    the proof profile that TYPICALLY wins on representment", never "you will win".
 *  - Mappings are sourced from 05_AI_Extracted/00_MASTER_INDEX.md (Stripe dispute
 *    category -> network reason code) and the locked positioning: comms-grounded
 *    13.1 / subscription-cancellation cases are the Verdact wedge.
 *  - CE 3.0 applies ONLY to Visa 10.4 card-absent fraud, NEVER to 13.1 (hard lock,
 *    PROJECT_STATE.md). The rubric reflects this — fraud winnability hinges on
 *    transactional/device evidence, service disputes hinge on comms+delivery.
 *
 * "evidenceLocus" answers: where does the WINNING proof for this code live?
 *   - 'comms'         -> email/Slack threads + delivery/usage logs (the wedge)
 *   - 'transactional' -> payment/device/AVS data Stripe already holds
 *   - 'mixed'         -> both matter
 *   - 'none'          -> rarely defensible regardless of evidence
 */

import type { EvidenceLocus, ProofKind, ReasonCode, WinnabilityTier } from './types';

interface ReasonCodeProfile {
  /** Canonical short label shown to merchants, e.g. "Services not received". */
  shortReason: string;
  /** Network reason-code label, e.g. "Visa 13.1". */
  networkLabel: string;
  /** Where the winning proof typically lives. */
  evidenceLocus: EvidenceLocus;
  /**
   * Base winnability when the merchant holds the RIGHT proof for this code.
   * This is the ceiling; missing proof downgrades it (see scoreWinnability).
   */
  baseTier: WinnabilityTier;
  /**
   * The proof kinds that materially move this code's winnability. For service
   * codes these are delivery/usage/comms; for fraud, comms is weak (the win
   * comes from CE 3.0 transactional matching Stripe runs, not merchant chat).
   */
  liftingProof: ProofKind[];
  /** True for the comms-grounded service-delivery codes that are the wedge. */
  isCommsWedge: boolean;
}

// ─── The rubric table ────────────────────────────────────────────────────────
// Stripe category -> profile. Source: 00_MASTER_INDEX.md §"Dispute Categories".
const PROFILES: Record<ReasonCode, ReasonCodeProfile> = {
  // Visa 13.1 — the core service-delivery code. Email/Slack delivery proof wins.
  product_not_received: {
    shortReason: 'Services not received',
    networkLabel: 'Visa 13.1',
    evidenceLocus: 'comms',
    baseTier: 'strong',
    liftingProof: ['delivery', 'usage', 'comms'],
    isCommsWedge: true,
  },
  // Visa 13.2 — cancelled / "forgot to cancel" subscription. Comms + usage logs.
  subscription_canceled: {
    shortReason: 'Subscription cancelled',
    networkLabel: 'Visa 13.2',
    evidenceLocus: 'comms',
    baseTier: 'strong',
    liftingProof: ['comms', 'usage', 'delivery'],
    isCommsWedge: true,
  },
  // Visa 13.3 — "not as described". Delivery + comms showing what was agreed.
  product_unacceptable: {
    shortReason: 'Not as described',
    networkLabel: 'Visa 13.3',
    evidenceLocus: 'mixed',
    baseTier: 'moderate',
    liftingProof: ['delivery', 'comms'],
    isCommsWedge: true,
  },
  // Visa 10.4 — card-absent fraud. Wins via CE 3.0 transactional matching, which
  // Stripe runs automatically. Merchant comms barely move this. Honest: moderate
  // ceiling, transactional locus, comms is NOT a lifting proof here.
  fraudulent: {
    shortReason: 'Fraudulent',
    networkLabel: 'Visa 10.4',
    evidenceLocus: 'transactional',
    baseTier: 'moderate',
    liftingProof: ['usage'],
    isCommsWedge: false,
  },
  // Visa 13.6 — credit not processed. Winnable only if a refund genuinely was not
  // owed; usually the merchant should just refund. Weak on representment.
  credit_not_processed: {
    shortReason: 'Credit not processed',
    networkLabel: 'Visa 13.6',
    evidenceLocus: 'mixed',
    baseTier: 'weak',
    liftingProof: ['comms'],
    isCommsWedge: false,
  },
  // Visa 12.6 — duplicate processing. Wins on transactional proof the two
  // charges were distinct; comms rarely relevant.
  duplicate: {
    shortReason: 'Duplicate charge',
    networkLabel: 'Visa 12.6',
    evidenceLocus: 'transactional',
    baseTier: 'moderate',
    liftingProof: ['delivery'],
    isCommsWedge: false,
  },
  // "I don't recognize this" — often resolves with a clear descriptor + receipt.
  // Comms/receipt help, but banks treat many of these as friendly fraud.
  unrecognized: {
    shortReason: 'Unrecognized charge',
    networkLabel: 'Visa 13.x / MC 4853',
    evidenceLocus: 'mixed',
    baseTier: 'moderate',
    liftingProof: ['comms', 'delivery'],
    isCommsWedge: true,
  },
  // Generic / uncategorized network dispute.
  general: {
    shortReason: 'General dispute',
    networkLabel: 'Network dispute',
    evidenceLocus: 'mixed',
    baseTier: 'moderate',
    liftingProof: ['delivery', 'comms'],
    isCommsWedge: false,
  },
  // Manual entry with no recognizable code.
  other: {
    shortReason: 'Other / not specified',
    networkLabel: 'Reason not specified',
    evidenceLocus: 'none',
    baseTier: 'weak',
    liftingProof: ['delivery', 'comms'],
    isCommsWedge: false,
  },
};

export function getReasonProfile(code: ReasonCode): ReasonCodeProfile {
  return PROFILES[code] ?? PROFILES.other;
}

/**
 * Normalize an untrusted reason string (Stripe export value, network code, or
 * free-text manual entry) into a canonical ReasonCode. Never throws.
 */
export function normalizeReasonCode(raw: string | null | undefined): ReasonCode {
  if (!raw) return 'other';
  const v = raw.toLowerCase().trim();

  // Direct Stripe enum matches first.
  if (v === 'product_not_received' || v === 'product_unacceptable' || v === 'fraudulent' ||
      v === 'subscription_canceled' || v === 'credit_not_processed' || v === 'duplicate' ||
      v === 'unrecognized' || v === 'general') {
    return v as ReasonCode;
  }

  // Network codes (Visa/MC/Amex) and common human phrasings.
  if (/\b13\.1\b|not received|not delivered|services not rendered|product not received|c08\b|4853/.test(v)) {
    return 'product_not_received';
  }
  if (/\b13\.2\b|subscription|cancel|recurring|forgot to cancel|c28\b/.test(v)) {
    return 'subscription_canceled';
  }
  if (/\b13\.3\b|not as described|unacceptable|defective|quality|c31|c32/.test(v)) {
    return 'product_unacceptable';
  }
  if (/\b10\.4\b|fraud|unauthori[sz]ed|f24|f29|4837/.test(v)) {
    return 'fraudulent';
  }
  if (/\b13\.6\b|credit not processed|refund not|4860|c02/.test(v)) {
    return 'credit_not_processed';
  }
  if (/\b12\.6\b|duplicate|4834|p08/.test(v)) {
    return 'duplicate';
  }
  if (/unrecogni[sz]ed|don'?t recognize/.test(v)) {
    return 'unrecognized';
  }
  return 'other';
}

const TIER_RANK: Record<WinnabilityTier, number> = {
  unlikely: 0,
  weak: 1,
  moderate: 2,
  strong: 3,
};

const RANK_TIER: WinnabilityTier[] = ['unlikely', 'weak', 'moderate', 'strong'];

function downgrade(tier: WinnabilityTier, steps: number): WinnabilityTier {
  const next = Math.max(0, TIER_RANK[tier] - steps);
  return RANK_TIER[next];
}

/**
 * Deterministic winnability read for one dispute, given its reason code and the
 * proof the merchant says they hold.
 *
 * RUBRIC (documented, deterministic):
 *  1. Start at the reason code's baseTier (its ceiling with the right proof).
 *  2. Count how many of the code's `liftingProof` kinds the merchant holds.
 *     - holds all lifting proof  -> keep baseTier
 *     - holds some               -> downgrade one tier
 *     - holds none               -> downgrade two tiers (no proof = weak read)
 *  3. `commsHinged` is true only for comms-wedge codes where the merchant holds
 *     comms or delivery proof — the cases Stripe-native tools mark `unavailable`.
 */
export function scoreWinnability(
  code: ReasonCode,
  proof: { delivery: boolean; usage: boolean; comms: boolean },
): { tier: WinnabilityTier; commsHinged: boolean } {
  const profile = getReasonProfile(code);
  const held: Record<ProofKind, boolean> = {
    delivery: proof.delivery,
    usage: proof.usage,
    comms: proof.comms,
  };

  const lifting = profile.liftingProof;
  const heldLifting = lifting.filter((k) => held[k]).length;

  let tier: WinnabilityTier;
  if (lifting.length === 0) {
    tier = profile.baseTier;
  } else if (heldLifting === lifting.length) {
    tier = profile.baseTier;
  } else if (heldLifting > 0) {
    tier = downgrade(profile.baseTier, 1);
  } else {
    tier = downgrade(profile.baseTier, 2);
  }

  const commsHinged = profile.isCommsWedge && (proof.comms || proof.delivery);
  return { tier, commsHinged };
}

export { TIER_RANK };
