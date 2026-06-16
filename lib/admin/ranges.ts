import type { SeriesPoint } from './series';

/**
 * Global time-range model for founder-console trends.
 *
 * Pure and UTC-only so it can run on the server or the client. Generalizes the
 * daily bucketing in `series.ts` (`bucketByDay`) to hour / day / week / month
 * granularity. Every series is zero-filled and oldest-first so charts have a
 * stable, gap-free x-axis. The final bucket is always the in-progress (and thus
 * incomplete) period — callers may render it dashed.
 */

/** Selectable range keys, ordered shortest to longest. */
export type RangeKey = '1d' | '1w' | '1m' | '1q' | '1y' | 'lifetime';

/** Bucket granularity used to aggregate counts within a window. */
export type Bucket = 'hour' | 'day' | 'week' | 'month';

/** Static config for a single range. */
export interface RangeConfig {
  key: RangeKey;
  label: string;
  shortLabel: string;
  /** Window length in days, or `null` for lifetime (since earliest row). */
  windowDays: number | null;
  bucket: Bucket;
  /** Number of buckets to render; for lifetime this is a dynamic cap. */
  bucketCount: number;
}

/** A resolved, concrete time window. */
export interface ResolvedWindow {
  sinceMs: number;
  untilMs: number;
  bucket: Bucket;
  label: string;
}

/** A bare prior-comparison window of equal span. */
export interface PriorWindow {
  sinceMs: number;
  untilMs: number;
}

/** Current vs prior counts plus their signed delta. */
export interface CompareCount {
  current: number;
  prior: number;
  delta: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Max months rendered for lifetime so old vaults stay chart-friendly. */
const LIFETIME_MAX_MONTHS = 36;
/** Sane floor for lifetime when no earliest row is known (12 months back). */
const LIFETIME_FALLBACK_MONTHS = 12;

/** Ordered range keys (shortest to longest). */
export const RANGE_KEYS: readonly RangeKey[] = [
  '1d',
  '1w',
  '1m',
  '1q',
  '1y',
  'lifetime',
];

/** Static config for every range, keyed by `RangeKey`. */
export const RANGES: Record<RangeKey, RangeConfig> = {
  '1d': {
    key: '1d',
    label: 'Last 24 hours',
    shortLabel: '1D',
    windowDays: 1,
    bucket: 'hour',
    bucketCount: 24,
  },
  '1w': {
    key: '1w',
    label: 'Last 7 days',
    shortLabel: '1W',
    windowDays: 7,
    bucket: 'day',
    bucketCount: 7,
  },
  '1m': {
    key: '1m',
    label: 'Last 30 days',
    shortLabel: '1M',
    windowDays: 30,
    bucket: 'day',
    bucketCount: 30,
  },
  '1q': {
    key: '1q',
    label: 'Last 13 weeks',
    shortLabel: '1Q',
    windowDays: 91,
    bucket: 'week',
    bucketCount: 13,
  },
  '1y': {
    key: '1y',
    label: 'Last 12 months',
    shortLabel: '1Y',
    windowDays: 365,
    bucket: 'month',
    bucketCount: 12,
  },
  lifetime: {
    key: 'lifetime',
    label: 'All time',
    shortLabel: 'All',
    windowDays: null,
    bucket: 'month',
    bucketCount: LIFETIME_MAX_MONTHS,
  },
};

/** Start of the UTC hour containing `ms`. */
function startOfUtcHour(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
  );
}

/** Start of the UTC day containing `ms`. */
function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Start of the UTC week containing `ms`. Weeks are Monday-anchored
 * (ISO convention) so week boundaries are stable regardless of locale.
 */
function startOfUtcWeek(ms: number): number {
  const dayStart = startOfUtcDay(ms);
  const dow = new Date(dayStart).getUTCDay(); // 0 = Sun ... 6 = Sat
  const sinceMonday = (dow + 6) % 7; // days since Monday
  return dayStart - sinceMonday * DAY_MS;
}

/** Start of the UTC month containing `ms`. */
function startOfUtcMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Snap `ms` to the start of its bucket period (UTC). */
function startOfBucket(ms: number, bucket: Bucket): number {
  switch (bucket) {
    case 'hour':
      return startOfUtcHour(ms);
    case 'day':
      return startOfUtcDay(ms);
    case 'week':
      return startOfUtcWeek(ms);
    case 'month':
      return startOfUtcMonth(ms);
  }
}

/** Advance `ms` forward by `steps` bucket periods (UTC, calendar-aware). */
function addBuckets(ms: number, bucket: Bucket, steps: number): number {
  switch (bucket) {
    case 'hour':
      return ms + steps * HOUR_MS;
    case 'day':
      return ms + steps * DAY_MS;
    case 'week':
      return ms + steps * 7 * DAY_MS;
    case 'month': {
      const d = new Date(ms);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + steps, 1);
    }
  }
}

