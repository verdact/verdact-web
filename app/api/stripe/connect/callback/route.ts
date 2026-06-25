import { NextRequest, NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { createStripeClient } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { sendWelcomeConnectedEmail } from '@/lib/email/send';
import { ACCOUNT_HEALTH_RECOMPUTE_EVENT } from '@/lib/account-health/vamp-snapshots';
import { STRIPE_DISPUTES_BACKFILL_EVENT } from '@/lib/inngest/functions/stripe-disputes-backfill';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const to = (path: string) => new URL(path, origin);

  if (error) return NextResponse.redirect(to('/dashboard?stripe_error=denied'));

  const storedState = request.cookies.get('stripe_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(to('/dashboard?stripe_error=invalid_state'));
  }
  if (!code) return NextResponse.redirect(to('/dashboard?stripe_error=no_code'));

  const user = await verifySession();

  const membership = await getMerchant();
  if (!membership) return NextResponse.redirect(to('/dashboard?stripe_error=no_merchant'));

  const stripe = createStripeClient();
  let stripeUserId: string;
  let livemode: boolean;

  try {
    const token = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    if (!token.stripe_user_id) throw new Error('No stripe_user_id in response');
    stripeUserId = token.stripe_user_id;
    livemode = !!token.livemode;
  } catch (err) {
    console.error('[stripe/connect/callback] Token exchange failed:', err);
    return NextResponse.redirect(to('/dashboard?stripe_error=exchange_failed'));
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('processor_connections')
    .select('id, merchant_id')
    .eq('processor', 'stripe')
    .eq('processor_account_id', stripeUserId)
    .maybeSingle();

  if (existing && existing.merchant_id !== membership.merchant.id) {
    return NextResponse.redirect(to('/dashboard?stripe_error=account_in_use'));
  }

  const now = new Date().toISOString();

  const { data: savedConnection, error: dbError } = existing
    ? await supabase
        .from('processor_connections')
        .update({ connection_status: 'connected', livemode, connected_at: now, updated_at: now })
        .eq('id', existing.id)
        .select('id')
        .maybeSingle()
    : await supabase
        .from('processor_connections')
        .insert({
          merchant_id: membership.merchant.id,
          processor: 'stripe',
          processor_account_id: stripeUserId,
          connection_status: 'connected',
          livemode,
          connected_at: now,
          metadata: { schema_version: 'v1' },
        })
        .select('id')
        .maybeSingle();

  if (dbError) {
    console.error('[stripe/connect/callback] DB error:', dbError.message);
    return NextResponse.redirect(to('/dashboard?stripe_error=db_error'));
  }

  // Connecting Stripe is the activation moment, so it also completes onboarding.
  // This keeps the post-connect /dashboard redirect from bouncing back to the
  // wizard. A metadata failure must not break the connect flow, so it is logged
  // and the redirect still proceeds.
  try {
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
  } catch (metaErr) {
    console.error('[stripe/connect/callback] onboarding_completed update failed:', metaErr);
  }

  // Backfill the first account-health snapshot and recent disputes immediately
  // after connecting, instead of waiting for the daily cron or a future webhook.
  // A send failure must never break the connect redirect, so it is swallowed
  // with a log.
  const processorConnectionId = savedConnection?.id ?? existing?.id ?? null;
  if (!processorConnectionId) {
    // Both the update and the insert returned no row id (maybeSingle null). The
    // connection state is ambiguous, so skip the backfill fan-out rather than
    // sending events with an undefined connection id.
    console.error('[stripe/connect/callback] no processor_connection id after upsert; skipping backfill');
  } else {
    try {
      await inngest.send([
        {
          name: ACCOUNT_HEALTH_RECOMPUTE_EVENT,
          data: {
            merchantId: membership.merchant.id,
            processorConnectionId,
            force: true,
            source: 'connect-backfill',
          },
        },
        {
          name: STRIPE_DISPUTES_BACKFILL_EVENT,
          data: {
            merchantId: membership.merchant.id,
            processorConnectionId,
            source: 'connect-backfill',
          },
        },
      ]);
    } catch (sendErr) {
      console.error('[stripe/connect/callback] post-connect backfill send failed:', sendErr);
    }
  }

  // Welcome email on the FIRST connect only (not on reconnect of an existing
  // connection). Fire-and-forget: sendWelcomeConnectedEmail never throws and
  // no-ops when RESEND_API_KEY is unset, so a mail failure cannot block the
  // redirect into the dashboard.
  if (!existing && processorConnectionId && user.email) {
    void sendWelcomeConnectedEmail(user.email, { businessName: membership.merchant.business_name });
  }

  const res = NextResponse.redirect(to('/dashboard?connected=stripe'));
  res.cookies.delete('stripe_oauth_state');
  return res;
}
