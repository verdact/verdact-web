'use client';

import { useMemo, useState } from 'react';
import type { DisputesData, DisputeRecord } from './data';
import { reasonForDispute } from '@/lib/admin/outcome-reasoning';
import { Drawer, DrawerSection, DetailRow, WhyNow } from '../_components/drawer';
import { Badge, OutcomeBadge, SearchIcon, Chevron } from '../_components/console';
import { Donut, type DonutSegment } from '../_components/charts';
import { formatNumber, formatDateTime, relativeTime, shortId, EmptyRow } from '../_components/ui';
import s from '../admin.module.css';
import d from './disputes.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES — outcomes and the honest WHY behind wins and losses.
//
// Not a leaderboard: every read is completeness + correlation, never a win-rate
// or a guarantee. The reasoning brain (lib/admin/outcome-reasoning) owns the
// honesty locks; this view only surfaces them. No fabricated numbers; when the
// platform has no disputes yet (the test account has charges disabled), we say
// so plainly.
// ─────────────────────────────────────────────────────────────────────────────

type OutcomeFilter = 'all' | 'won' | 'lost' | 'warning_closed' | 'open';
type NetworkFilter = 'all' | 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

const OUTCOME_FILTERS: { key: OutcomeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'warning_closed', label: 'Warning closed' },
  { key: 'open', label: 'Open' },
];

const NETWORK_FILTERS: { key: NetworkFilter; label: string }[] = [
  { key: 'all', label: 'All networks' },
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'amex', label: 'Amex' },
  { key: 'discover', label: 'Discover' },
  { key: 'unknown', label: 'Unknown' },
];

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

