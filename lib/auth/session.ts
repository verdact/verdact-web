import type { NextRequest, NextResponse } from 'next/server';

/**
 * Idle + absolute session caps layered on top of Supabase auth.
 *
 * Supabase issues a 400-day auth cookie with silent token refresh, so without
 * this layer a login is effectively permanent until explicit sign-out. This
 * module adds a server-enforced activity window: an idle timeout (no requests
 * for N minutes) and an absolute cap (session older than M minutes), tracked
 * via two httpOnly cookies and enforced in proxy.ts.
 *
 * Enforced in proxy.ts which runs in the Edge runtime — keep this module
 * Edge-safe: no `next/headers`, no Node-only APIs. `Date.now()` and cookie
 * reads/writes are all Edge-compatible.
 */

function readMinutesEnv(name: string, fallbackMinutes: number): number {
  const raw = process.env[name];
  if (!raw) return fallbackMinutes;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallbackMinutes;
}

// Idle: no authenticated request for this long → require re-login.
const IDLE_TIMEOUT_MS = readMinutesEnv('VERDACT_SESSION_IDLE_MINUTES', 30) * 60_000;
// Absolute: a session older than this is always re-authenticated, active or not.
const ABSOLUTE_TIMEOUT_MS = readMinutesEnv('VERDACT_SESSION_ABSOLUTE_MINUTES', 12 * 60) * 60_000;

export const LAST_ACTIVE_COOKIE = 'verdact_last_active';
export const SESSION_START_COOKIE = 'verdact_session_start';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function parseTs(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export interface SessionTimeoutResult {
  expired: boolean;
  /** The session-start epoch (ms) to re-stamp; defaults to now on first request. */
  sessionStart: number;
}

/**
 * Decide whether the current authenticated session has exceeded the idle or
 * absolute cap. On the first authenticated request after this ships (no cookies
 * yet), the clock starts now and the session is treated as fresh.
 */
export function checkSessionTimeout(request: NextRequest): SessionTimeoutResult {
  const now = Date.now();
  const lastActive = parseTs(request.cookies.get(LAST_ACTIVE_COOKIE)?.value);
  const sessionStart = parseTs(request.cookies.get(SESSION_START_COOKIE)?.value);

  // No tracking cookies yet → begin the window now, not expired.
  if (lastActive === null || sessionStart === null) {
    return { expired: false, sessionStart: sessionStart ?? now };
  }

  if (now - lastActive > IDLE_TIMEOUT_MS) return { expired: true, sessionStart };
  if (now - sessionStart > ABSOLUTE_TIMEOUT_MS) return { expired: true, sessionStart };

  return { expired: false, sessionStart };
}

/** Stamp the sliding last-active timestamp + (stable) session-start on the response. */
export function applySessionCookies(response: NextResponse, sessionStart: number): void {
  const now = Date.now();
  response.cookies.set(LAST_ACTIVE_COOKIE, String(now), {
    ...COOKIE_OPTS,
    maxAge: Math.ceil(IDLE_TIMEOUT_MS / 1000),
  });
  response.cookies.set(SESSION_START_COOKIE, String(sessionStart), {
    ...COOKIE_OPTS,
    maxAge: Math.ceil(ABSOLUTE_TIMEOUT_MS / 1000),
  });
}

/**
 * Expire our tracking cookies AND the Supabase auth cookies so a timed-out
 * session forces a real re-login (clearing only our cookies would leave the
 * 400-day Supabase refresh token usable). Supabase cookies are named
 * `sb-<ref>-auth-token` and may be chunked (`.0`, `.1`); clear by `sb-` prefix.
 */
export function clearAuthAndSessionCookies(request: NextRequest, response: NextResponse): void {
  response.cookies.set(LAST_ACTIVE_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
  response.cookies.set(SESSION_START_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 });
    }
  }
}
