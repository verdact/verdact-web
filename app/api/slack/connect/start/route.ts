import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/dal';
import { SLACK_USER_SCOPES } from '@/lib/slack/api';

// Mirrors /api/stripe/connect/start: signed-state CSRF cookie + provider
// authorize redirect. Self-guarded by verifySession (the /api/* path is not in
// proxy.ts isProtectedPath).
export async function GET(request: NextRequest) {
  await verifySession();

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    console.error('[slack/connect/start] SLACK_CLIENT_ID not set');
    return NextResponse.redirect(new URL('/settings?slack_error=not_configured', request.url));
  }

  const state = randomBytes(16).toString('hex');
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/slack/connect/callback`;

  // user_scope (not scope): we request a USER token via authed_user.access_token
  // so reads run on the merchant's own channel membership with no per-channel
  // bot invite. Leave the bot `scope` empty.
  const params = new URLSearchParams({
    client_id: clientId,
    user_scope: SLACK_USER_SCOPES.join(','),
    state,
    redirect_uri: redirectUri,
  });

  const res = NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
  res.cookies.set('slack_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