/** Number of whole calendar months between two UTC instants. */
function monthsBetween(fromMs: number, toMs: number): number {
  const from = new Date(fromMs);
  const to = new Date(toMs);
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

/** Stable x-axis key for a bucket start. */
function bucketKey(ms: number, bucket: Bucket): string {
  const iso = new Date(ms).toISOString();
  // hour: yyyy-mm-ddThh; day/week: yyyy-mm-dd; month: yyyy-mm.
  if (bucket === 'hour') return iso.slice(0, 13);
  if (bucket === 'month') return iso.slice(0, 7);
  return iso.slice(0, 10);
}

/**
 * Resolve a range key to a concrete UTC window. For `lifetime`, the window
 * starts at the earliest-row month (capped to {@link LIFETIME_MAX_MONTHS}) or a
 * sane fallback floor when no earliest row is provided.
 */
export function resolveWindow(
  key: RangeKey,
  now: number,
  earliestMs?: number | null,
): ResolvedWindow {
  const config = RANGES[key];

  if (key !== 'lifetime' && config.windowDays !== null) {
    const untilMs = now;
    const sinceMs = now - config.windowDays * DAY_MS;
    return { sinceMs, untilMs, bucket: config.bucket, label: config.label };
  }

  // Lifetime: align to month buckets, capped to LIFETIME_MAX_MONTHS.
  const untilMs = now;
  const fallbackFloor = addBuckets(
    startOfUtcMonth(now),
    'month',
    -(LIFETIME_FALLBACK_MONTHS - 1),
  );
  const rawStart =
    earliestMs != null && Number.isFinite(earliestMs)
      ? startOfUtcMonth(earliestMs)
      : fallbackFloor;
  const capFloor = addBuckets(
    startOfUtcMonth(now),
    'month',
    -(LIFETIME_MAX_MONTHS - 1),
  );
  const sinceMs = Math.max(rawStart, capFloor);
  return { sinceMs, untilMs, bucket: 'month', label: config.label };
}

/**
 * The immediately-preceding comparison window of equal span. For fixed ranges
 * this is `[since - span, since)`. Lifetime has no true prior period, so this
 * returns a best-effort window of equal span ending where the current window
 * begins.
 */
export function priorWindow(key: RangeKey, now: number): PriorWindow {
  const config = RANGES[key];

  if (key !== 'lifetime' && config.windowDays !== null) {
    const spanMs = config.windowDays * DAY_MS;
    const untilMs = now - spanMs;
    const sinceMs = untilMs - spanMs;
    return { sinceMs, untilMs };
  }

  // Lifetime: mirror the resolved current span immediately before it.
  const current = resolveWindow('lifetime', now, null);
  const spanMs = current.untilMs - current.sinceMs;
  return { sinceMs: current.sinceMs - spanMs, untilMs: current.sinceMs };
}

/** How many buckets fit in the resolved window, used to zero-fill the axis. */
function bucketCountFor(window: ResolvedWindow, key: RangeKey): number {
  if (key !== 'lifetime') return RANGES[key].bucketCount;
  const months = monthsBetween(window.sinceMs, window.untilMs) + 1;
  return Math.max(1, Math.min(months, LIFETIME_MAX_MONTHS));
}

/**
 * Bucket timestamped rows across the resolved window at the range's
 * granularity. Always returns a zero-filled, oldest-first series with a stable
 * x-axis. The final bucket is the in-progress (incomplete) period.
 *
 * Generalizes `series.ts` `bucketByDay` to hour / day / week / month (UTC).
 */
export function buildSeries(
  rows: ReadonlyArray<{ created_at: string }>,
  key: RangeKey,
  now: number,
  earliestMs?: number | null,
): SeriesPoint[] {
  const window = resolveWindow(key, now, earliestMs);
  const { bucket } = window;

  const counts = new Map<string, number>();
  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) continue;
    if (t < window.sinceMs || t > window.untilMs) continue;
    const k = bucketKey(startOfBucket(t, bucket), bucket);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const total = bucketCountFor(window, key);
  // Anchor on the bucket containing `now` and walk backwards so the last point
  // is the in-progress period.
  const lastStart = startOfBucket(window.untilMs, bucket);
  const points: SeriesPoint[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const start = addBuckets(lastStart, bucket, -i);
    const k = bucketKey(start, bucket);
    points.push({ date: k, value: counts.get(k) ?? 0 });
  }
  return points;
}

/** Count rows whose `created_at` falls within `[since, until]`. */
function countInWindow(
  rows: ReadonlyArray<{ created_at: string }>,
  sinceMs: number,
  untilMs: number,
): number {
  let n = 0;
  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) continue;
    if (t >= sinceMs && t <= untilMs) n += 1;
  }
  return n;
}

/**
 * Compare the current window against the immediately-preceding window of equal
 * span, returning current / prior counts and their signed delta.
 */
export function compareCount(
  rows: ReadonlyArray<{ created_at: string }>,
  key: RangeKey,
  now: number,
): CompareCount {
  const current = resolveWindow(key, now, null);
  const prior = priorWindow(key, now);
  const currentCount = countInWindow(rows, current.sinceMs, current.untilMs);
  const priorCount = countInWindow(rows, prior.sinceMs, prior.untilMs);
  return {
    current: currentCount,
    prior: priorCount,
    delta: currentCount - priorCount,
  };
}
