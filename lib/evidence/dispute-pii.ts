import 'server-only';

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStripeClient } from '@/lib/stripe';

/**
 * Best-effort customer-identity enrichment for an ingested dispute.
 *
 * The dispute webhook + backfill store only the charge ID; the customer's name,
 * email, and billing address live on the underlying Stripe charge's
 * `billing_details`. Without this, disputes show no customer name, the Customers
 * page is all "Unlinked", and the evidence packet's Stripe customer fields are
 * blank (a weaker filing). This pulls that identity off the charge and writes it
 * to `dispute_pii`, linking it via `disputes.pii_id`.
 *
 * Design rules:
 *  - NEVER throws. A PII failure (charges disabled, revoked access, transient
 *    error) must not block dispute ingestion. Returns a result object instead.
 *  - Additive only. If Stripe yields no usable identity, no row is created.
 *  - Respects erasure. A `dispute_pii` row with `redacted_at` set is never
 *    re-populated.
 *
 * Split so the webhook (charge id only → must fetch) and the backfill (lists
 * disputes with `expand: ['data.charge']` → charge already in hand) share the
 * same write path without the backfill making N extra Stripe calls.
 */

const PII_SCHEMA_VERSION = 'v1';

export interface DisputePiiFields {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address: Record<string, unknown> | null;
}

export interface WriteDisputePiiArgs {
  supabase: SupabaseClient;
  merchantId: string;
  disputeId: string;
  /** The dispute's current `pii_id` (the upsert/select that produced disputeId
   *  also yields this), so we update vs insert without a re-read. */
  currentPiiId: string | null;
  fields: DisputePiiFields;
}

export interface EnrichDisputePiiArgs {
  supabase: SupabaseClient;
  merchantId: string;
  disputeId: string;
  currentPiiId: string | null;
  chargeId: string | null;
  stripeAccountId: string | null;
}

export interface EnrichDisputePiiResult {
  enriched: boolean;
  reason?: string;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a `billing_address` JSONB payload carrying the required top-level
 * `schema_version` key (enforced by the dispute_pii_schema_version trigger), or
 * null when Stripe gave us no address fields worth storing. Pure — exported for
 * unit testing.
 */
export function buildBillingAddress(
  address: Stripe.Address | null | undefined,
): Record<string, unknown> | null {
  if (!address) return null;
  const line1 = normalizeText(address.line1);
  const line2 = normalizeText(address.line2);
  const city = normalizeText(address.city);
  const state = normalizeText(address.state);
  const postalCode = normalizeText(address.postal_code);
  const country = normalizeText(address.country);

  if (!line1 && !line2 && !city && !state && !postalCode && !country) {
    return null;
  }

  return {
    schema_version: PII_SCHEMA_VERSION,
    line1,
    line2,
    city,
    state,
    postal_code: postalCode,
    country,
  };
}

/**
 * Extracts the customer identity from a Stripe charge, or null when there is
 * nothing worth storing. Pure — exported for unit testing.
 */
export function extractPiiFromCharge(charge: Stripe.Charge): DisputePiiFields | null {
  const billing = charge.billing_details ?? null;
  const customer_name = normalizeText(billing?.name);
  const customer_email = normalizeText(billing?.email) ?? normalizeText(charge.receipt_email);
  const customer_phone = normalizeText(billing?.phone);
  const billing_address = buildBillingAddress(billing?.address);

  if (!customer_name && !customer_email && !customer_phone && !billing_address) {
    return null;
  }
  return { customer_name, customer_email, customer_phone, billing_address };
}

/**
 * Upserts `dispute_pii` and links it via `disputes.pii_id`. Never throws.
 */
export async function writeDisputePii({
  supabase,
  merchantId,
  disputeId,
  currentPiiId,
  fields,
}: WriteDisputePiiArgs): Promise<EnrichDisputePiiResult> {
  try {
    const piiFields = { ...fields, updated_at: new Date().toISOString() };

    // service_role bypasses RLS, so the explicit merchant_id predicate on every
    // read/write below is the ONLY thing fencing a cross-account PII write.
    if (currentPiiId) {
      // Never re-populate PII a merchant or admin has erased.
      const { data: existing } = await supabase
        .from('dispute_pii')
        .select('redacted_at')
        .eq('id', currentPiiId)
        .eq('merchant_id', merchantId)
        .maybeSingle();
      if (existing?.redacted_at) return { enriched: false, reason: 'redacted' };

      const { error } = await supabase
        .from('dispute_pii')
        .update(piiFields)
        .eq('id', currentPiiId)
        .eq('merchant_id', merchantId);
      if (error) throw error;
      return { enriched: true };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('dispute_pii')
      .insert({ merchant_id: merchantId, ...piiFields })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { data: linked, error: linkError } = await supabase
      .from('disputes')
      .update({ pii_id: inserted.id })
      .eq('id', disputeId)
      .eq('merchant_id', merchantId)
      .select('id');
    if (linkError) throw linkError;
    // A 0-row link means the dispute_pii row is orphaned (stale or foreign
    // disputeId) — report it honestly instead of a false success.
    if (!linked || linked.length === 0) {
      return { enriched: false, reason: 'link-no-match' };
    }

    return { enriched: true };
  } catch (err) {
    return { enriched: false, reason: err instanceof Error ? err.message : 'write-error' };
  }
}

/**
 * Webhook path: fetch the charge by id (the stored dispute payload carries only
 * the charge id), then extract + write. Never throws.
 */
export async function enrichDisputePii({
  supabase,
  merchantId,
  disputeId,
  currentPiiId,
  chargeId,
  stripeAccountId,
}: EnrichDisputePiiArgs): Promise<EnrichDisputePiiResult> {
  if (!chargeId || !stripeAccountId) return { enriched: false, reason: 'no-charge' };

  let charge: Stripe.Charge;
  try {
    const stripe = createStripeClient();
    charge = await stripe.charges.retrieve(chargeId, {}, { stripeAccount: stripeAccountId });
  } catch {
    // Categorize rather than surfacing the raw Stripe error, which can carry the
    // charge / connected-account id into the Inngest run log.
    return { enriched: false, reason: 'charge-fetch-error' };
  }

  const fields = extractPiiFromCharge(charge);
  if (!fields) return { enriched: false, reason: 'no-identity' };

  return writeDisputePii({ supabase, merchantId, disputeId, currentPiiId, fields });
}
