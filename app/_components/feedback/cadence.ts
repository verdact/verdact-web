/**
 * Periodic-prompt cadence engine (spec 1.3 — the "non-annoying" contract).
 *
 * All state lives in ONE localStorage key, `verdact.fbk`. The prompt shows only
 * when EVERY gate holds:
 *   - engagement gate: 3rd+ app session (never first run),
 *   - not blocking: never within the first 45s of a page, never while a modal /
 *     cmdk / dialog is open (checked by the caller),
 *   - rests after interaction: dismiss = 30 days, "Maybe later" = 7 days,
 *     submit = 90 days,
 *   - frequency cap: at most once per session, never more than once / 30 days.
 *
 * Pure + dependency-free so it is trivially testable and SSR-safe (every read
 * guards `typeof window`).
 */

export const CADENCE_KEY = 'verdact.fbk';

const DAY = 24 * 60 * 60 * 1000;
export const REST_DISMISS_MS = 30 * DAY; // "No thanks" / X
export const REST_LATER_MS = 7 * DAY; // "Maybe later"
export const REST_SUBMIT_MS = 90 * DAY; // a submission
export const SESSION_GATE = 3; // show only on the 3rd+ session
export const PAGE_DELAY_MS = 45 * 1000; // never within the first 45s of a page
export const AUTO_HIDE_MS = 20 * 1000; // auto-hide after ~20s idle (not a dismiss)

const SESSION_FLAG = 'verdact.fbk.session';

export interface Cadence {
  lastShown: number;
  lastDismissed: number;
  lastSubmitted: number;
  snoozedUntil: number;
  sessionCount: number;
}

const EMPTY: Cadence = {
  lastShown: 0,
  lastDismissed: 0,
  lastSubmitted: 0,
  snoozedUntil: 0,
  sessionCount: 0,
};

export function readCadence(): Cadence {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(CADENCE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Cadence>;
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function writeCadence(next: Cadence): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CADENCE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode / quota) — degrade silently */
  }
}

/** Record a rest window after an interaction (dismiss / later / submit). */
export function restPrompt(field: 'lastDismissed' | 'lastSubmitted', ms: number, now = Date.now()): void {
  const c = readCadence();
  writeCadence({ ...c, [field]: now, snoozedUntil: now + ms });
}

/** Increment the session count once per browser session; returns the cadence. */
export function bumpSession(): Cadence {
  const c = readCadence();
  if (typeof window === 'undefined') return c;
  try {
    if (!window.sessionStorage.getItem(SESSION_FLAG)) {
      window.sessionStorage.setItem(SESSION_FLAG, '1');
      const next = { ...c, sessionCount: (c.sessionCount ?? 0) + 1 };
      writeCadence(next);
      return next;
    }
  } catch {
    /* sessionStorage unavailable — treat as a fresh session, no increment */
  }
  return c;
}

/** True if all cadence gates pass (caller still checks for open overlays). */
export function isCadenceEligible(now = Date.now()): boolean {
  const c = bumpSession();
  if (c.snoozedUntil && now < c.snoozedUntil) return false; // resting
  if (c.lastShown && now - c.lastShown < REST_DISMISS_MS) return false; // <= 1 / 30 days
  if ((c.sessionCount ?? 0) < SESSION_GATE) return false; // engagement gate
  return true;
}

/** Mark the prompt as shown (frequency cap). */
export function markShown(now = Date.now()): void {
  const c = readCadence();
  writeCadence({ ...c, lastShown: now });
}
