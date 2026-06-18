'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FeedbackData, FeedbackRow, StatusFilter } from './data';
import { setFeedbackStatusAction } from './actions';
import { Drawer, DrawerSection, DetailRow } from '../_components/drawer';
import { SearchIcon } from '../_components/console';
import { EmptyRow, formatDateTime, relativeTime } from '../_components/ui';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSurface,
} from '@/lib/feedback/schema';
import s from '../admin.module.css';
import f from './feedback.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK INBOX (founder-only) — status segtabs + search + table + drawer.
//
// URL-as-state: status + search live in ?status=&q= so views are bookmarkable
// (mirrors the admin convention). Status color law: New = gap (open, needs you),
// Triaged = neutral, Closed = safe (verdict green = handled). Status is always a
// dot PLUS a label, never color alone. Triage Save runs the founder-gated server
// action (the authenticated UPDATE path). Nothing is ever deleted.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'triaged', label: 'Triaged' },
  { key: 'closed', label: 'Closed' },
];

const SURFACE_LABEL: Record<FeedbackSurface, string> = {
  app: 'App',
  auth: 'Auth',
  marketing: 'Marketing',
  prompt: 'Periodic prompt',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  closed: 'Closed',
};

const STATUS_DOT_CLASS: Record<FeedbackStatus, string> = {
  new: f.dotGap,
  triaged: f.dotNeutral,
  closed: f.dotSafe,
};

function StatusLabel({ status }: { status: FeedbackStatus }) {
  return (
    <span className={f.statusLabel}>
      <span className={`${f.dot} ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function categoryLabel(category: FeedbackCategory): string {
  // Compact tag label (the inbox column is narrow); "Broken" reads better there.
  if (category === 'problem') return 'Broken';
  return FEEDBACK_CATEGORY_LABELS[category];
}

export function FeedbackView({ data }: { data: FeedbackData }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [searchValue, setSearchValue] = useState(data.query);

  const hrefForStatus = useMemo(
    () =>
      (status: StatusFilter): string => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        if (status === 'all') params.delete('status');
        else params.set('status', status);
        params.delete('page'); // a new filter resets pagination
        const qs = params.toString();
        return qs ? `${pathname}?${qs}` : pathname;
      },
    [pathname, searchParams],
  );

  const hrefForPage = (page: number): string => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const trimmed = searchValue.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const counts = data.counts;
  const tabCount = (key: StatusFilter): number =>
    key === 'all' ? counts.all : key === 'new' ? counts.new : key === 'triaged' ? counts.triaged : counts.closed;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder inbox</p>
          <h1 className={s.title}>Feedback</h1>
          <p className={s.sectionLead}>
            What people tell us from anywhere in Verdact. Anonymous notes are kept too. Triage marks
            what you have read and what is handled. Nothing is ever deleted, and nothing is shared.
          </p>
        </div>
      </header>

      <section className={s.panel} aria-label="Feedback inbox">
        {/* Toolbar: status segtabs (URL-as-state) + search */}
        <div className={f.toolbar}>
          <div className={s.tabBar} role="tablist" aria-label="Filter feedback by status">
            {STATUS_TABS.map((t) => {
              const isActive = data.status === t.key;
              return (
                <a
                  key={t.key}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${s.tab} ${isActive ? s.tabActive : ''}`}
                  href={hrefForStatus(t.key)}
                >
                  {t.label}
                  <span className={s.tabCount}>{tabCount(t.key)}</span>
                </a>
              );
            })}
          </div>

          <form className={f.searchForm} onSubmit={onSearchSubmit} role="search">
            <div className={s.searchWrap}>
              <SearchIcon />
              <input
                className={s.searchInput}
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search message, sender, screen"
                aria-label="Search feedback"
              />
            </div>
            <button type="submit" className="btn btn--ghost">
              Search
            </button>
          </form>
        </div>

        {/* The list. Whole row opens the drawer. */}
        {data.rows.length === 0 ? (
          <EmptyState status={data.status} hasQuery={data.query.length > 0} />
        ) : (
          <div className={s.tableWrap}>
            <table className={`${s.table} ${f.table}`} aria-label="Feedback, newest first">
              <thead>
                <tr>
                  <th className={f.colStatus} scope="col">
                    Status
                  </th>
                  <th className={f.colSender} scope="col">
                    Sender
                  </th>
                  <th className={f.colCat} scope="col">
                    Category
                  </th>
                  <th className={f.colScreen} scope="col">
                    Screen
                  </th>
                  <th className={f.colMsg} scope="col">
                    Message
                  </th>
                  <th className={f.colDate} scope="col">
                    Received
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className={f.clickRow}
                    aria-selected={selected?.id === row.id}
                    onClick={() => setSelected(row)}
                  >
                    <td data-k="Status">
                      <button type="button" className={f.rowButton} onClick={() => setSelected(row)}>
                        <StatusLabel status={row.status} />
                      </button>
                    </td>
                    <td data-k="Sender">
                      {row.email ? (
                        <span className={s.strong}>{row.email}</span>
                      ) : (
                        <span className={f.anon}>Anonymous</span>
                      )}
                    </td>
                    <td data-k="Category">
                      <span className="tag">{categoryLabel(row.category)}</span>
                    </td>
                    <td data-k="Screen" className={f.screenCell}>
                      {row.screen ?? 'Not captured'}
                    </td>
                    <td data-k="Message" className={f.msgCell}>
                      {row.message}
                    </td>
                    <td data-k="Received" className={s.muted}>
                      {relativeTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer (LIMIT/OFFSET) */}
        <div className={f.pager}>
          <p className={f.pagerNote}>
            Showing {data.rows.length} of {data.total}. Newest first. Every note is kept; nothing is deleted.
          </p>
          <div className={f.pagerBtns}>
            <PagerLink href={hrefForPage(data.page - 1)} disabled={data.page <= 1} label="Previous" />
            <PagerLink
              href={hrefForPage(data.page + 1)}
              disabled={data.page >= data.pageCount}
              label="Next"
            />
          </div>
        </div>
      </section>

      <FeedbackDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PagerLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <button type="button" className="btn btn--ghost" disabled aria-label={label}>
        {label}
      </button>
    );
  }
  return (
    <a className="btn btn--ghost" href={href} aria-label={label}>
      {label}
    </a>
  );
}

