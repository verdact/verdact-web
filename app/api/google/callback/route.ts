import { NextRequest, NextResponse } from 'next/server';
import {
  appBaseUrl,
  encryptForCookie,
  GMAIL_REVIEWER_COOKIE,
  GMAIL_TOKEN_COOKIE,
  GOOGLE_STATE_COOKIE,
  isProductionUrl,
  REVIEWER_COOKIE,
} from '../../../../lib/reviewer';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

export async function GET(request: NextRequest) {
  const baseUrl = appBaseUrl(request.url);

  if (request.cookies.get(REVIEWER_COOKIE)?.value !== '1') {
    return NextResponse.redirect(new URL('/signin?from=/settings/connections', baseUrl));
  }

  const error = request.nextUrl.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL('/settings/connections?error=google_denied', baseUrl));
  }

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/settings/connections?error=missing_code', baseUrl));
  }

  const returnedState = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL('/settings/connections?error=state', baseUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings/connections?error=missing_google_config', baseUrl));
  }

  const redirectUri = `${baseUrl}/api/google/callback`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return NextResponse.redirect(new URL('/settings/connections?error=token', baseUrl));
  }

  const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  let profile: GmailProfileResponse = {};
  if (profileResponse.ok) {
    profile = (await profileResponse.json()) as GmailProfileResponse;
  }

  const response = NextResponse.redirect(new URL('/evidence/import?gmail=connected', baseUrl));
  response.cookies.set(
    GMAIL_REVIEWER_COOKIE,
    JSON.stringify({
      email: profile.emailAddress || 'connected',
      verifiedAt: new Date().toISOString(),
    }),
    {
      httpOnly: true,
      maxAge: 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: isProductionUrl(baseUrl),
    },
  );
  response.cookies.set(GMAIL_TOKEN_COOKIE, encryptForCookie(tokenPayload.access_token), {
    httpOnly: true,
    maxAge: 60 * 20,
    path: '/',
    sameSite: 'lax',
    secure: isProductionUrl(baseUrl),
  });
  response.cookies.delete(GOOGLE_STATE_COOKIE);

  return response;
}