function framingOf(record: DisputeRecord): OutcomeFilter {
  if (record.outcome === 'won') return 'won';
  if (record.outcome === 'lost') return 'lost';
  if (record.outcome === 'warning_closed') return 'warning_closed';
  return 'open';
}

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null || !Number.isFinite(cents)) return 'n/a';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function DisputesView({ data }: { data: DisputesData }) {
  const { disputes, aggregate } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
  const [query, setQuery] = useState('');

  const hasDisputes = disputes.length > 0;

  const shouldHaveWon = useMemo(
    () => disputes.filter((rec) => reasonForDispute(rec.reasoning).isShouldHaveWon),
    [disputes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return disputes.filter((rec) => {
      if (outcomeFilter !== 'all' && framingOf(rec) !== outcomeFilter) return false;
      if (networkFilter !== 'all') {
        const net = (rec.network ?? 'unknown').toLowerCase();
        if (net !== networkFilter) return false;
      }
      if (q) {
        const haystack = `${rec.merchantName} ${rec.reason ?? ''} ${rec.network ?? ''} ${rec.id}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [disputes, outcomeFilter, networkFilter, query]);

  const selected = selectedId ? disputes.find((rec) => rec.id === selectedId) ?? null : null;

  const decided = aggregate.won + aggregate.lost;
  const outcomeSegments: DonutSegment[] = [
    { label: 'Won', value: aggregate.won, tone: 'verdict' },
    { label: 'Lost', value: aggregate.lost, tone: 'gap' },
    { label: 'Warning closed', value: aggregate.warningClosed, tone: 'neutral' },
    { label: 'Open', value: aggregate.open, tone: 'neutral' },
  ];
  const totalCount = aggregate.won + aggregate.lost + aggregate.warningClosed + aggregate.open;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Disputes</h1>
          <p className={s.sectionLead}>
            Outcomes and the honest reasoning behind them. Every read is evidence completeness and
            correlation, never a win-rate or a guarantee.
          </p>
        </div>
      </header>

      {!hasDisputes ? (
        <section className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Outcomes</p>
              <h2 className={s.panelTitle}>No disputes filed yet</h2>
            </div>
          </div>
          <p className={s.sectionLead}>
            No dispute has been filed on the platform yet. Once a connected merchant starts
            receiving and responding to disputes, every outcome and its reasoning appears here.
          </p>
        </section>
      ) : (
        <>
          {/* ── Outcome summary + donut ─────────────────────────────────── */}
          <section className={s.vizRow}>
            <div className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <p className={s.panelKicker}>Outcomes</p>
                  <h2 className={s.panelTitle}>Outcome summary</h2>
                </div>
                <span className={s.countPill}>{formatNumber(decided)} decided</span>
              </div>
              <div className={d.summaryRow}>
                <Donut
                  segments={outcomeSegments}
                  centerValue={formatNumber(totalCount)}
                  centerLabel="disputes"
                />
                <div className={d.summaryBadges}>
                  <SummaryStat label="Won" value={aggregate.won} tone="verdict" />
                  <SummaryStat label="Lost" value={aggregate.lost} tone="gap" />
                  <SummaryStat label="Warning closed" value={aggregate.warningClosed} tone="amber" />
                  <SummaryStat label="Open" value={aggregate.open} tone="muted" />
                </div>
              </div>
              <p className={d.honestyNote}>
                Warning closed is its own outcome: an early warning that resolved in the merchant&apos;s
                favor with no representment decision. It is never counted as a win or a loss.
              </p>
            </div>

            <div className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <p className={s.panelKicker}>Reading the set</p>
                  <h2 className={s.panelTitle}>What&apos;s working / leaking</h2>
                </div>
              </div>
              <div className={d.themeGrid}>
                <ThemeList title="What's working" tone="verdict" items={aggregate.whatsWorking} />
                <ThemeList title="What's leaking" tone="gap" items={aggregate.whatsLeaking} />
              </div>
            </div>
          </section>

          {/* ── Should-have-won ─────────────────────────────────────────── */}
          <section className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.panelKicker}>Recoverable</p>
                <h2 className={s.panelTitle}>Should-have-won</h2>
              </div>
              <span className={s.countPill}>{formatNumber(shouldHaveWon.length)} flagged</span>
            </div>
            {shouldHaveWon.length === 0 ? (
              <p className={s.sectionLead}>
                No lost dispute reads as winnable on the evidence held. Lost cases here were on
                reasons that rarely reverse on representment, so the loss correlates with the reason
                rather than a gap in your packet.
              </p>
            ) : (
              <div className={s.worklist}>
                {shouldHaveWon.map((rec) => {
                  const reasoning = reasonForDispute(rec.reasoning);
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      className={s.worklistItem}
                      onClick={() => setSelectedId(rec.id)}
                    >
                      <div className={s.worklistMain}>
                        <span className={s.worklistLabel}>
                          {rec.merchantName} · {reasoning.reasonLabel}
                        </span>
                        <span className={s.worklistWhy}>{reasoning.headline}</span>
                      </div>
                      <div className={s.worklistMeta}>
                        <span className={d.amountTag}>{formatAmount(rec.amountCents, rec.currency)}</span>
                        <Chevron />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Filterable dispute table ────────────────────────────────── */}
          <section className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.panelKicker}>Ledger</p>
                <h2 className={s.panelTitle}>All disputes</h2>
              </div>
              <span className={s.countPill}>
                {formatNumber(filtered.length)} of {formatNumber(disputes.length)}
              </span>
            </div>

            <div className={s.filterBar}>
              <div className={s.searchWrap}>
                <SearchIcon />
                <input
                  type="search"
                  className={s.searchInput}
                  placeholder="Search merchant, reason, network…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search disputes"
                />
              </div>
            </div>

            <div className={s.chipRow} role="group" aria-label="Filter by outcome">
              {OUTCOME_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${s.chip} ${outcomeFilter === f.key ? s.chipActive : ''}`}
                  aria-pressed={outcomeFilter === f.key}
                  onClick={() => setOutcomeFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className={s.chipRow} role="group" aria-label="Filter by network">
              {NETWORK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`${s.chip} ${networkFilter === f.key ? s.chipActive : ''}`}
                  aria-pressed={networkFilter === f.key}
                  onClick={() => setNetworkFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Network</th>
                    <th>Reason</th>
                    <th>Outcome</th>
                    <th>Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <EmptyRow colSpan={6} label="No disputes match these filters." />
                  ) : (
                    filtered.map((rec) => (
                      <tr
                        key={rec.id}
                        className={d.clickRow}
                        onClick={() => setSelectedId(rec.id)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open dispute for ${rec.merchantName}`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedId(rec.id);
                          }
                        }}
                      >
                        <td className={s.strong}>{rec.merchantName}</td>
                        <td className={s.numCell}>{formatAmount(rec.amountCents, rec.currency)}</td>
                        <td>{networkLabel(rec.network)}</td>
                        <td>
                          <span className={d.reasonCell}>{rec.reason || 'Not captured'}</span>
                        </td>
                        <td>
                          <OutcomeBadge outcome={framingOf(rec) === 'open' ? 'open' : rec.outcome} />
                        </td>
                        <td>{relativeTime(rec.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <DisputeDrawer record={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ── Drawer (per-dispute reasoning) ───────────────────────────────────────────

function DisputeDrawer({
  record,
  onClose,
}: {
  record: DisputeRecord | null;
  onClose: () => void;
}) {
  if (!record) return null;
  const reasoning = reasonForDispute(record.reasoning);
  const framing = framingOf(record);

  return (
    <Drawer
      open
      onClose={onClose}
      width="wide"
      eyebrow={record.merchantName}
      title={reasoning.headline}
    >
      <DrawerSection>
        <WhyNow tone={framing === 'lost' ? 'gap' : framing === 'won' ? 'verdict' : 'neutral'}>
          {reasoning.why}
        </WhyNow>
      </DrawerSection>

      <DrawerSection title="Record">
        <DetailRow label="Merchant">{record.merchantName}</DetailRow>
        <DetailRow label="Amount">{formatAmount(record.amountCents, record.currency)}</DetailRow>
        <DetailRow label="Network">{networkLabel(record.network)}</DetailRow>
        <DetailRow label="Reason">{record.reason || 'Not captured'}</DetailRow>
        <DetailRow label="Network code">{reasoning.reasonLabel}</DetailRow>
        <DetailRow label="Outcome">
          <OutcomeBadge outcome={framing === 'open' ? 'open' : record.outcome} />
        </DetailRow>
        <DetailRow label="Status">{humanizeStatus(record.status)}</DetailRow>
        <DetailRow label="Filed">{formatDateTime(record.createdAt)}</DetailRow>
        <DetailRow label="Dispute ID">
          <span className={s.mono}>{shortId(record.id)}</span>
        </DetailRow>
      </DrawerSection>

      <DrawerSection title="Evidence readiness">
        {record.readiness ? (
          <>
            <DetailRow label="Completeness">{record.readiness.percent}% of tracked proof present</DetailRow>
            <div className={d.readinessKeys}>
              {record.readiness.present.map((key) => (
                <Badge key={`present-${key}`} tone="verdict" dot>
                  {readinessLabel(key)}
                </Badge>
              ))}
              {record.readiness.missing.map((key) => (
                <Badge key={`missing-${key}`} tone="muted">
                  {readinessLabel(key)} missing
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <p className={d.mutedNote}>
            No evidence packet captured yet for this dispute. The reasoning below reflects the
            reason and network alone.
          </p>
        )}
      </DrawerSection>

      {reasoning.howToImprove.length > 0 ? (
        <DrawerSection title="How to improve">
          <ul className={d.improveList}>
            {reasoning.howToImprove.map((item, i) => (
              <li key={i} className={d.improveItem}>
                {item}
              </li>
            ))}
          </ul>
        </DrawerSection>
      ) : null}

      <DrawerSection title="Tags">
        <div className={d.tagRow}>
          {reasoning.tags.map((tag) => (
            <Badge key={tag} tone={tagTone(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
      </DrawerSection>
    </Drawer>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'verdict' | 'gap' | 'amber' | 'muted';
}) {
  return (
    <div className={d.summaryStat}>
      <Badge tone={tone}>{label}</Badge>
      <span className={d.summaryStatValue}>{formatNumber(value)}</span>
    </div>
  );
}

function ThemeList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'verdict' | 'gap';
  items: string[];
}) {
  return (
    <div className={d.themeCol}>
      <p className={`${d.themeTitle} ${tone === 'verdict' ? d.themeTitleGood : d.themeTitleBad}`}>
        {title}
      </p>
      <ul className={d.themeItems}>
        {items.map((item, i) => (
          <li key={i} className={d.themeItem}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function networkLabel(network: string | null): string {
  const net = (network ?? '').toLowerCase();
  switch (net) {
    case 'visa':
      return 'Visa';
    case 'mastercard':
      return 'Mastercard';
    case 'amex':
      return 'Amex';
    case 'discover':
      return 'Discover';
    default:
      return 'Unknown';
  }
}

function humanizeStatus(status: string): string {
  const map: Record<string, string> = {
    needs_response: 'Needs response',
    under_review: 'Under review',
    submitted: 'Submitted',
    won: 'Won',
    lost: 'Lost',
    warning_closed: 'Warning closed',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

function readinessLabel(key: string): string {
  const map: Record<string, string> = {
    charge_attached: 'Charge attached',
    delivery_proof: 'Delivery proof',
    policy: 'Policy on file',
    product_description: 'Product description',
    narrative: 'Narrative',
    qa_clear: 'QA clear',
  };
  return map[key] ?? key.replace(/_/g, ' ');
}

function tagTone(tag: string): 'verdict' | 'gap' | 'amber' | 'muted' | 'neutral' {
  if (tag === 'won') return 'verdict';
  if (tag === 'lost' || tag === 'should-have-won') return 'gap';
  if (tag === 'warning-closed') return 'amber';
  if (tag === 'open') return 'muted';
  return 'neutral';
}