function EmptyState({ status, hasQuery }: { status: StatusFilter; hasQuery: boolean }) {
  const heading = hasQuery
    ? 'No feedback matches that search.'
    : status === 'new'
      ? 'No new feedback. You are all caught up.'
      : 'No feedback here yet.';
  return (
    <div className="empty">
      <h2 className="t-h3">{heading}</h2>
      <p className="t-small">
        New notes land here the moment someone sends one. Nothing is ever deleted.
      </p>
    </div>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function FeedbackDrawer({ row, onClose }: { row: FeedbackRow | null; onClose: () => void }) {
  const [pending, setPending] = useState<FeedbackStatus | null>(null);
  const [saving, setSaving] = useState(false);

  if (!row) return null;

  const current = pending ?? row.status;
  const reply = row.email
    ? `mailto:${row.email}?subject=${encodeURIComponent('Re: your Verdact feedback')}`
    : null;

  const onSave = async () => {
    const next = pending ?? row.status;
    setSaving(true);
    const result = await setFeedbackStatusAction(row.id, next);
    setSaving(false);
    if (result.ok) {
      setPending(null);
      onClose();
    }
  };

  return (
    <Drawer
      open
      onClose={() => {
        setPending(null);
        onClose();
      }}
      title={row.email ?? 'Anonymous'}
      eyebrow={`${categoryLabel(row.category)} · Received ${formatDateTime(row.created_at)}`}
      width="standard"
      footer={
        <div className={f.footer}>
          {reply ? (
            <a className="btn btn--secondary" href={reply}>
              Reply by email
            </a>
          ) : null}
          <span className={f.footerSpacer} />
          <button type="button" className={`btn ${saving ? 'btn--loading' : ''}`} disabled={saving} onClick={onSave}>
            Save
          </button>
        </div>
      }
    >
      <DrawerSection title="Status">
        <div className={f.statusGroup} role="radiogroup" aria-label="Set feedback status">
          {(FEEDBACK_STATUSES as readonly FeedbackStatus[]).map((value) => {
            const checked = current === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`${f.statusOption} ${checked ? f.statusOptionActive : ''}`}
                onClick={() => setPending(value)}
              >
                <span className={`${f.dot} ${STATUS_DOT_CLASS[value]}`} aria-hidden="true" />
                {STATUS_LABEL[value]}
              </button>
            );
          })}
        </div>
      </DrawerSection>

      <DrawerSection title="Message">
        <blockquote className={f.quote}>{row.message}</blockquote>
      </DrawerSection>

      <DrawerSection title="Context">
        <DetailRow label="Screen">{row.screen ?? 'Not captured'}</DetailRow>
        <DetailRow label="Route">
          {row.route ? <code className={f.code}>{row.route}</code> : 'Not captured'}
        </DetailRow>
        <DetailRow label="What they were doing">{row.activity ?? 'Not provided'}</DetailRow>
        <DetailRow label="Surface">{SURFACE_LABEL[row.surface]}</DetailRow>
        <DetailRow label="Merchant">{row.merchantName ?? (row.merchant_id ? 'Unknown' : 'Not signed in')}</DetailRow>
        <DetailRow label="Device / UA">{row.user_agent ?? 'Unknown'}</DetailRow>
        <DetailRow label="Screenshot">
          {row.has_screenshot ? (
            <span className="pill pill--action">Offered</span>
          ) : (
            <span className="pill pill--neutral">Not offered</span>
          )}
        </DetailRow>
        <DetailRow label="Received (UTC)">{formatDateTime(row.created_at)}</DetailRow>
      </DrawerSection>
    </Drawer>
  );
}
