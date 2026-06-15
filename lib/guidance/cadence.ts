/**
 * Tip cadence (Persona + Tip Cadence build §4.3, founder sign-off §0).
 *
 * Pure, DB-free time math the dashboard wrapper feeds into the engine. The
 * caller reads recent guidance_impressions and asks which non-urgent band rules
 * are still resting. Urgent rules (deadline / account-risk) are decided by the
 * engine and never passed here as suppressed.
 *
 * Cadence (founder sign-off):
 *   - non-urgent shown tip rests ~24h — but the rest only carries to a LATER
 *     calendar day, so same-day refreshes keep the tip visible (no mid-session
 *     cooldown). It reappears once the 24h window has fully elapsed.
 *   - dismissed tip rests 7 days from dismissal.
 *   - urgent tips are exempt (handled in the engine, not here).
 */

export const URGENT_DAYS = 3;
export const REST_WINDOW_HOURS = 24;
export const DISMISS_REST_DAYS = 7;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The slice of a guidance_impressions row the cadence math needs. */
export interface GuidanceImpression {
  rule_id: string;
  shown_at: string; // ISO timestamp
  dismissed_at: string | null;
}

/**
 * Which non-urgent band rule ids are still inside their rest window and should
 * be withheld this render. Considers only each rule's latest impression.
 */
export function computeSuppressedRuleIds(
  impressions: readonly GuidanceImpression[],
  nowMs: number,
): Set<string> {
  const latest = latestPerRule(impressions);
  const suppressed = new Set<string>();

  for (const [ruleId, imp] of latest) {
    const shownMs = Date.parse(imp.shown_at);
    if (Number.isNaN(shownMs)) continue;

    if (imp.dismissed_at) {
      const dismissedMs = Date.parse(imp.dismissed_at);
      // Dismissal is deliberate, so the rest is a plain rolling 7-day window.
      if (!Number.isNaN(dismissedMs) && nowMs < dismissedMs + DISMISS_REST_DAYS * DAY_MS) {
        suppressed.add(ruleId);
      }
      continue;
    }

    // Shown (not dismissed): withhold only once a new UTC day has begun and we
    // are still inside the 24h window. Same-day refreshes never suppress.
    if (utcDayIndex(shownMs) < utcDayIndex(nowMs) && nowMs < shownMs + REST_WINDOW_HOURS * HOUR_MS) {
      suppressed.add(ruleId);
    }
  }

  return suppressed;
}

/** Rule ids that already have an impression on the same UTC day as nowMs. */
export function ruleIdsShownOnDay(
  impressions: readonly GuidanceImpression[],
  nowMs: number,
): Set<string> {
  const today = utcDayIndex(nowMs);
  const ids = new Set<string>();
  for (const imp of impressions) {
    const shownMs = Date.parse(imp.shown_at);
    if (!Number.isNaN(shownMs) && utcDayIndex(shownMs) === today) {
      ids.add(imp.rule_id);
    }
  }
  return ids;
}

function latestPerRule(
  impressions: readonly GuidanceImpression[],
): Map<string, GuidanceImpression> {
  const latest = new Map<string, GuidanceImpression>();
  for (const imp of impressions) {
    const prev = latest.get(imp.rule_id);
    if (!prev || Date.parse(imp.shown_at) > Date.parse(prev.shown_at)) {
      latest.set(imp.rule_id, imp);
    }
  }
  return latest;
}

function utcDayIndex(ms: number): number {
  return Math.floor(ms / DAY_MS);
}
