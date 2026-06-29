import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LAST_ACTIVE_COOKIE, SESSION_START_COOKIE } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
  // Clear the session-timeout tracking cookies so a later login starts a clean
  // window (a surviving stale session_start would trip a spurious bounce).
  response.cookies.set(LAST_ACTIVE_COOKIE, '', { path: '/', maxAge: 0 });
  response.cookies.set(SESSION_START_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
