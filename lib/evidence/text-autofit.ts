/**
 * Intelligent text truncation for Stripe evidence packet fields.
 *
 * Stripe imposes a 150,000-character hard limit across all text fields combined
 * (lib/evidence/submission.ts TEXT_LIMIT). Today an overrun is a hard reject.
 * Auto-fit makes real overruns impossible for normal inputs by trimming the
 * lowest-value content first:
 *
 *   1. Analyzer narrative blocks (AI-generated, appended to the argument) — trim
 *      from the END of the uncategorized_text value (lowest priority content last).
 *   2. Merchant narrative — truncate with an ellipsis marker so the merchant's own
 *      words stay but are surfaced as condensed to the reviewer.
 *   3. Policy disclosures — truncate with an ellipsis marker (last resort).
 *
 * This module is PURE (no Stripe SDK, no DB, no async). Wire it into
 * prepareStripeEvidence() before the char-count check.
 */

import type { PacketField } from './packet';

const ELLIPSIS_MARKER = '… [condensed for submission]';
const ANALYZER_SEPARATOR = '\n\n';

/**
 * Truncate a set of packet text fields so their total character count is at or
 * below `limit`. Returns a new array — never mutates the input.
 *
 * The function is safe to call even when the total is already under `limit`
 * (no-op in that case). Truncation order: analyzer narratives → merchant
 * narrative → policy disclosures. All truncations add a visible marker so the
 * reviewer knows the text was condensed.
 */
export function fitTextFields(fields: PacketField[], limit: number): PacketField[] {
  const total = sumChars(fields);
  if (total <= limit) return fields;

  let result = fields.map((f) => ({ ...f }));
  let over = sumChars(result) - limit;

  // ── Pass 1: trim analyzer narrative blocks from uncategorized_text ────────
  // The argument field is `buildArgumentText` output — merchant narrative +
  // \n\n-separated analyzer blocks. We remove analyzer blocks from the end
  // one at a time until we're within budget or only the merchant part remains.
  const argIdx = result.findIndex((f) => f.key === 'uncategorized_text');
  if (argIdx !== -1 && over > 0) {
    const arg = result[argIdx];
    const parts = arg.value.split(ANALYZER_SEPARATOR);
    // Keep removing the last part (analyzer blocks added by buildArgumentText).
    // Stop if we're down to one part (the merchant narrative itself).
    while (parts.length > 1 && over > 0) {
      const removed = parts.pop()!;
      over -= removed.length + ANALYZER_SEPARATOR.length;
    }
    result[argIdx] = { ...arg, value: parts.join(ANALYZER_SEPARATOR) };
  }

  // ── Pass 2: truncate merchant narrative ───────────────────────────────────
  if (argIdx !== -1 && over > 0) {
    const arg = result[argIdx];
    const keepLen = Math.max(0, arg.value.length - over - ELLIPSIS_MARKER.length);
    if (keepLen < arg.value.length) {
      result[argIdx] = {
        ...arg,
        value: arg.value.slice(0, keepLen) + ELLIPSIS_MARKER,
      };
      over = sumChars(result) - limit;
    }
  }

  // ── Pass 3: truncate policy disclosures ───────────────────────────────────
  const policyKeys = ['cancellation_policy_disclosure', 'refund_policy_disclosure'];
  for (const key of policyKeys) {
    if (over <= 0) break;
    const idx = result.findIndex((f) => f.key === key);
    if (idx === -1 || !result[idx].present) continue;
    const field = result[idx];
    const keepLen = Math.max(0, field.value.length - over - ELLIPSIS_MARKER.length);
    if (keepLen < field.value.length) {
      result[idx] = {
        ...field,
        value: field.value.slice(0, keepLen) + ELLIPSIS_MARKER,
      };
      over = sumChars(result) - limit;
    }
  }

  return result;
}

function sumChars(fields: PacketField[]): number {
  return fields.filter((f) => f.present).reduce((acc, f) => acc + f.value.length, 0);
}
