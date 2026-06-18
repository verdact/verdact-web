/**
 * Smart customer-merge types (strategy doc §R8, 2026-06-13; auto-merge decision
 * 2026-06-14).
 *
 * Exact-email grouping in lib/dal.getDisputesByCustomer is the clean, automatic
 * case. Beyond that, suggestions are partitioned by confidence: SURE pairs are
 * auto-linked at render (shown transparently in "Auto-linked" with an undo),
 * while DOUBTFUL pairs are surfaced as suggest-and-confirm prompts. Either way the
 * merchant's correction (confirm or "not the same") is persisted as a training
 * signal (customer_identity_links); auto-merges are persisted only when corrected.
 */

export type IdentityDecision = 'merge' | 'split';

/** A merchant-confirmed identity decision (a row of customer_identity_links). */
export interface IdentityLink {
  primaryKey: string;
  linkedKey: string;
  decision: IdentityDecision;
}

export type SuggestionKind = 'normalized_email' | 'same_name';

/** A "possible same customer" suggestion awaiting the merchant's confirmation. */
export interface MergeSuggestion {
  // Stable id for the (sorted) key pair — used to suppress re-suggesting a
  // decided pair and as the React key.
  id: string;
  kind: SuggestionKind;
  confidence: number; // 0..1 — honest, never presented as certainty
  reason: string;
  // The canonical identity that is kept, and the one that would fold into it.
  primaryKey: string;
  primaryLabel: string;
  linkedKey: string;
  linkedLabel: string;
}

/** Stable id for a key pair, order-independent. */
export function pairId(a: string, b: string): string {
  return [a, b].sort().join('::');
}
