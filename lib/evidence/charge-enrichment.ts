import 'server-only';

import { createStripeClient } from '@/lib/stripe';

/**
 * Best-effort enrichment of a dispute from its underlying Stripe charge.
 *
 * The dispute webhook stores only the charge ID; the charge object itself holds
 * real geo/network/temporal context the analyzers want:
 *   - purchaseAt     → charge.created (the closest real purchase date)
 *   - billingCountry → charge.billing_details.address.country
 *   - issuingCountry → charge.payment_method_details.card.country
 *
 * This is intentionally NON-fatal: any failure (charges disabled on the connected
 * account, revoked access, network error, missing secret) returns all-null so the
 * workbench still renders and the analyzers degrade honestly to their
 * "not enough data" states. It never throws.
 */
export interface ChargeEnrichment {
  purchaseAt: string | null;
  billingCountry: string | null;
  issuingCountry: string | null;
  /** Stripe customer ID attached to the charge — used for CE 3.0 prior-tx lookup. */
  customerStripeId: string | null;
  /** Card fingerprint — used to match prior settled transactions for CE 3.0. */
  cardFingerprint: string | null;
}

const EMPTY: ChargeEnrichment = {
  purchaseAt: null,
  billingCountry: null,
  issuingCountry: null,
  customerStripeId: null,
  cardFingerprint: null,
};

export async function enrichDisputeCharge({
  chargeId,
  stripeAccountId,
}: {
  chargeId: string | null;
  stripeAccountId: string | null;
}): Promise<ChargeEnrichment> {
  if (!chargeId || !stripeAccountId) return EMPTY;

  try {
    const stripe = createStripeClient();
    const charge = await stripe.charges.retrieve(
      chargeId,
      {},
      { stripeAccount: stripeAccountId },
    );

    const card =
      charge.payment_method_details?.type === 'card'
        ? charge.payment_method_details.card
        : null;

    const customerId =
      typeof charge.customer === 'string'
        ? charge.customer
        : (charge.customer as { id?: string } | null)?.id ?? null;

    return {
      purchaseAt: charge.created ? new Date(charge.created * 1000).toISOString() : null,
      billingCountry: charge.billing_details?.address?.country ?? null,
      issuingCountry: card?.country ?? null,
      customerStripeId: customerId,
      cardFingerprint: card?.fingerprint ?? null,
    };
  } catch {
    // Charges disabled / access revoked / transient error — degrade honestly.
    return EMPTY;
  }
}
