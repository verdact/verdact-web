import type { SupabaseClient } from '@supabase/supabase-js';
import { tryDecryptToken } from '@/lib/crypto';

export interface ConnectedSlack {
  connectionId: string;
  teamName: string | null;
  token: string;
}

/**
 * Load and decrypt the merchant's active Slack user token under the caller's
 * RLS-scoped client. Returns null if there is no connected workspace, or if the
 * stored token can no longer be decrypted (key rotated out / corrupt) - in which
 * case the row is soft-revoked so the UI prompts a reconnect, mirroring
 * rotate-token-keys. The raw token never leaves the server.
 */
export async function loadConnectedSlackToken(
  supabase: SupabaseClient,
  merchantId: string,
): Promise<ConnectedSlack | null> {
  const { data } = await supabase
    .from('slack_connections')
    .select('id, slack_team_name, access_token_encrypted, token_key_version')
    .eq('merchant_id', merchantId)
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const decrypted = tryDecryptToken(data.access_token_encrypted, data.token_key_version);
  if (!decrypted.ok) {
    await supabase
      .from('slack_connections')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', data.id);
    return null;
  }

  return { connectionId: data.id, teamName: data.slack_team_name ?? null, token: decrypted.plaintext };
}
