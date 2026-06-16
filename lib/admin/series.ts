import 'server-only';

export type SeriesPoint = { date: string; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10); // yyyy-mm-dd (UTC)
}

/**
 * Bucket timestamped rows into `days` consecutive daily counts ending today
 * (UTC). Always returns exactly `days` points, zero-filled, oldest first — so
 * charts have a stable, gap-free x-axis.
 */
export function bucketByDay(
  rows: ReadonlyArray<{ created_at: string }>,
  days: number,
  now: number = Date.now(),
): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) continue;
    const key = utcDayKey(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const todayStart = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );

  const points: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = utcDayKey(todayStart - i * DAY_MS);
    points.push({ date: key, value: counts.get(key) ?? 0 });
  }
  return points;
}

/** Cumulative running total of a daily series (for growth curves). */
export function cumulative(points: SeriesPoint[], baseline = 0): SeriesPoint[] {
  let total = baseline;
  return points.map((p) => {
    total += p.value;
    return { date: p.date, value: total };
  });
}

/** Sum the values in a series. */
export function sumSeries(points: SeriesPoint[]): number {
  return points.reduce((sum, p) => sum + p.value, 0);
}
