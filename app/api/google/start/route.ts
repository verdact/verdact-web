import { NextRequest, NextResponse } from 'next/server';
import {
  appBaseUrl,
  GOOGLE_STATE_COOKIE,
  isProductionUrl,
  REVIEWER_COOKIE,
} from '../../../../lib/reviewer';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export function GET(request: NextRequest) {
  if (request.cookies.get(REVIEWER_COOKIE)?.value !== '1') {
    return NextResponse.redirect(new URL('/signin?from=/settings/connections', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = appBaseUrl(request.url);

  if (!clientId) {
    return NextResponse.redirect(new URL('/settings/connections?error=missing_google_config', baseUrl));
  }

  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl}/api/google/callback`;
  const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  oauthUrl.searchParams.set('client_id', clientId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', GMAIL_READONLY_SCOPE);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('access_type', 'online');
  oauthUrl.searchParams.set('prompt', 'consent');

  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure: isProductionUrl(baseUrl),
  });

  return response;
}
