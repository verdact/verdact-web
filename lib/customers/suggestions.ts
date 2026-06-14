/**
 * "Possible same customer" suggestion engine (strategy doc §R8).
 *
 * Pure and conservative. Operates only on email-bearing (linked) customer groups
 * — the unlinked / one-off bucket is the fuzzy agency case and is deliberately
 * left alone (deferred follow-up). Two honest, explainable heuristics:
 *
 *   1. normalized_email (high) — two emails that resolve to the same address once
 *      Gmail dots/+tags and case/whitespace are normalized. Almost always one
 *      person, but still surfaced for confirmation (never auto-merged).
 *   2. same_name (medium) — the same customer name on two different emails. Could
 *      be coincidence, so it is clearly a suggestion to confirm.
 *
 * Pairs the merchant has already decided (merge OR split) are never re-suggested.
 *
 * AUTOMATION (Rishi 2026-06-14): when the engine is SURE (confidence at/above
 * AUTO_MERGE_MIN_CONFIDENCE — today only the deterministic normalized-email case),
 * the pair is auto-merged; the merchant is asked only for the doubtful pairs. Both
 * the auto-merges and the merchant's corrections are recorded as labeled training
 * data so the system can automate more over time. Auto-merge is internal grouping
 * only (reversible one-click split), never an outward/irreversible action.
 */

import type { CustomerGroup } from '@/lib/dal';
import { pairId, type MergeSuggestion } from './types';

const CONFIDENCE_HIGH = 0.9;
const CONFIDENCE_MEDIUM = 0.5;

// At/above this the engine is confident enough to auto-merge (no prompt). Tuned
// so the deterministic normalized-email case (0.9) auto-merges and the heuristic
// same-name case (0.5) still asks. Raise the bar before adding new auto kinds.
export const AUTO_MERGE_MIN_CONFIDENCE = 0.85;

/** Split suggestions into the ones safe to auto-merge vs the ones to ask about. */
export function partitionSuggestions(suggestions: MergeSuggestion[]): {
  autoMerges: MergeSuggestion[];
  prompts: MergeSuggestion[];
} {
  const autoMerges: MergeSuggestion[] = [];
  const prompts: MergeSuggestion[] = [];
  for (const s of suggestions) {
    (s.confidence >= AUTO_MERGE_MIN_CONFIDENCE ? autoMerges : prompts).push(s);
  }
  return { autoMerges, prompts };
}

type LinkedGroup = CustomerGroup & { customerKey: string };

/** Normalize an email for near-duplicate detection (Gmail dots/+tags, case). */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 0) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function label(group: LinkedGroup): string {
  if (group.customerName && group.customerEmail) {
    return `${group.customerName} (${group.customerEmail})`;
  }
  return group.customerEmail ?? group.customerKey;
}

export function buildMergeSuggestions(
  groups: CustomerGroup[],
  decidedPairIds: Set<string>,
): MergeSuggestion[] {
  const linked = groups.filter((g): g is LinkedGroup => g.customerKey !== null);
  const suggestions: MergeSuggestion[] = [];
  const emitted = new Set<string>();

  const collect = (
    buckets: Map<string, LinkedGroup[]>,
    kind: MergeSuggestion['kind'],
    confidence: number,
    reasonFor: (primary: LinkedGroup) => string,
  ) => {
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      // Most-disputed group is the canonical "primary"; fold the rest into it.
      const sorted = [...bucket].sort((a, b) => b.disputes.length - a.disputes.length);
      const primary = sorted[0];
      for (const other of sorted.slice(1)) {
        const id = pairId(primary.customerKey, other.customerKey);
        if (decidedPairIds.has(id) || emitted.has(id)) continue;
        emitted.add(id);
        suggestions.push({
          id,
          kind,
          confidence,
          reason: reasonFor(primary),
          primaryKey: primary.customerKey,
          primaryLabel: label(primary),
          linkedKey: other.customerKey,
          linkedLabel: label(other),
        });
      }
    }
  };

  // 1. Normalized-email near-duplicates.
  const byNormalizedEmail = new Map<string, LinkedGroup[]>();
  for (const g of linked) {
    const norm = normalizeEmail(g.customerKey);
    const list = byNormalizedEmail.get(norm) ?? [];
    list.push(g);
    byNormalizedEmail.set(norm, list);
  }
  collect(
    byNormalizedEmail,
    'normalized_email',
    CONFIDENCE_HIGH,
    () => 'These emails resolve to the same address once dots and +tags are normalized.',
  );

  // 2. Same customer name on different emails.
  const byName = new Map<string, LinkedGroup[]>();
  for (const g of linked) {
    if (!g.customerName) continue;
    const key = normalizeName(g.customerName);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(g);
    byName.set(key, list);
  }
  collect(
    byName,
    'same_name',
    CONFIDENCE_MEDIUM,
    (primary) => `Both carry the name "${primary.customerName}" on different email addresses.`,
  );

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
