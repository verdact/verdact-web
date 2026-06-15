import { NextRequest, NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/crypto';
import { exchangeSlackOAuthCode } from '@/lib/slack/api';

// Mirrors /api/stripe/connect/callback. Validates the signed-state cookie before
// any work, then exchanges the code for a USER token and stores it encrypted.
// CRITICAL Slack-vs-Stripe difference: Slack returns HTTP 200 with { ok: false }
// on failure, so we must check ok before persisting. No post-connect workspace
// read or Inngest event is fired - connecting stores a token and nothing else
// (no-auto-slurp lock).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const to = (path: string) => new URL(path, origin);

  if (error) return NextResponse.redirect(to('/settings?slack_error=denied'));

  const storedState = request.cookies.get('slack_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(to('/settings?slack_error=invalid_state'));
  }
  if (!code) return NextResponse.redirect(to('/settings?slack_error=no_code'));

  await verifySession();

  const membership = await getMerchant();
  if (!membership) return NextResponse.redirect(to('/settings?slack_error=no_merchant'));

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(to('/settings?slack_error=not_configured'));
  }

  const redirectUri = `${origin}/api/slack/connect/callback`;

  let exchange;
  try {
    exchange = await exchangeSlackOAuthCode({ clientId, clientSecret, code, redirectUri });
  } catch (err) {
    console.error('[slack/connect/callback] Token exchange request failed:', err);
    return NextResponse.redirect(to('/settings?slack_error=exchange_failed'));
  }

  const userToken = exchange.authed_user?.access_token;
  const teamId = exchange.team?.id;
  if (!exchange.ok || !userToken || !teamId) {
    console.error('[slack/connect/callback] oauth.v2.access not ok:', exchange.error ?? 'missing_user_token_or_team');
    return NextResponse.redirect(to('/settings?slack_error=exchange_failed'));
  }

  const { encryptedText, keyVersion } = encryptToken(userToken);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: dbError } = await supabase.from('slack_connections').upsert(
    {
      merchant_id: membership.merchant.id,
      slack_team_id: teamId,
      slack_team_name: exchange.team?.name ?? null,
      slack_user_id: exchange.authed_user?.id ?? null,
      access_token_encrypted: encryptedText,
      token_key_version: keyVersion,
      token_scope: exchange.authed_user?.scope ?? null,
      status: 'connected',
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'merchant_id,slack_team_id' },
  );

  if (dbError) {
    console.error('[slack/connect/callback] DB error:', dbError.message);
    return NextResponse.redirect(to('/settings?slack_error=db_error'));
  }

  const res = NextResponse.redirect(to('/settings?connected=slack'));
  res.cookies.delete('slack_oauth_state');
  return res;
}
