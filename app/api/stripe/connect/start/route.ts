import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/dal';

export async function GET(request: NextRequest) {
  await verifySession();

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    console.error('[stripe/connect/start] STRIPE_CLIENT_ID not set');
    return NextResponse.redirect(
      new URL('/dashboard?stripe_error=not_configured', request.url),
    );
  }

  const state = randomBytes(16).toString('hex');
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/stripe/connect/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    state,
    redirect_uri: redirectUri,
  });

  const res = NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`,
  );
  res.cookies.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
