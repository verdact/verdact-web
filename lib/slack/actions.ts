'use server';

import { redirect } from 'next/navigation';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { tryDecryptToken } from '@/lib/crypto';
import { revokeSlackToken } from '@/lib/slack/api';

// Mirrors disconnectStripeAction: best-effort provider revoke, then a SOFT
// status change. Never hard-delete - provenance on already-imported Slack
// evidence stays intact and the unique (merchant_id, slack_team_id) key is kept
// for reconnect.
export async function disconnectSlackAction() {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) redirect('/dashboard');

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from('slack_connections')
    .select('id, access_token_encrypted, token_key_version')
    .eq('merchant_id', membership.merchant.id)
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) redirect('/settings');

  const decrypted = tryDecryptToken(connection.access_token_encrypted, connection.token_key_version);
  if (decrypted.ok) {
    try {
      await revokeSlackToken(decrypted.plaintext);
    } catch (err) {
      console.error('[slack/disconnect] auth.revoke failed (marking revoked anyway):', err);
    }
  }

  await supabase
    .from('slack_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', connection.id);

  redirect('/settings?slack=disconnected');
}
