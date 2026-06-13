'use server';

import { redirect } from 'next/navigation';
import { getMerchant, verifySession } from '@/lib/dal';
import { createStripeClient } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function disconnectStripeAction() {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) redirect('/dashboard');

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from('processor_connections')
    .select('id, processor_account_id')
    .eq('merchant_id', membership.merchant.id)
    .eq('processor', 'stripe')
    .eq('connection_status', 'connected')
    .maybeSingle();

  if (!connection) redirect('/settings');

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (clientId) {
    try {
      const stripe = createStripeClient();
      await stripe.oauth.deauthorize({
        client_id: clientId,
        stripe_user_id: connection.processor_account_id,
      });
    } catch (err) {
      console.error('[stripe/disconnect] Deauthorize failed (marking disconnected anyway):', err);
    }
  }

  await supabase
    .from('processor_connections')
    .update({
      connection_status: 'disconnected',
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  redirect('/settings?stripe=disconnected');
}
