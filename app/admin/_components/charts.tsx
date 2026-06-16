import type { SeriesPoint } from '@/lib/admin/series';
import s from '../admin.module.css';

export type Tone = 'verdict' | 'gap' | 'neutral';

// ── Sparkline (SVG line + area), for KPI tiles ───────────────────────────────

export function Sparkline({
  points,
  width = 132,
  height = 38,
  tone = 'verdict',
}: {
  points: SeriesPoint[];
  width?: number;
  height?: number;
  tone?: Tone;
}) {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.value / max) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      className={`${s.spark} ${toneClass(tone, 'spark')}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} className={s.sparkArea} />
      <path d={line} className={s.sparkLine} fill="none" />
    </svg>
  );
}

// ── Vertical bar series (CSS bars), for trends ───────────────────────────────

export function BarSeries({
  points,
  height = 132,
  tone = 'verdict',
  formatLabel,
}: {
  points: SeriesPoint[];
  height?: number;
  tone?: Tone;
  formatLabel?: (p: SeriesPoint) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={s.barSeries} style={{ height }}>
      {points.map((p, i) => {
        const pct = (p.value / max) * 100;
        const title = formatLabel ? formatLabel(p) : `${p.date}: ${p.value}`;
        return (
          <div key={`${p.date}-${i}`} className={s.barCol} title={title}>
            <div
              className={`${s.bar} ${toneClass(tone, 'bar')}`}
              style={{ height: `${Math.max(pct, p.value > 0 ? 3 : 0)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Funnel (horizontal conversion bars) ──────────────────────────────────────

export type FunnelStep = { label: string; value: number };

export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <div className={s.funnel}>
      {steps.map((step, i) => {
        const widthPct = (step.value / top) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((step.value / prev) * 100) : null;
        return (
          <div key={step.label} className={s.funnelRow}>
            <div className={s.funnelHead}>
              <span className={s.funnelLabel}>{step.label}</span>
              <span className={s.funnelValue}>{step.value.toLocaleString('en-US')}</span>
            </div>
            <div className={s.funnelTrack}>
              <div className={s.funnelFill} style={{ width: `${Math.max(widthPct, 2)}%` }} />
            </div>
            {conv != null ? <span className={s.funnelConv}>{conv}% from previous</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Donut (SVG), for categorical splits ──────────────────────────────────────

export type DonutSegment = { label: string; value: number; tone: Tone };

export function Donut({
  segments,
  size = 148,
  thickness = 20,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={s.donutWrap}>
      <svg className={s.donut} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <circle
          className={s.donutTrack}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((seg) => {
            const fraction = seg.value / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={seg.label}
                className={toneClass(seg.tone, 'donut')}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += dash;
            return el;
          })}
        {centerValue ? (
          <text className={s.donutCenterValue} x="50%" y="48%" textAnchor="middle">
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text className={s.donutCenterLabel} x="50%" y="62%" textAnchor="middle">
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className={s.legend}>
        {segments.map((seg) => (
          <li key={seg.label} className={s.legendItem}>
            <span className={`${s.legendDot} ${toneClass(seg.tone, 'dot')}`} aria-hidden="true" />
            <span className={s.legendLabel}>{seg.label}</span>
            <span className={s.legendValue}>{seg.value.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── KPI stat card ────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  delta,
  spark,
  sparkTone = 'verdict',
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  spark?: SeriesPoint[];
  sparkTone?: Tone;
}) {
  return (
    <div className={s.statCard}>
      <div className={s.statTop}>
        <span className={s.metricLabel}>{label}</span>
        {delta != null ? <DeltaBadge delta={delta} /> : null}
      </div>
      <strong className={s.statValue}>{value}</strong>
      {spark && spark.length > 0 ? <Sparkline points={spark} tone={sparkTone} /> : null}
      {sub ? <span className={s.statSub}>{sub}</span> : null}
    </div>
  );
}

export function DeltaBadge({ delta, suffix }: { delta: number; suffix?: string }) {
  const up = delta >= 0;
  return (
    <span className={`${s.deltaBadge} ${up ? s.deltaUp : s.deltaDown}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {Math.round(delta).toLocaleString('en-US')}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

// ── Horizontal value bar (for cost breakdown / distributions) ────────────────

export function ValueBar({
  label,
  valueLabel,
  fraction,
  tone = 'verdict',
}: {
  label: string;
  valueLabel: string;
  fraction: number;
  tone?: Tone;
}) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div className={s.valueBar}>
      <div className={s.valueBarHead}>
        <span className={s.valueBarLabel}>{label}</span>
        <span className={s.valueBarValue}>{valueLabel}</span>
      </div>
      <div className={s.valueBarTrack}>
        <div className={`${s.valueBarFill} ${toneClass(tone, 'bar')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function toneClass(tone: Tone, kind: 'spark' | 'bar' | 'donut' | 'dot'): string {
  const map: Record<Tone, Record<typeof kind, string>> = {
    verdict: { spark: s.toneVerdict, bar: s.barVerdict, donut: s.donutVerdict, dot: s.dotVerdict },
    gap: { spark: s.toneGap, bar: s.barGap, donut: s.donutGap, dot: s.dotGap },
    neutral: { spark: s.toneNeutral, bar: s.barNeutral, donut: s.donutNeutral, dot: s.dotNeutral },
  };
  return map[tone][kind];
}
