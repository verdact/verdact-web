/**
 * Shared types for the public audit funnel (lib/audit) and the /audit route.
 *
 * These types describe the merchant-supplied dispute data and the deterministic
 * scoring output. They are intentionally free of any DB or Stripe-SDK coupling
 * so the scoring brain stays a pure, testable module.
 */

// ─── Reason-code taxonomy ────────────────────────────────────────────────────
// Canonical Stripe dispute `reason` enum values, plus an `other`/`unknown`
// catch-all for manual entry. Mapped to network codes in reason-codes.ts.
export type ReasonCode =
  | 'fraudulent'
  | 'product_not_received'
  | 'product_unacceptable'
  | 'subscription_canceled'
  | 'credit_not_processed'
  | 'duplicate'
  | 'unrecognized'
  | 'general'
  | 'other';

// The kind of proof a merchant says they hold for a given dispute. These map
// directly to the manual-entry checkboxes and drive the winnability read.
export type ProofKind = 'delivery' | 'usage' | 'comms';

// Winnability tier — the honest, non-guarantee framing. "Proof profile that
// typically wins" vs "rarely wins on representment".
export type WinnabilityTier = 'strong' | 'moderate' | 'weak' | 'unlikely';

// Where the winning evidence for this reason code typically lives. `comms`
// means email/Slack threads + delivery logs — the Verdact wedge.
export type EvidenceLocus = 'comms' | 'transactional' | 'mixed' | 'none';

export type DisputeOutcome = 'won' | 'lost' | 'open' | 'unknown';

/**
 * A single dispute as supplied by the merchant (CSV row or manual entry),
 * after normalization. All fields are best-effort: file contents are never
 * trusted, so every field is optional except a stable client-side id.
 */
export interface AuditDispute {
  id: string;
  amount: number | null; // major units (dollars), not cents
  currency: string | null;
  reasonCode: ReasonCode;
  reasonRaw: string | null; // the original, untrusted reason string
  createdAt: string | null; // ISO date if parseable
  outcome: DisputeOutcome;
  proof: {
    delivery: boolean;
    usage: boolean;
    comms: boolean;
  };
  source: 'csv' | 'manual';
}

/**
 * The window-level inputs needed to compute the dispute-rate read.
 */
export interface AuditWindowInput {
  // Settled card payment volume (count of transactions) for the window.
  settledTransactionCount: number;
  windowDays: number;
}

/**
 * Per-dispute scoring output. Deterministic, derived only from the rubric.
 */
export interface ScoredDispute extends AuditDispute {
  tier: WinnabilityTier;
  evidenceLocus: EvidenceLocus;
  // Network reason-code label, e.g. "Visa 13.1".
  networkLabel: string;
  shortReason: string;
  // True when this is a comms-grounded case (13.1 / subscription / not received)
  // AND the merchant says they hold comms or delivery proof.
  commsHinged: boolean;
  // Plain-English "why" line shown on the result page.
  why: string;
  // True when outcome was lost but the proof profile typically wins — i.e. a
  // "you likely should have won this" candidate.
  shouldHaveWon: boolean;
}

export type StandingBand = 'tooEarly' | 'healthy' | 'close' | 'atRisk' | 'unknown';

export interface DisputeRateRead {
  band: StandingBand;
  ratioPercent: number | null; // e.g. 0.42 means 0.42%
  numerator: number;
  settledTransactionCount: number;
  bufferEvents: number | null; // events of headroom before the 0.75% line
  markerPercent: number | null; // 0..100 position on the 0..1.5% gauge
  belowScoreFloor: boolean;
}

export interface AuditScore {
  rate: DisputeRateRead;
  disputes: ScoredDispute[];
  summary: {
    totalDisputes: number;
    lostDisputes: number;
    shouldHaveWonCount: number;
    commsHingedCount: number;
    strongCount: number;
    recoverableAmount: number; // sum of amounts on should-have-won disputes
    currency: string | null;
  };
}
