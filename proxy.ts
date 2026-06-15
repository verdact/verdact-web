import { updateSession } from './lib/supabase/middleware';
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
    pathname.startsWith('/settings/')
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
