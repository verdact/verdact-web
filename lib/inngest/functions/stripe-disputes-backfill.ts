import type Stripe from 'stripe';
import { createStripeClient } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { extractPiiFromCharge, writeDisputePii } from '@/lib/evidence/dispute-pii';
import { inngest } from '../client';

export const STRIPE_DISPUTES_BACKFILL_EVENT = 'verdact/stripe.disputes.backfill';

const PAGE_LIMIT = 100;
const MAX_BACKFILL_ROWS = 1000;
const DEFAULT_LOOKBACK_DAYS = 180;

type BackfillEventData = {
  merchantId?: string;
  processorConnectionId?: string;
  lookbackDays?: number;
  source?: string;
};

type ProcessorConnectionRow = {
  id: string;
  merchant_id: string;
  processor_account_id: string;
};

export const stripeDisputesBackfill = inngest.createFunction(
  { id: 'stripe-disputes-backfill', name: 'Backfill Stripe Disputes', retries: 3 },
  { event: STRIPE_DISPUTES_BACKFILL_EVENT },
  async ({ event, step, logger }) => {
    const data = (event.data ?? {}) as BackfillEventData;
    const merchantId = data.merchantId;
    const processorConnectionId = data.processorConnectionId;

    if (!merchantId || !processorConnectionId) {
      logger.error('stripe dispute backfill missing identifiers', { data });
      return { skipped: 'missing-identifiers' };
    }

    const supabase = createServiceClient();

    const connection = await step.run('load-stripe-connection', async () => {
      const { data: row, error } = await supabase
        .from('processor_connections')
        .select('id, merchant_id, processor_account_id')
        .eq('id', processorConnectionId)
        .eq('merchant_id', merchantId)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle();

      if (error) throw error;
      return (row as ProcessorConnectionRow | null) ?? null;
    });

    if (!connection) {
      return { skipped: 'no-connected-stripe-account', merchantId, processorConnectionId };
    }

    const lookbackDays = clampLookbackDays(data.lookbackDays);
    const since = Math.floor((Date.now() - lookbackDays * 24 * 60 * 60 * 1000) / 1000);

    const disputes = await step.run('list-stripe-disputes', async () => {
      const stripe = createStripeClient();
      return collectStripeList(
        stripe.disputes.list(
          // Expand the charge so customer-identity enrichment below needs no
          // extra per-dispute Stripe calls.
          { created: { gte: since }, limit: PAGE_LIMIT, expand: ['data.charge'] },
          { stripeAccount: connection.processor_account_id },
        ),
        MAX_BACKFILL_ROWS,
      );
    });

    if (disputes.length === 0) {
      return { merchantId, processorConnectionId, imported: 0, source: data.source ?? 'event' };
    }

    const rows = disputes.map((dispute) => {
      const internalStatus = mapDisputeStatus(dispute.status);
      return {
        merchant_id: connection.merchant_id,
        processor_connection_id: connection.id,
        processor: 'stripe',
        processor_account_id: connection.processor_account_id,
        processor_dispute_id: dispute.id,
        processor_charge_id: stripeObjectId(dispute.charge),
        amount: typeof dispute.amount === 'number' ? dispute.amount : null,
        currency: typeof dispute.currency === 'string' ? dispute.currency : null,
        reason: typeof dispute.reason === 'string' ? dispute.reason : null,
        network: networkFromDispute(dispute),
        status: internalStatus,
        due_by: unixToIso(dispute.evidence_details?.due_by),
        outcome: statusToOutcome(internalStatus),
        updated_at: new Date().toISOString(),
      };
    });

    await step.run('upsert-disputes', async () => {
      const { error } = await supabase
        .from('disputes')
        .upsert(rows, { onConflict: 'processor,processor_dispute_id' });
      if (error) throw error;
    });

    // Best-effort customer-identity enrichment. The list above expanded the
    // charge, so this needs NO extra Stripe calls — it reads back the dispute ids
    // and writes dispute_pii for those with usable billing details. Fully
    // non-throwing: a failure here never fails the import.
    const piiEnriched = await step.run('enrich-dispute-pii', async () => {
      const processorDisputeIds = rows.map((r) => r.processor_dispute_id);
      const { data: idRows } = await supabase
        .from('disputes')
        .select('id, processor_dispute_id, pii_id')
        .eq('merchant_id', connection.merchant_id)
        .in('processor_dispute_id', processorDisputeIds);
      if (!idRows) return 0;

      const byProcessorId = new Map(
        idRows.map((d) => [
          d.processor_dispute_id as string,
          d as { id: string; pii_id: string | null },
        ]),
      );

      let enriched = 0;
      for (const dispute of disputes) {
        const internal = byProcessorId.get(dispute.id);
        if (!internal) continue;
        const charge = dispute.charge;
        if (!charge || typeof charge !== 'object') continue;
        const fields = extractPiiFromCharge(charge as Stripe.Charge);
        if (!fields) continue;
        const result = await writeDisputePii({
          supabase,
          merchantId: connection.merchant_id,
          disputeId: internal.id,
          currentPiiId: internal.pii_id,
          fields,
        });
        if (result.enriched) enriched += 1;
      }
      return enriched;
    });

    return {
      merchantId,
      processorConnectionId,
      imported: rows.length,
      piiEnriched,
      capped: disputes.length >= MAX_BACKFILL_ROWS,
      source: data.source ?? 'event',
    };
  },
);

async function collectStripeList<T>(
  list: Stripe.ApiListPromise<T>,
  maxRows: number,
): Promise<T[]> {
  const rows: T[] = [];
  await list.autoPagingEach((row) => {
    rows.push(row);
    return rows.length < maxRows;
  });
  return rows;
}

function clampLookbackDays(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LOOKBACK_DAYS;
  return Math.max(1, Math.min(Math.floor(value as number), 365));
}

function mapDisputeStatus(stripeStatus: string | null | undefined): string {
  switch (stripeStatus) {
    case 'warning_needs_response':
    case 'needs_response':
      return 'needs_response';
    case 'warning_under_review':
    case 'under_review':
      return 'under_review';
    case 'warning_closed':
      return 'warning_closed';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    default:
      return 'needs_response';
  }
}

function statusToOutcome(internalStatus: string): string | null {
  if (internalStatus === 'won' || internalStatus === 'lost' || internalStatus === 'warning_closed') {
    return internalStatus;
  }
  return null;
}

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

function stripeObjectId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;
  return null;
}

function networkFromDispute(dispute: Stripe.Dispute): 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown' {
  const cardBrand =
    dispute.payment_method_details?.type === 'card'
      ? dispute.payment_method_details.card?.brand?.toLowerCase()
      : null;

  if (cardBrand === 'visa') return 'visa';
  if (cardBrand === 'mastercard') return 'mastercard';
  if (cardBrand === 'amex' || cardBrand === 'american express') return 'amex';
  if (cardBrand === 'discover') return 'discover';
  return 'unknown';
}
