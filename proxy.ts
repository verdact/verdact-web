import { updateSession } from './lib/supabase/middleware';
import {
  applySessionCookies,
  checkSessionTimeout,
  clearAuthAndSessionCookies,
} from './lib/auth/session';
import { NextResponse, type NextRequest } from 'next/server';

// Optimistic auth gates. The real authorization checks live in the Data Access
// Layer (lib/dal.ts) and in route/server-action handlers; this just prevents
// unnecessary renders and provides UX-level redirects.

const AUTHED_REDIRECTS_AWAY_FROM = ['/login', '/signup'];
const REVIEWER_COOKIE_NAME = 'verdact_reviewer_session';

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/account-health' ||
    pathname.startsWith('/account-health/')
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTHED_REDIRECTS_AWAY_FROM.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isReviewerProtectedPath(pathname: string): boolean {
  return pathname === '/settings/connections';
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Idle / absolute session timeout — only for an authenticated user on a
  // protected path. The reviewer-cookie branch below fires when `!user`, so it
  // never intersects this. On timeout we clear the Supabase auth cookies too so
  // re-login is genuinely required.
  if (user && isProtectedPath(pathname)) {
    const timeout = checkSessionTimeout(request);
    if (timeout.expired) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      loginUrl.searchParams.set('reason', 'session_expired');
      const logoutResponse = NextResponse.redirect(loginUrl);
      clearAuthAndSessionCookies(request, logoutResponse);
      return logoutResponse;
    }
    applySessionCookies(response, timeout.sessionStart);
  }

  if (isProtectedPath(pathname) && !user) {
    if (
      isReviewerProtectedPath(pathname) &&
      request.cookies.get(REVIEWER_COOKIE_NAME)?.value === '1'
    ) {
      return response;
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute(pathname) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - ingest (PostHog analytics reverse-proxy — must skip auth middleware)
     * - favicon files
     * - Static assets (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|ingest|favicon\\.ico|favicon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
