/**
 * Geographic / network consistency narrative (Revano teardown #1) +
 * activity-pattern timeline (Revano teardown #3).
 *
 * Pure functions over EvidenceSignals → NarrativeBlock. The thesis (from
 * Revano's sections 5/6 and Visa CE 3.0 logic): one event proves nothing, but a
 * long, consistent sequence — same account, same handful of IPs, same country
 * matching billing, steady use over weeks — is hard to fake and is exactly what
 * a reviewer rewards. Verdact submits this as a structured Stripe evidence
 * field, never a third-party PDF.
 *
 * HONESTY: a block is only `include: true` when the signal genuinely supports
 * the claim. Thin or contradictory data downgrades the block and, for geography,
 * surfaces a mismatch the merchant must see BEFORE filing.
 */

import type { EvidenceSignals, NarrativeBlock, SessionSignal } from './types';

const MIN_SESSIONS_FOR_PATTERN = 4; // below this, "a pattern" is not honest.

function countBy<T>(items: T[], key: (t: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function topEntry(m: Map<string, number>): { value: string; count: number } | null {
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of m) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Geographic & network consistency narrative. Argues same-identity continuity;
 * flags a country mismatch (billing vs sessions) as a `mismatch` block the
 * merchant must resolve before filing.
 */
export function buildGeoConsistencyNarrative(signals: EvidenceSignals): NarrativeBlock {
  const sessions = signals.sessions;
  const total = sessions.length;
  const billing = signals.billingCountry?.toUpperCase() ?? null;
  const issuing = signals.issuingCountry?.toUpperCase() ?? null;

  // Without a session pattern, fall back to the single but REAL network signal
  // available from the Stripe charge: the card's issuing country vs the billing
  // country. This needs zero usage history, so it works the moment a charge is
  // enriched — and surfaces a genuine fraud flag if the two disagree.
  if (total < MIN_SESSIONS_FOR_PATTERN) {
    return geoFromIssuingCountry(billing, issuing);
  }

  const byCountry = countBy(sessions, (s) => s.country);
  const byIp = countBy(sessions, (s) => s.ip);
  const topCountry = topEntry(byCountry);
  const topIp = topEntry(byIp);

  // Mismatch: billing country known and the dominant session country differs.
  if (billing && topCountry && topCountry.value.toUpperCase() !== billing) {
    return {
      id: 'geo-consistency',
      heading: 'Geographic consistency',
      body:
        `The billing country on file is ${billing}, but ${pct(topCountry.count, total)}% of ${total} recorded sessions originated from ${topCountry.value}. ` +
        'A reviewer reads a billing-vs-activity country mismatch as a fraud signal. Confirm the legitimate explanation before filing, or this argument works against you.',
      severity: 'mismatch',
      include: false,
    };
  }

  const countryShare = topCountry ? pct(topCountry.count, total) : 0;
  const strong = countryShare >= 80 && Boolean(topCountry);

  const bodyParts: string[] = [];
  if (topCountry) {
    bodyParts.push(
      `${countryShare}% of ${total} recorded sessions originated from ${topCountry.value}` +
        (billing ? `, matching the ${billing} billing country.` : '.'),
    );
  }
  if (topIp) {
    bodyParts.push(
      `${topIp.count} of those sessions came from the same network address, consistent with one returning account holder rather than scattered access.`,
    );
  }
  // Corroborate with the card's issuing country when it agrees with billing.
  if (issuing && billing && issuing === billing) {
    bodyParts.push(`The card was also issued in ${issuing}, matching the billing country.`);
  }

  return {
    id: 'geo-consistency',
    heading: 'Geographic consistency',
    body: bodyParts.join(' ') || 'Session locations are consistent across the recorded history.',
    severity: strong ? 'strong' : 'present',
    include: true,
  };
}

/**
 * Geo/network narrative from the card's issuing country alone (no session
 * pattern yet). Real data from the enriched Stripe charge:
 *   - issuing === billing → a corroborating consistency point (include).
 *   - issuing !== billing → a reviewer-visible mismatch the merchant must explain.
 *   - either unknown      → honest "not enough connected" state.
 */
function geoFromIssuingCountry(billing: string | null, issuing: string | null): NarrativeBlock {
  if (billing && issuing && issuing !== billing) {
    return {
      id: 'geo-consistency',
      heading: 'Geographic consistency',
      body:
        `The card was issued in ${issuing}, but the billing country on file is ${billing}. ` +
        'A reviewer reads an issuing-vs-billing country mismatch as a fraud signal. Confirm the legitimate explanation before filing, or this argument works against you.',
      severity: 'mismatch',
      include: false,
    };
  }

  if (billing && issuing && issuing === billing) {
    return {
      id: 'geo-consistency',
      heading: 'Geographic consistency',
      body:
        `The card was issued in ${issuing}, matching the ${billing} billing country — one corroborating consistency point. ` +
        'Connect usage history to argue a sustained, same-location pattern.',
      severity: 'present',
      include: true,
    };
  }

  return {
    id: 'geo-consistency',
    heading: 'Geographic consistency',
    body:
      'Not enough location data is connected to argue a consistent pattern yet. Connect usage history, or attach the charge so the card issuing and billing countries can be compared.',
    severity: 'missing',
    include: false,
  };
}

/**
 * Activity-pattern timeline: "steady use, not one suspicious burst". Argues the
 * customer was a real, engaged user over time — undercutting "I never used this"
 * and supporting services-rendered.
 */
export function buildActivityTimelineNarrative(signals: EvidenceSignals): NarrativeBlock {
  const sessions = [...signals.sessions].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const total = sessions.length;

  if (total < MIN_SESSIONS_FOR_PATTERN) {
    return {
      id: 'activity-timeline',
      heading: 'Activity pattern',
      body:
        'Too few usage events are connected to argue a sustained engagement pattern. A handful of events is not yet a story a reviewer will weigh.',
      severity: 'missing',
      include: false,
    };
  }

  const first = sessions[0];
  const last = sessions[total - 1];
  const days = daySpan(first.at, last.at);
  const activeDays = new Set(sessions.map((s) => dayKey(s.at))).size;
  const lastBeforeDispute = signals.disputeCreatedAt
    ? new Date(last.at).getTime() <= new Date(signals.disputeCreatedAt).getTime()
    : true;

  // Mismatch: usage stopped well before the disputed charge (Revano failure mode).
  if (signals.disputeCreatedAt && days >= 0) {
    const gapDays = daySpan(last.at, signals.disputeCreatedAt);
    if (gapDays >= 21) {
      return {
        id: 'activity-timeline',
        heading: 'Activity pattern',
        body:
          `Recorded activity stopped about ${gapDays} days before the disputed charge. ` +
          'A reviewer may read the gap as the customer having stopped using the service. Investigate before leaning on the usage timeline.',
        severity: 'mismatch',
        include: false,
      };
    }
  }

  const steady = activeDays >= Math.max(4, Math.round(days / 7)) && lastBeforeDispute;

  return {
    id: 'activity-timeline',
    heading: 'Activity pattern',
    body:
      `The account was active across ${activeDays} separate days over a ${days}-day span, from ${formatDay(first.at)} to ${formatDay(last.at)}. ` +
      'This is the spread of a real, engaged user, not a single session followed by a dispute.',
    severity: steady ? 'strong' : 'present',
    include: true,
  };
}

// ─── small date helpers ──────────────────────────────────────────────────────

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function daySpan(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}

// Exported for the timeline UI: per-day session counts for a simple bar chart.
export function dailyActivityCounts(sessions: SessionSignal[]): { day: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.at);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, count]) => ({ day, count }));
}
