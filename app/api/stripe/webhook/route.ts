import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createStripeClient } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

// Stripe signature verification needs the raw request body and Node crypto.
export const runtime = 'nodejs';

/**
 * Stripe webhook receiver (Milestone B / Stage 1C).
 *
 * Responsibilities (kept deliberately thin — heavy work runs in Inngest):
 *  1. Verify the raw Stripe signature.
 *  2. Resolve the connected account -> processor_connection -> merchant.
 *  3. Insert the raw event into `webhook_events` (idempotent via unique
 *     (processor, processor_event_id)).
 *  4. Hand off to Inngest for durable, retryable processing.
 *  5. Return 200 quickly so Stripe does not retry on our slow work.
 *
 * Uses the service-role Supabase client because Stripe calls this route with
 * no user session; there is no `authenticated` JWT to satisfy RLS.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('Missing stripe-signature header', { status: 400 });
  }

  // Raw body is required — do NOT JSON.parse before verifying the signature.
  const rawBody = await request.text();

  const stripe = createStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[stripe/webhook] Signature verification failed:', message);
    return new NextResponse(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  const supabase = createServiceClient();

  // For Connect webhooks the connected account is on `event.account`.
  const connectedAccountId = event.account ?? null;

  // Resolve connected account -> processor_connection -> merchant.
  let merchantId: string | null = null;
  let connectionId: string | null = null;
  if (connectedAccountId) {
    const { data: connection } = await supabase
      .from('processor_connections')
      .select('id, merchant_id')
      .eq('processor', 'stripe')
      .eq('processor_account_id', connectedAccountId)
      .maybeSingle();
    if (connection) {
      merchantId = connection.merchant_id;
      connectionId = connection.id;
    }
  }

  // Idempotent raw insert. Duplicate delivery -> unique violation (23505) -> ack 200.
  const { data: inserted, error: insertError } = await supabase
    .from('webhook_events')
    .insert({
      processor: 'stripe',
      processor_event_id: event.id,
      processor_account_id: connectedAccountId,
      processor_api_version: event.api_version ?? null,
      merchant_id: merchantId,
      event_type: event.type,
      payload: { schema_version: 'v1', event: event as unknown as Record<string, unknown> },
      processing_status: merchantId ? 'received' : 'unresolved',
    })
    .select('id')
    .single();

  if (insertError) {
    // Duplicate event already stored — acknowledge so Stripe stops retrying.
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[stripe/webhook] Failed to store event:', insertError.message);
    return new NextResponse('Failed to persist event', { status: 500 });
  }

  // Best-effort: record that this connection is alive. Never block the ack.
  if (connectionId) {
    await supabase
      .from('processor_connections')
      .update({ last_event_seen_at: new Date().toISOString() })
      .eq('id', connectionId);
  }

  // Hand off durable processing to Inngest. Only fired for newly stored events.
  await inngest.send({
    name: 'stripe/webhook.received',
    data: {
      webhookEventId: inserted.id,
      stripeEventId: event.id,
      eventType: event.type,
      connectedAccountId,
      merchantId,
    },
  });

  return NextResponse.json({ received: true });
}
