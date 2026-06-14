/**
 * Smart customer-merge types (strategy doc §R8, 2026-06-13).
 *
 * Verdact NEVER auto-merges customers. The exact-email grouping in
 * lib/dal.getDisputesByCustomer is the clean, automatic case; everything here is
 * the suggest-and-confirm layer for the UNCERTAIN cases. A suggestion is shown,
 * the merchant confirms or rejects, and the decision is persisted as a training
 * signal (customer_identity_links).
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
