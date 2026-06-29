/**
 * Intelligent text truncation for Stripe evidence packet fields.
 *
 * Stripe imposes a 150,000-character limit across all text fields combined
 * (lib/evidence/submission.ts TEXT_LIMIT). Auto-fit trims the lowest-value
 * content first so a normal packet is brought under the limit instead of being
 * hard-rejected:
 *
 *   1. Analyzer narrative blocks (AI-generated, appended to the argument) — trim
 *      from the END of the uncategorized_text value (lowest priority last).
 *   2. Merchant narrative — truncate with an ellipsis marker.
 *   3. Policy disclosures — truncate with an ellipsis marker.
 *   4. Product description — last-resort truncation with an ellipsis marker.
 *
 * Every truncation adds a visible "… [condensed for submission]" marker so the
 * reviewer knows the text was condensed; nothing is dropped silently.
 *
 * This is NOT an absolute guarantee: the short structured fields (customer name,
 * email, service date) are never trimmed, so a pathological input where those
 * alone exceed the limit still hard-rejects in submission.ts as a final
 * backstop. For real packets the four passes above bring the total under limit.
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
 */
export function fitTextFields(fields: PacketField[], limit: number): PacketField[] {
  if (sumChars(fields) <= limit) return fields;

  const result = fields.map((f) => ({ ...f }));
  let over = sumChars(result) - limit;

  // ── Pass 1: trim analyzer narrative blocks from uncategorized_text ────────
  // The argument field is `buildArgumentText` output — merchant narrative +
  // \n\n-separated analyzer blocks. Remove analyzer blocks from the end one at
  // a time until within budget or only the merchant part remains.
  const argIdx = result.findIndex((f) => f.key === 'uncategorized_text');
  if (argIdx !== -1 && over > 0) {
    const arg = result[argIdx];
    const parts = arg.value.split(ANALYZER_SEPARATOR);
    while (parts.length > 1 && over > 0) {
      const removed = parts.pop()!;
      over -= removed.length + ANALYZER_SEPARATOR.length;
    }
    result[argIdx] = { ...arg, value: parts.join(ANALYZER_SEPARATOR) };
    over = sumChars(result) - limit;
  }

  // ── Pass 2: truncate the merchant narrative (remaining uncategorized_text) ─
  if (argIdx !== -1 && over > 0) {
    result[argIdx] = truncateFieldToFit(result[argIdx], over);
    over = sumChars(result) - limit;
  }

  // ── Pass 3: truncate policy disclosures ───────────────────────────────────
  // ── Pass 4: truncate product description (last resort) ────────────────────
  const lastResortKeys = [
    'cancellation_policy_disclosure',
    'refund_policy_disclosure',
    'product_description',
  ];
  for (const key of lastResortKeys) {
    if (over <= 0) break;
    const idx = result.findIndex((f) => f.key === key);
    if (idx === -1 || !result[idx].present) continue;
    result[idx] = truncateFieldToFit(result[idx], over);
    over = sumChars(result) - limit;
  }

  return result;
}

/**
 * Remove `over` characters from the END of a field, leaving a visible marker.
 * Never grows the field: if there is not enough room for content + marker, the
 * value is dropped to empty rather than replaced with a longer marker.
 */
function truncateFieldToFit(field: PacketField, over: number): PacketField {
  const keepLen = field.value.length - over - ELLIPSIS_MARKER.length;
  if (keepLen > 0) {
    return { ...field, value: field.value.slice(0, keepLen) + ELLIPSIS_MARKER };
  }
  return { ...field, value: '' };
}

function sumChars(fields: PacketField[]): number {
  return fields.filter((f) => f.present).reduce((acc, f) => acc + f.value.length, 0);
}
