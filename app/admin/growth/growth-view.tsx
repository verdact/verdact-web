'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { GrowthData, GrowthFunnel, GrowthMetric, LegacyGrowthData } from './data';
import type { SeriesPoint } from '@/lib/admin/series';
import type { CompareCount, RangeKey } from '@/lib/admin/ranges';
import { RangeTabs, Chevron } from '../_components/console';
import { DeltaBadge, Funnel } from '../_components/charts';
import { Drawer, DrawerSection, DetailRow, WhyNow } from '../_components/drawer';
import { formatNumber, formatPercentFraction } from '../_components/ui';
import s from '../admin.module.css';
import g from './growth.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// GROWTH — the trend + funnel surface. The point of this screen is to make
// movement *legible* across a global time range:
//   • A RangeTabs selector (1D…lifetime) drives ?range= and the server window.
//   • Each acquisition metric gets a trend chart whose last (in-progress) bucket
//     is rendered dashed, so a sparse "today" never reads as a real drop.
//   • Every metric shows its in-range total + a prior-period comparison.
//   • The funnel shows lead → merchant → activated conversion.
//   • A plain-English "what changed" read summarizes the window honestly.
// Clicking a trend tile opens the shared Drawer with the full reading.
// No fabricated numbers: empty / sparse windows surface as genuine zero states.
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedGrowth {
  range: RangeKey;
  rangeLabel: string;
  compareLabel: string;
  metrics: GrowthMetric[];
  funnel: GrowthFunnel;
}

