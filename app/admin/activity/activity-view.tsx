'use client';

import { useMemo, useState } from 'react';
import type { ActivityData, ActivityEvent, ActivityKind } from './data';
import { Badge } from '../_components/console';
import { formatDateTime, relativeTime, formatNumber } from '../_components/ui';
import s from '../admin.module.css';
import a from './activity.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Activity — the full, unified history. Free-text search over the description,
// kind filter chips, a "last N days" window, and load-more pagination over the
// generously loaded set the loader hands us. All client-side over data already
// in memory, so it stays instant.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 40;

const KIND_LABELS: Record<ActivityKind, string> = {
  admin: 'Admin actions',
  merchant: 'Merchants',
  waitlist: 'Waitlist',
  audit: 'Audit leads',
  dispute: 'Disputes',
};

const KIND_ORDER: ActivityKind[] = ['admin', 'merchant', 'waitlist', 'audit', 'dispute'];

type KindFilter = ActivityKind | 'all';

const RANGE_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_TONE: Record<ActivityKind, 'verdict' | 'gap' | 'amber' | 'neutral' | 'muted'> = {
  admin: 'neutral',
  merchant: 'verdict',
  waitlist: 'muted',
  audit: 'amber',
  dispute: 'gap',
};

export function ActivityView({ data }: { data: ActivityData }) {
  const { events, counts, truncated } = data;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [rangeKey, setRangeKey] = useState<string>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rangeDays = RANGE_OPTIONS.find((r) => r.key === rangeKey)?.days ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = rangeDays != null ? Date.now() - rangeDays * DAY_MS : null;
    return events.filter((event) => {
      if (kind !== 'all' && event.kind !== kind) return false;
      if (cutoff != null) {
        const t = Date.parse(event.at);
        if (Number.isFinite(t) && t < cutoff) return false;
      }
      if (needle) {
        const haystack = `${event.text} ${event.detail ?? ''} ${event.kind}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [events, query, kind, rangeDays]);

  // Reset pagination whenever the filter set changes shape.
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  function applyFilter(next: () => void) {
    next();
    setVisible(PAGE_SIZE);
  }

  const totalLoaded = events.length;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Activity</h1>
          <p className={s.sectionLead}>
            One unified history across admin actions, merchants, waitlist, audit leads, and disputes.
            Search the description, filter by type, or narrow the window.
          </p>
        </div>
      </header>

      <section className={s.panel} aria-label="Activity history">
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Event stream</p>
            <h2 className={s.panelTitle}>History</h2>
          </div>
          <span className={s.countPill}>
            {formatNumber(filtered.length)}
            {filtered.length === totalLoaded ? '' : ` of ${formatNumber(totalLoaded)}`} events
          </span>
        </div>

        <div className={s.filterBar}>
          <label className={s.searchWrap}>
            <span className="sr-only">Search activity</span>
            <SearchGlyph />
            <input
              type="search"
              className={s.searchInput}
              placeholder="Search activity…"
              value={query}
              onChange={(e) => applyFilter(() => setQuery(e.target.value))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className={a.rangeChips} role="group" aria-label="Time window">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${s.chip} ${rangeKey === option.key ? s.chipActive : ''}`}
                aria-pressed={rangeKey === option.key}
                onClick={() => applyFilter(() => setRangeKey(option.key))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.chipRow} role="group" aria-label="Filter by type">
          <button
            type="button"
            className={`${s.chip} ${kind === 'all' ? s.chipActive : ''}`}
            aria-pressed={kind === 'all'}
            onClick={() => applyFilter(() => setKind('all'))}
          >
            All
            <span className={a.chipCount}>{formatNumber(totalLoaded)}</span>
          </button>
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              className={`${s.chip} ${kind === k ? s.chipActive : ''}`}
              aria-pressed={kind === k}
              onClick={() => applyFilter(() => setKind(k))}
            >
              {KIND_LABELS[k]}
              <span className={a.chipCount}>{formatNumber(counts[k])}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState hasAnyEvents={totalLoaded > 0} />
        ) : (
          <ul className={`${s.feed} ${a.feedList}`}>
            {shown.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}

        {hasMore ? (
          <div className={a.loadMoreRow}>
            <button
              type="button"
              className={s.secondaryBtn}
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Load more ({formatNumber(filtered.length - shown.length)} more)
            </button>
          </div>
        ) : null}

        {truncated && shown.length > 0 ? (
          <p className={a.truncatedNote}>
            Showing the most recent activity. Older history beyond this window is not loaded here.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  return (
    <li className={`${s.feedRow} ${a.eventRow}`}>
      <span className={s.feedWhen} title={formatDateTime(event.at)}>
        {relativeTime(event.at)}
      </span>
      <span className={a.eventKind}>
        <Badge tone={KIND_TONE[event.kind]}>{KIND_LABELS[event.kind]}</Badge>
      </span>
      <span className={s.feedText}>
        <strong>{event.text}</strong>
        {event.detail ? <span className={a.eventDetail}> {event.detail}</span> : null}
      </span>
    </li>
  );
}

function EmptyState({ hasAnyEvents }: { hasAnyEvents: boolean }) {
  return (
    <div className={a.empty}>
      {hasAnyEvents
        ? 'No activity matches these filters. Clear the search or widen the window.'
        : 'No activity captured yet. Events will appear here as merchants, leads, signups, disputes, and admin actions land.'}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg className={s.searchIcon} viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
