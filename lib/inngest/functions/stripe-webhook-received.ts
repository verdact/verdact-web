import { inngest } from '../client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Durable processor for stored Stripe webhook events (Milestone B / Stage 1C).
 *
 * Triggered by `stripe/webhook.received`, which the webhook route fires after it
 * has verified the signature and stored the raw event in `webhook_events`.
 *
 * Idempotency strategy:
 *  - The route dedupes deliveries via the unique (processor, processor_event_id)
 *    constraint, so each Stripe event is enqueued at most once.
 *  - Within a run, every side effect is wrapped in `step.run`, which Inngest
 *    memoizes — completed steps are skipped on retry.
 *  - DB writes use upsert on the table's natural key, so a partial replay is safe.
 *
 * On unresolved merchant (event from an account we don't have connected), the
 * event is marked `unresolved` and the run ends cleanly (no retry storm).
 */

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service role credentials are not configured.');
  }
  return createClient(url, key);
}

// Stripe dispute.status -> internal disputes.status enum.
function mapDisputeStatus(stripeStatus: string | undefined): string {
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

function unixToIso(seconds: unknown): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

function chargeId(charge: unknown): string | null {
  if (typeof charge === 'string') return charge;
  if (charge && typeof charge === 'object' && 'id' in charge) {
    return String((charge as { id: unknown }).id);
  }
  return null;
}

export const stripeWebhookReceived = inngest.createFunction(
  { id: 'stripe-webhook-received', name: 'Process Stripe Webhook', retries: 3 },
  { event: 'stripe/webhook.received' },
  async ({ event, step, logger }) => {
    const webhookEventId = event.data?.webhookEventId as string | undefined;
    if (!webhookEventId) {
      logger.error('stripe/webhook.received missing webhookEventId', { data: event.data });
      return { skipped: 'no-webhook-event-id' };
    }

    const supabase = getServiceClient();

    // 1. Load the stored raw event.
    const row = await step.run('load-webhook-event', async () => {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('id, merchant_id, processor_account_id, event_type, payload, processing_status')
        .eq('id', webhookEventId)
        .single();
      if (error) throw error;
      return data;
    });

    // Already finished by a prior run — nothing to do.
    if (row.processing_status === 'processed') {
      return { skipped: 'already-processed' };
    }

    // 2. No merchant resolved -> mark unresolved and stop (do not retry).
    if (!row.merchant_id) {
      await step.run('mark-unresolved', async () => {
        await supabase
          .from('webhook_events')
          .update({ processing_status: 'unresolved', processing_error: 'No connected merchant for account' })
          .eq('id', webhookEventId);
      });
      return { unresolved: true, account: row.processor_account_id };
    }

    await step.run('mark-processing', async () => {
      await supabase
        .from('webhook_events')
        .update({ processing_status: 'processing' })
        .eq('id', webhookEventId);
    });

    // 3. Resolve the processor_connection for FK linkage.
    const connectionId = await step.run('resolve-connection', async () => {
      if (!row.processor_account_id) return null;
      const { data } = await supabase
        .from('processor_connections')
        .select('id')
        .eq('processor', 'stripe')
        .eq('processor_account_id', row.processor_account_id)
        .maybeSingle();
      return data?.id ?? null;
    });

    const stripeEvent = (row.payload as { event?: Record<string, unknown> })?.event ?? {};
    const dataObject =
      ((stripeEvent.data as { object?: Record<string, unknown> } | undefined)?.object) ?? {};
    const eventType: string = row.event_type;

    try {
      // 4. Dispatch by event type.
      if (eventType.startsWith('charge.dispute.')) {
        const dispute = dataObject as Record<string, unknown>;
        const internalStatus = mapDisputeStatus(dispute.status as string | undefined);
        const evidenceDetails = dispute.evidence_details as { due_by?: unknown } | undefined;

        const disputeRow = await step.run('upsert-dispute', async () => {
          const { data, error } = await supabase
            .from('disputes')
            .upsert(
              {
                merchant_id: row.merchant_id,
                processor_connection_id: connectionId,
                processor: 'stripe',
                processor_account_id: row.processor_account_id,
                processor_dispute_id: String(dispute.id),
                processor_charge_id: chargeId(dispute.charge),
                amount: typeof dispute.amount === 'number' ? dispute.amount : null,
                currency: typeof dispute.currency === 'string' ? dispute.currency : null,
                reason: typeof dispute.reason === 'string' ? dispute.reason : null,
                status: internalStatus,
                due_by: unixToIso(evidenceDetails?.due_by),
                outcome: statusToOutcome(internalStatus),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'processor,processor_dispute_id' },
            )
            .select('id')
            .single();
          if (error) throw error;
          return data;
        });

        // Minimal audit trail (memoized per run; one row per distinct event).
        if (eventType === 'charge.dispute.created') {
          await step.run('log-dispute-created', async () => {
            await supabase.from('dispute_events').insert({
              merchant_id: row.merchant_id,
              dispute_id: disputeRow.id,
              event_type: 'created',
              to_status: internalStatus,
              actor_kind: 'webhook',
              payload: { schema_version: 'v1', stripe_event_type: eventType },
            });
          });
        } else if (eventType === 'charge.dispute.closed') {
          await step.run('log-dispute-outcome', async () => {
            await supabase.from('dispute_events').insert({
              merchant_id: row.merchant_id,
              dispute_id: disputeRow.id,
              event_type: 'outcome_recorded',
              to_status: internalStatus,
              actor_kind: 'webhook',
              payload: { schema_version: 'v1', stripe_event_type: eventType },
            });
          });
        } else if (
          eventType === 'charge.dispute.funds_withdrawn' ||
          eventType === 'charge.dispute.funds_reinstated'
        ) {
          // Funds movement updates the dispute outcome but is not a closure.
          // Record an audit row consistent with the created/closed handlers so
          // the dispute timeline reflects the provisional debit/credit.
          await step.run('log-dispute-funds', async () => {
            await supabase.from('dispute_events').insert({
              merchant_id: row.merchant_id,
              dispute_id: disputeRow.id,
              event_type: 'status_changed',
              to_status: internalStatus,
              actor_kind: 'webhook',
              payload: { schema_version: 'v1', stripe_event_type: eventType },
            });
          });
        }
      } else if (eventType === 'account.application.deauthorized') {
        // Merchant revoked our Connect access on Stripe's side. Mark the
        // connection disconnected so it is not left stuck as 'connected'.
        // Resolved by processor_account_id (the deauthorized account on
        // event.account), independent of the FK lookup above.
        if (row.processor_account_id) {
          await step.run('mark-connection-disconnected', async () => {
            const now = new Date().toISOString();
            const { error } = await supabase
              .from('processor_connections')
              .update({
                connection_status: 'disconnected',
                disconnected_at: now,
                updated_at: now,
              })
              .eq('processor', 'stripe')
              .eq('processor_account_id', row.processor_account_id);
            if (error) throw error;
          });
        } else {
          logger.warn('account.application.deauthorized without processor_account_id', {
            webhookEventId,
          });
        }
      } else if (eventType === 'radar.early_fraud_warning.created') {
        const efw = dataObject as Record<string, unknown>;
        await step.run('upsert-efw', async () => {
          const { error } = await supabase.from('efw_alerts').upsert(
            {
              merchant_id: row.merchant_id,
              processor_connection_id: connectionId,
              processor: 'stripe',
              processor_account_id: row.processor_account_id,
              processor_alert_id: String(efw.id),
              processor_charge_id: chargeId(efw.charge),
              fraud_type: typeof efw.fraud_type === 'string' ? efw.fraud_type : null,
              actionable: typeof efw.actionable === 'boolean' ? efw.actionable : true,
            },
            { onConflict: 'processor,processor_alert_id' },
          );
          if (error) throw error;
        });
      } else {
        logger.warn('Unhandled Stripe event type', { eventType });
      }

      // 5. Mark processed.
      await step.run('mark-processed', async () => {
        await supabase
          .from('webhook_events')
          .update({ processing_status: 'processed', processed_at: new Date().toISOString(), processing_error: null })
          .eq('id', webhookEventId);
      });

      return { processed: true, eventType };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      // Record the failure for visibility; rethrow so Inngest retries.
      await step.run('mark-failed', async () => {
        await supabase
          .from('webhook_events')
          .update({ processing_status: 'failed', processing_error: message })
          .eq('id', webhookEventId);
      });
      throw err;
    }
  },
);