export function GrowthView({ data }: { data: GrowthData | LegacyGrowthData }) {
  const model = useMemo(() => normalize(data), [data]);
  const [selectedKey, setSelectedKey] = useState<GrowthMetric['key'] | null>(null);
  const selected = model.metrics.find((m) => m.key === selectedKey) ?? null;

  // Path-aware range hrefs (no window read): identical on server + client and
  // stays on the current path, including the /dev/admin?view=growth preview.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hrefForRange = (key: RangeKey): string => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('range', key);
    return `${pathname}?${params.toString()}`;
  };

  const hasAnyVolume = model.metrics.some((m) => m.lifetimeTotal > 0);

  return (
    <div className={s.page}>
      <header className={g.toolbar}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Growth</h1>
          <p className={s.sectionLead}>
            Acquisition trends and the conversion funnel across a global time range. The
            most recent bar in every chart is the in-progress period, so it reads dashed
            and incomplete rather than as a dip.
          </p>
        </div>
        <div className={g.toolbarMeta}>
          <RangeTabs active={model.range} hrefForRange={hrefForRange} />
          <p className={g.rangeNote}>{model.rangeLabel}</p>
        </div>
      </header>

      <section className={g.trendGrid} aria-label="Acquisition trends">
        {model.metrics.map((metric) => (
          <TrendTile
            key={metric.key}
            metric={metric}
            compareLabel={model.compareLabel}
            onOpen={() => setSelectedKey(metric.key)}
          />
        ))}
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Pipeline</p>
            <h2 className={s.panelTitle}>Acquisition funnel</h2>
          </div>
          <span className={s.countPill}>
            {model.funnel.leadToMerchant != null
              ? `${formatRate(model.funnel.leadToMerchant)} lead → merchant`
              : 'No leads yet'}
          </span>
        </div>
        {model.funnel.steps.some((step) => step.value > 0) ? (
          <>
            <Funnel steps={model.funnel.steps} />
            <div className={g.convRow}>
              <div className={g.convCard}>
                <span className={g.convValue}>
                  {model.funnel.leadToMerchant != null ? formatRate(model.funnel.leadToMerchant) : 'n/a'}
                </span>
                <span className={g.convLabel}>Audit lead → merchant</span>
              </div>
              <div className={g.convCard}>
                <span className={g.convValue}>
                  {model.funnel.merchantToActivated != null ? formatRate(model.funnel.merchantToActivated) : 'n/a'}
                </span>
                <span className={g.convLabel}>Merchant → Stripe activated</span>
              </div>
            </div>
          </>
        ) : (
          <p className={s.sectionLead}>
            No one has entered the funnel yet. Leads, merchants, and activations appear here as
            they land.
          </p>
        )}
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Read</p>
            <h2 className={s.panelTitle}>What changed this {windowNoun(model.range)}</h2>
          </div>
          <span className={s.countPill}>{model.compareLabel}</span>
        </div>
        {hasAnyVolume ? (
          <div className={g.changeList}>
            {model.metrics.map((metric) => (
              <div key={metric.key} className={g.changeRow}>
                <span className={g.changeMetric}>{metric.label}</span>
                <span className={g.changeText}>{changeSentence(metric, model.compareLabel)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={s.sectionLead}>
            Nothing has been captured yet. Once signups, leads, merchants, and disputes start
            arriving, the change read fills in here.
          </p>
        )}
      </section>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedKey(null)}
        title={selected ? selected.label : ''}
        eyebrow={selected ? model.rangeLabel : undefined}
      >
        {selected ? <MetricDetail metric={selected} compareLabel={model.compareLabel} range={model.range} /> : null}
      </Drawer>
    </div>
  );
}

// ── Trend tile ───────────────────────────────────────────────────────────────

function TrendTile({
  metric,
  compareLabel,
  onOpen,
}: {
  metric: GrowthMetric;
  compareLabel: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={g.trendTile} onClick={onOpen} aria-label={`${metric.label} trend detail`}>
      <div className={g.trendTop}>
        <div>
          <span className={s.metricLabel}>{metric.label}</span>
          <p className={g.trendValue}>{formatNumber(metric.inRange)}</p>
        </div>
        <DeltaBadge delta={metric.compare.delta} />
      </div>

      <TrendChart series={metric.series} tone={metric.tone} />

      <div className={g.trendTop}>
        <span className={g.trendRangeCount}>
          <strong>{formatNumber(metric.compare.prior)}</strong> {compareLabel}
        </span>
        <span className={s.tileChevron} aria-hidden="true">
          <Chevron />
        </span>
      </div>
    </button>
  );
}

/**
 * Range-aware bar chart. Re-uses the shared bar CSS from admin.module.css and
 * marks the final (in-progress) bucket dashed via `s.barIncomplete`. Renders a
 * small start/end axis so a long window stays orientable.
 */
function TrendChart({ series, tone, height = 96 }: { series: SeriesPoint[]; tone: 'verdict' | 'neutral'; height?: number }) {
  const max = Math.max(1, ...series.map((p) => p.value));
  const lastIndex = series.length - 1;
  const barTone = tone === 'verdict' ? s.barVerdict : s.barNeutral;

  if (series.length === 0) {
    return <p className={s.sectionLead}>No data points in this window yet.</p>;
  }

  return (
    <div className={g.chartWrap}>
      <div className={s.barSeries} style={{ height }}>
        {series.map((point, i) => {
          const pct = (point.value / max) * 100;
          const isLast = i === lastIndex;
          const label = isLast
            ? `${point.date}: ${point.value} (in progress)`
            : `${point.date}: ${point.value}`;
          return (
            <div key={`${point.date}-${i}`} className={s.barCol} title={label}>
              <div
                className={`${s.bar} ${barTone}${isLast ? ` ${s.barIncomplete}` : ''}`}
                style={{ height: `${Math.max(pct, point.value > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className={g.axisRow}>
        <span>{axisLabel(series[0]?.date)}</span>
        <span>now</span>
      </div>
    </div>
  );
}

// ── Drawer detail ─────────────────────────────────────────────────────────────

function MetricDetail({
  metric,
  compareLabel,
  range,
}: {
  metric: GrowthMetric;
  compareLabel: string;
  range: RangeKey;
}) {
  const { compare } = metric;
  const peak = metric.series.reduce<SeriesPoint | null>(
    (best, p) => (best == null || p.value > best.value ? p : best),
    null,
  );
  const completed = metric.series.slice(0, -1);
  const completedTotal = completed.reduce((n, p) => n + p.value, 0);
  const avgPerBucket = completed.length > 0 ? completedTotal / completed.length : 0;
  const trendTone = compare.delta > 0 ? 'verdict' : compare.delta < 0 ? 'gap' : 'neutral';

  return (
    <>
      <WhyNow tone={trendTone}>{changeSentence(metric, compareLabel)}</WhyNow>

      <DrawerSection title="This window">
        <DetailRow label="In range">{formatNumber(metric.inRange)}</DetailRow>
        <DetailRow label="Prior window">{formatNumber(compare.prior)}</DetailRow>
        <DetailRow label="Change">
          {compare.delta >= 0 ? '+' : ''}
          {formatNumber(compare.delta)} ({formatChangePct(compare)})
        </DetailRow>
        <DetailRow label="Lifetime total">{formatNumber(metric.lifetimeTotal)}</DetailRow>
      </DrawerSection>

      <DrawerSection title={`Trend (${range === 'lifetime' ? 'all time' : metric.series.length} buckets)`}>
        <div className={g.drawerChart}>
          <TrendChart series={metric.series} tone={metric.tone} height={120} />
        </div>
        <p className={g.incompleteNote}>
          <span className={g.incompleteSwatch} aria-hidden="true" />
          The final bar is the current, still-incomplete period.
        </p>
      </DrawerSection>

      <DrawerSection title="Shape">
        <DetailRow label="Busiest bucket">
          {peak && peak.value > 0 ? `${formatNumber(peak.value)} on ${axisLabel(peak.date)}` : 'No activity yet'}
        </DetailRow>
        <DetailRow label="Avg per completed bucket">
          {avgPerBucket > 0 ? avgPerBucket.toFixed(1) : '0'}
        </DetailRow>
      </DrawerSection>
    </>
  );
}

// ── Normalization (handles both the new loader shape and the legacy preview) ──

/** The new loader payload carries a `metrics` array; the legacy shape does not. */
function isLoaderData(data: GrowthData | LegacyGrowthData): data is GrowthData {
  return Array.isArray((data as GrowthData).metrics);
}

function normalize(data: GrowthData | LegacyGrowthData): NormalizedGrowth {
  if (isLoaderData(data)) {
    return {
      range: data.range,
      rangeLabel: data.rangeLabel,
      compareLabel: data.compareLabel,
      metrics: data.metrics,
      funnel: data.funnel,
    };
  }

  // Legacy queries-shaped payload (used by the frozen dev preview): derive
  // range-agnostic metrics from the 30-day series + totals it carries.
  const { series30, totals } = data;
  const mk = (
    key: GrowthMetric['key'],
    label: string,
    points: SeriesPoint[],
    lifetime: number,
    tone: GrowthMetric['tone'],
  ): GrowthMetric => {
    const inRange = points.reduce((n, p) => n + p.value, 0);
    return { key, label, lifetimeTotal: lifetime, inRange, series: points, compare: emptyCompare(inRange), tone };
  };

  return {
    range: '1m',
    rangeLabel: 'Last 30 days',
    compareLabel: 'vs the prior period',
    metrics: [
      mk('waitlist', 'Waitlist signups', series30.waitlist, totals.waitlist, 'verdict'),
      mk('auditLeads', 'Audit leads', series30.auditLeads, totals.auditLeads, 'verdict'),
      mk('merchants', 'Merchants', series30.merchants, totals.merchants, 'verdict'),
      mk('disputes', 'Disputes filed', series30.disputes, totals.disputes, 'neutral'),
    ],
    funnel: {
      steps: data.funnel,
      leadToMerchant: totals.auditLeads > 0 ? totals.merchants / totals.auditLeads : null,
      merchantToActivated: totals.merchants > 0 ? totals.stripeConnected / totals.merchants : null,
    },
  };
}

function emptyCompare(current: number): CompareCount {
  return { current, prior: current, delta: 0 };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatRate(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function formatChangePct(compare: CompareCount): string {
  if (compare.prior === 0) {
    return compare.current > 0 ? 'new' : 'no change';
  }
  return formatPercentFraction(compare.delta / compare.prior);
}

function windowNoun(range: RangeKey): string {
  const map: Record<RangeKey, string> = {
    '1d': 'day',
    '1w': 'week',
    '1m': 'month',
    '1q': 'quarter',
    '1y': 'year',
    lifetime: 'period',
  };
  return map[range];
}

function changeSentence(metric: GrowthMetric, compareLabel: string): string {
  const { compare } = metric;
  const noun = metric.label.toLowerCase();
  if (compare.current === 0 && compare.prior === 0) {
    return `No ${noun} in this window or the one before it.`;
  }
  if (compare.delta === 0) {
    return `Holding flat at ${formatNumber(compare.current)} ${compareLabel}.`;
  }
  const direction = compare.delta > 0 ? 'up' : 'down';
  const magnitude = Math.abs(compare.delta);
  return `${formatNumber(compare.current)} this window, ${direction} ${formatNumber(magnitude)} ${compareLabel} (${formatNumber(
    compare.prior,
  )} prior).`;
}

function axisLabel(date: string | undefined): string {
  if (!date) return '';
  // Range buckets are yyyy-mm-dd, yyyy-mm, or yyyy-mm-ddThh.
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (dayMatch) {
    const d = new Date(`${dayMatch[1]}-${dayMatch[2]}-${dayMatch[3]}T00:00:00Z`);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(date);
  if (monthMatch) {
    const d = new Date(`${monthMatch[1]}-${monthMatch[2]}-01T00:00:00Z`);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    }
  }
  return date;
}
