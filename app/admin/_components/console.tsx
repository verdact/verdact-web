import type { RangeKey } from '@/lib/admin/ranges';
import { RANGE_KEYS, RANGES } from '@/lib/admin/ranges';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  type MerchantCategory,
  type CategorySource,
} from '@/lib/admin/categorize';
import s from '../admin.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Shared presentational primitives for the operating console (server-safe).
// Color is used for STATUS only (verdict-green good / vermilion bad / amber
// watch); descriptive things like category are rendered neutral.
// ─────────────────────────────────────────────────────────────────────────────

type BadgeTone = 'verdict' | 'gap' | 'amber' | 'neutral' | 'muted';

export function Badge({ tone = 'neutral', dot, children }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode }) {
  const cls =
    tone === 'verdict' ? s.badgeVerdict : tone === 'gap' ? s.badgeGap : tone === 'amber' ? s.badgeAmber : tone === 'muted' ? `${s.badge} ${s.badgeMuted}` : s.badge;
  return (
    <span className={tone === 'verdict' || tone === 'gap' || tone === 'amber' ? `${s.badge} ${cls}` : cls}>
      {dot ? <span className={s.badgeDot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Merchant category — descriptive, so neutral styling (not a status color). */
export function CategoryBadge({ category }: { category: MerchantCategory }) {
  if (category === 'uncategorized') {
    return <Badge tone="muted">Uncategorized</Badge>;
  }
  return <Badge tone="neutral" dot>{CATEGORY_LABELS[category]}</Badge>;
}

export function SourceNote({ source }: { source: CategorySource | null }) {
  if (!source) return null;
  return <span className={s.badgeMuted} style={{ fontSize: 11 }}>{SOURCE_LABELS[source]}</span>;
}

/** VAMP / audit standing band → status color. */
export function StandingBadge({ band }: { band: string | null }) {
  const b = (band ?? '').trim();
  if (b === 'healthy' || b === 'good') return <Badge tone="verdict">Healthy</Badge>;
  if (b === 'close' || b === 'getting close') return <Badge tone="amber">Getting close</Badge>;
  if (b === 'atRisk' || b === 'at_risk' || b === 'over') return <Badge tone="gap">Over the line</Badge>;
  if (b === 'tooEarly' || b === 'too_early') return <Badge tone="muted">Too early to score</Badge>;
  return <Badge tone="muted">Not scored</Badge>;
}

/** Dispute outcome / framing → status color. */
export function OutcomeBadge({ outcome }: { outcome: 'won' | 'lost' | 'warning_closed' | 'open' | string | null }) {
  if (outcome === 'won') return <Badge tone="verdict">Won</Badge>;
  if (outcome === 'lost') return <Badge tone="gap">Lost</Badge>;
  if (outcome === 'warning_closed') return <Badge tone="amber">Warning closed</Badge>;
  return <Badge tone="muted">Open</Badge>;
}

/** Propensity score chip — hot (red) at the top of the queue, warm (amber) mid. */
export function ScoreChip({ score }: { score: number }) {
  const cls = score >= 70 ? `${s.scoreChip} ${s.scoreHot}` : score >= 45 ? `${s.scoreChip} ${s.scoreWarm}` : s.scoreChip;
  return <span className={cls}>{Math.round(score)}</span>;
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.miniStat}>
      <div className={s.miniStatValue}>{value}</div>
      <div className={s.miniStatLabel}>{label}</div>
    </div>
  );
}

/**
 * Global time-range selector, rendered as links (server-friendly, deep-linkable,
 * works without JS). The page supplies the href builder so query params are
 * preserved. The selected range drives the server data window.
 */
export function RangeTabs({
  active,
  hrefForRange,
}: {
  active: RangeKey;
  hrefForRange: (key: RangeKey) => string;
}) {
  return (
    <div className={s.rangeBar} role="group" aria-label="Time range">
      {RANGE_KEYS.map((key) => (
        <a
          key={key}
          href={hrefForRange(key)}
          className={`${s.rangeBtn} ${key === active ? s.rangeBtnActive : ''}`}
          aria-current={key === active ? 'true' : undefined}
          title={RANGES[key].label}
        >
          {RANGES[key].shortLabel}
        </a>
      ))}
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg className={s.searchIcon} viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg className={s.tileChevron} viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
