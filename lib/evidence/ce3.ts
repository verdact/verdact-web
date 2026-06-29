/**
 * CE 3.0 eligibility compute — server-only, advisory surface.
 *
 * Hard locks:
 *   - Gate: Visa + fraudulent (10.4) ONLY. Never 13.1, never non-Visa.
 *   - Result is advisory only. Never drives Stripe submit logic or billing.
 *   - Never throws — any Stripe failure returns {eligible:false}.
 *
 * Staleness cache: skip the Stripe list call if ce3_checked_at < 24h. The
 * caller writes the result back non-blockingly (catch-all) scoped to merchant_id.
 *
 * VAMP-numerator adjustment (exclude CE3-qualified from chargeback count) is
 * DEFERRED — it alters the headline ratio vs the 0.75% Visa threshold and
 * needs its own careful review + historical backfill.
 */

import 'server-only';

import { createStripeClient } from '@/lib/stripe';
import type { ReasonCode } from '@/lib/audit/types';

/** 24-hour staleness window in milliseconds. */
const STALENESS_MS = 24 * 60 * 60 * 1000;

/** Minimum prior settled transactions to qualify. */
const MIN_PRIOR_TRANSACTIONS = 2;

/** Look-back window in days (Visa CE 3.0 spec: 120–364 days). */
const WINDOW_MIN_DAYS = 120;
const WINDOW_MAX_DAYS = 364;

export interface Ce3Result {
  eligible: boolean;
  priorTransactionCount: number;
}

/**
 * Gate check — the AND condition that must pass before any Stripe call.
 * Enforced in BOTH compute and render paths.
 */
export function isCe3Gate(
  network: string | null | undefined,
  reasonCode: ReasonCode,
): boolean {
  return network === 'visa' && reasonCode === 'fraudulent';
}

/**
 * Compute CE 3.0 eligibility. Returns {eligible:false} immediately if:
 *   - The gate fails (non-Visa or non-fraudulent)
 *   - The cached result is fresh (< 24h old)
 *   - Any Stripe call fails for any reason
 *
 * Callers pass cachedCheckedAt to enable staleness bypass.
 */
export async function computeCe3Eligibility({
  network,
  reasonCode,
  customerStripeId,
  cardFingerprint,
  stripeAccountId,
  disputeCreatedAt,
  cachedCheckedAt,
}: {
  network: string | null;
  reasonCode: ReasonCode;
  customerStripeId: string | null;
  cardFingerprint: string | null;
  stripeAccountId: string | null;
  disputeCreatedAt: string;
  cachedCheckedAt: string | null;
}): Promise<Ce3Result> {
  const NOT_ELIGIBLE: Ce3Result = { eligible: false, priorTransactionCount: 0 };

  if (!isCe3Gate(network, reasonCode)) return NOT_ELIGIBLE;
  if (!customerStripeId || !cardFingerprint || !stripeAccountId) return NOT_ELIGIBLE;

  // Staleness bypass — skip Stripe if the cached result is < 24h old.
  if (cachedCheckedAt) {
    const age = Date.now() - new Date(cachedCheckedAt).getTime();
    if (age < STALENESS_MS) return NOT_ELIGIBLE;
  }

  try {
    const stripe = createStripeClient();

    const disputeTs = new Date(disputeCreatedAt).getTime();
    // CE 3.0 looks at settled transactions from 364 days down to 120 days before
    // the dispute. The most-recent 120 days are explicitly out of scope.
    const windowOldEdge = disputeTs - WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000; // ≥ this
    const windowNewEdge = disputeTs - WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000; // < this

    // List up to 100 of the customer's most-recent charges, then filter by
    // fingerprint + date window + settled status. Stripe has no fingerprint
    // filter on charges.list, so we apply it client-side.
    const charges = await stripe.charges.list(
      { customer: customerStripeId, limit: 100 },
      { stripeAccount: stripeAccountId },
    );

    const priorSettled = charges.data.filter((c) => {
      const ts = c.created * 1000;
      const fingerprint =
        c.payment_method_details?.type === 'card'
          ? c.payment_method_details.card?.fingerprint
          : null;
      return (
        fingerprint === cardFingerprint &&
        c.status === 'succeeded' &&
        ts >= windowOldEdge &&
        ts < windowNewEdge
      );
    });

    const count = priorSettled.length;
    return { eligible: count >= MIN_PRIOR_TRANSACTIONS, priorTransactionCount: count };
  } catch {
    // Revoked access / network error / wrong stripeAccount — degrade honestly.
    return NOT_ELIGIBLE;
  }
}
