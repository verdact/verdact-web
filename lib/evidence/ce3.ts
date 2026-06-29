/**
 * CE 3.0 eligibility compute — server-only, advisory surface.
 *
 * Hard locks:
 *   - Gate: Visa + fraudulent (10.4) ONLY. Never 13.1, never non-Visa.
 *   - Result is advisory only. Never drives Stripe submit logic or billing.
 *   - Never throws — any Stripe failure returns the cached (or false) result.
 *
 * Staleness cache: skip the Stripe list call if ce3_checked_at < 24h. On a fresh
 * cache hit we return the CACHED eligibility (not a hardcoded false) and signal
 * recomputed:false so the caller does NOT re-stamp the timestamp (which would
 * otherwise slide the 24h window forward forever and never refresh). The caller
 * only writes through when recomputed === true (a real Stripe recompute ran).
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
const DAY_MS = 24 * 60 * 60 * 1000;

/** Defensive cap on how many charges we scan, to bound serverless time. */
const MAX_CHARGES_SCANNED = 2000;

export interface Ce3Result {
  eligible: boolean;
  priorTransactionCount: number;
  /** True only when a live Stripe recompute ran this call (gates write-through). */
  recomputed: boolean;
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
 * Compute CE 3.0 eligibility. Returns recomputed:false (no write-through) when:
 *   - The gate fails (non-Visa or non-fraudulent)
 *   - Required Stripe identifiers are missing
 *   - The cached result is fresh (< 24h) → returns the cached eligibility
 *   - Any Stripe call fails → returns the cached eligibility (never overwrites)
 *
 * Returns recomputed:true ONLY when a live charges scan actually ran.
 */
export async function computeCe3Eligibility({
  network,
  reasonCode,
  customerStripeId,
  cardFingerprint,
  stripeAccountId,
  disputedChargeAt,
  cachedCheckedAt,
  cachedEligible,
}: {
  network: string | null;
  reasonCode: ReasonCode;
  customerStripeId: string | null;
  cardFingerprint: string | null;
  stripeAccountId: string | null;
  /** The disputed TRANSACTION's date (charge.created), not the dispute-filed date. */
  disputedChargeAt: string;
  cachedCheckedAt: string | null;
  cachedEligible: boolean | null;
}): Promise<Ce3Result> {
  const cached = cachedEligible ?? false;
  const notRecomputed: Ce3Result = {
    eligible: cached,
    priorTransactionCount: 0,
    recomputed: false,
  };

  if (!isCe3Gate(network, reasonCode)) {
    // Gate fail: definitively not eligible, regardless of any stale cache.
    return { eligible: false, priorTransactionCount: 0, recomputed: false };
  }
  if (!customerStripeId || !cardFingerprint || !stripeAccountId) return notRecomputed;

  // Staleness bypass — within 24h, trust the cached eligibility and do NOT
  // re-stamp (recomputed:false), so the window cannot slide forward forever.
  if (cachedCheckedAt) {
    const age = Date.now() - new Date(cachedCheckedAt).getTime();
    if (age < STALENESS_MS) return notRecomputed;
  }

  try {
    const stripe = createStripeClient();

    // CE 3.0 measures the window relative to the DISPUTED TRANSACTION date.
    // Settled transactions from 364 days down to 120 days before it qualify;
    // the most-recent 120 days are explicitly out of scope.
    const anchorTs = new Date(disputedChargeAt).getTime();
    const windowOldEdge = anchorTs - WINDOW_MAX_DAYS * DAY_MS; // ≥ this
    const windowNewEdge = anchorTs - WINDOW_MIN_DAYS * DAY_MS; // < this

    // Page through the customer's charges newest-first, counting prior settled
    // (non-refunded) charges on the same card fingerprint inside the window.
    // Stop once we pass the old edge (charges are created-desc) or hit the cap.
    let count = 0;
    let scanned = 0;
    await stripe.charges
      .list({ customer: customerStripeId, limit: 100 }, { stripeAccount: stripeAccountId })
      .autoPagingEach((c) => {
        scanned += 1;
        if (scanned > MAX_CHARGES_SCANNED) return false; // bound the scan
        const ts = c.created * 1000;
        if (ts < windowOldEdge) return false; // older than window → done
        if (ts >= windowNewEdge) return; // too recent (out of scope) → keep going
        const fingerprint =
          c.payment_method_details?.type === 'card'
            ? c.payment_method_details.card?.fingerprint
            : null;
        // Settled = succeeded AND not refunded; a later-refunded charge is not a
        // genuine prior purchase for CE 3.0 purposes.
        if (fingerprint === cardFingerprint && c.status === 'succeeded' && c.refunded === false) {
          count += 1;
        }
        return;
      });

    return {
      eligible: count >= MIN_PRIOR_TRANSACTIONS,
      priorTransactionCount: count,
      recomputed: true,
    };
  } catch {
    // Revoked access / network error / wrong stripeAccount — preserve the cached
    // eligibility and do NOT write through (recomputed:false).
    return notRecomputed;
  }
}
