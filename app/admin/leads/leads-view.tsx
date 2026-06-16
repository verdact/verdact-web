'use client';

import { useMemo, useState } from 'react';
import type { LeadsData, LeadWaitlistRow, LeadAuditRow, LeadUnactivatedRow } from './data';
import type { ConvertItem } from '@/lib/admin/convert';
import { Drawer, DrawerSection, DetailRow, WhyNow } from '../_components/drawer';
import { Badge, ScoreChip, StandingBadge, SearchIcon } from '../_components/console';
import { DraftBlock } from '../_components/console-client';
import { EmptyRow, formatDateShort, formatNumber, formatPercentFraction, relativeTime } from '../_components/ui';
import s from '../admin.module.css';
import lead from './leads.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// LEADS — propensity-ranked convert console.
//
// Three tabs. "Convert worklist" merges every population, ranked by propensity
// score. "Waitlist" and "Audit leads" are the raw populations. Each tab is
// searchable by email / business name. Clicking any row opens the shared Drawer
// with the full lead detail, a Why now callout, the recommended action, and the
// drafted outreach. Drafts are copy-only — Verdact never sends anything.
// ─────────────────────────────────────────────────────────────────────────────

type TabKey = 'worklist' | 'waitlist' | 'audit';
type KindFilter = 'all' | ConvertItem['kind'];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'worklist', label: 'Convert worklist' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'audit', label: 'Audit leads' },
];

const KIND_CHIPS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All sources' },
  { key: 'audit_lead', label: 'Audit leads' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'unactivated', label: 'Unactivated' },
];

const KIND_LABEL: Record<ConvertItem['kind'], string> = {
  audit_lead: 'Audit lead',
  waitlist: 'Waitlist',
  unactivated: 'Unactivated merchant',
};

type Selected =
  | { type: 'item'; item: ConvertItem }
  | { type: 'waitlist'; row: LeadWaitlistRow; item: ConvertItem | null }
  | { type: 'audit'; row: LeadAuditRow; item: ConvertItem | null };

export function LeadsView({ data }: { data: LeadsData }) {
  const [tab, setTab] = useState<TabKey>('worklist');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [selected, setSelected] = useState<Selected | null>(null);

  const needle = query.trim().toLowerCase();

  const itemById = useMemo(() => {
    const map = new Map<string, ConvertItem>();
    for (const item of data.worklist) map.set(`${item.kind}:${item.id}`, item);
    return map;
  }, [data.worklist]);

  const worklist = useMemo(() => {
    return data.worklist.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (needle.length === 0) return true;
      return item.label.toLowerCase().includes(needle);
    });
  }, [data.worklist, kind, needle]);

  const waitlistRows = useMemo(() => {
    if (needle.length === 0) return data.waitlistRows;
    return data.waitlistRows.filter((row) => row.email.toLowerCase().includes(needle));
  }, [data.waitlistRows, needle]);

  const auditRows = useMemo(() => {
    if (needle.length === 0) return data.auditRows;
    return data.auditRows.filter(
      (row) =>
        row.email.toLowerCase().includes(needle) ||
        (row.business_name ?? '').toLowerCase().includes(needle),
    );
  }, [data.auditRows, needle]);

  const closeDrawer = () => setSelected(null);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Leads</h1>
          <p className={s.sectionLead}>
            Who is at the top of the funnel and how to convert them. Every lead is scored by
            propensity, with a drafted, processor-ready note you copy and send from your own inbox.
            Nothing is sent from Verdact.
          </p>
        </div>
      </header>

      <section className={s.panel} aria-label="Lead populations">
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Convert</p>
            <h2 className={s.panelTitle}>Pipeline</h2>
          </div>
          <span className={s.countPill}>{formatNumber(data.counts.worklist)} scored</span>
        </div>

        <div className={s.tabBar} role="tablist" aria-label="Lead views">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${s.tab} ${tab === t.key ? s.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className={s.tabCount}>{tabCount(t.key, data.counts)}</span>
            </button>
          ))}
        </div>

        <div className={lead.controls}>
          <div className={s.filterBar}>
            <div className={s.searchWrap}>
              <SearchIcon />
              <input
                className={s.searchInput}
                type="search"
                placeholder={tab === 'worklist' ? 'Search by email or business' : 'Search by email'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search leads"
              />
            </div>
          </div>
          {tab === 'worklist' ? (
            <div className={s.chipRow} role="group" aria-label="Filter by source">
              {KIND_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`${s.chip} ${kind === chip.key ? s.chipActive : ''}`}
                  aria-pressed={kind === chip.key}
                  onClick={() => setKind(chip.key)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {tab === 'worklist' ? (
          <WorklistTab items={worklist} onSelect={(item) => setSelected({ type: 'item', item })} />
        ) : tab === 'waitlist' ? (
          <WaitlistTab
            rows={waitlistRows}
            onSelect={(row) =>
              setSelected({ type: 'waitlist', row, item: itemById.get(`waitlist:${row.id}`) ?? null })
            }
          />
        ) : (
          <AuditTab
            rows={auditRows}
            onSelect={(row) =>
              setSelected({ type: 'audit', row, item: itemById.get(`audit_lead:${row.id}`) ?? null })
            }
          />
        )}
      </section>

      <LeadDrawer selected={selected} onClose={closeDrawer} />
    </div>
  );
}

function tabCount(key: TabKey, counts: LeadsData['counts']): number {
  if (key === 'worklist') return counts.worklist;
  if (key === 'waitlist') return counts.waitlist;
  return counts.audit;
}

// ── Worklist tab (ranked, merged) ────────────────────────────────────────────

function WorklistTab({
  items,
  onSelect,
}: {
  items: ConvertItem[];
  onSelect: (item: ConvertItem) => void;
}) {
  if (items.length === 0) {
    return <p className={lead.empty}>No leads match yet. As waitlist signups, audits, and unactivated merchants land, the ranked worklist fills in here.</p>;
  }
  return (
    <div className={s.worklist}>
      {items.map((item) => (
        <button
          key={`${item.kind}:${item.id}`}
          type="button"
          className={s.worklistItem}
          onClick={() => onSelect(item)}
        >
          <ScoreChip score={item.score} />
          <span className={s.worklistMain}>
            <span className={s.worklistLabel}>{item.label}</span>
            <span className={s.worklistWhy}>{item.whyNow}</span>
          </span>
          <span className={s.worklistMeta}>
            <Badge tone="muted">{KIND_LABEL[item.kind]}</Badge>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Waitlist tab ─────────────────────────────────────────────────────────────

function WaitlistTab({
  rows,
  onSelect,
}: {
  rows: LeadWaitlistRow[];
  onSelect: (row: LeadWaitlistRow) => void;
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Source</th>
            <th>Region</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={4} label="No waitlist signups match." />
          ) : (
            rows.map((row) => (
              <tr key={row.id} className={lead.clickRow} onClick={() => onSelect(row)}>
                <td>
                  <button type="button" className={lead.rowButton} onClick={() => onSelect(row)}>
                    <span className={s.strong}>{row.email}</span>
                  </button>
                </td>
                <td>{row.source ?? 'signup'}</td>
                <td>{regionLabel(row.geo_country, row.geo_region)}</td>
                <td>{formatDateShort(row.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Audit leads tab ──────────────────────────────────────────────────────────

function AuditTab({
  rows,
  onSelect,
}: {
  rows: LeadAuditRow[];
  onSelect: (row: LeadAuditRow) => void;
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Rate</th>
            <th>Should have won</th>
            <th>Band</th>
            <th>Status</th>
            <th>Run</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6} label="No audit leads match." />
          ) : (
            rows.map((row) => (
              <tr key={row.id} className={lead.clickRow} onClick={() => onSelect(row)}>
                <td>
                  <button type="button" className={lead.rowButton} onClick={() => onSelect(row)}>
                    <span className={s.strong}>{row.business_name || row.email}</span>
                    {row.business_name ? <span className={s.cellNote}>{row.email}</span> : null}
                  </button>
                </td>
                <td>{formatPercentFraction(row.estimated_dispute_rate)}</td>
                <td className={s.mono}>{formatNumber(row.should_have_won_count)}</td>
                <td>
                  <StandingBadge band={row.standing_band} />
                </td>
                <td>
                  {row.converted_merchant_id ? (
                    <Badge tone="verdict">Converted</Badge>
                  ) : (
                    <Badge tone="muted">Open</Badge>
                  )}
                </td>
                <td>{formatDateShort(row.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function LeadDrawer({ selected, onClose }: { selected: Selected | null; onClose: () => void }) {
  if (!selected) return null;

  if (selected.type === 'item') {
    const { item } = selected;
    return (
      <Drawer open onClose={onClose} title={item.label} eyebrow={KIND_LABEL[item.kind]} width="wide">
        <DrawerSection>
          <WhyNow tone="gap">{item.whyNow}</WhyNow>
        </DrawerSection>

        <DrawerSection title="Lead">
          <DetailRow label="Propensity score">
            <span className={lead.scoreInline}>
              <ScoreChip score={item.score} />
            </span>
          </DetailRow>
          <DetailRow label="Source">{KIND_LABEL[item.kind]}</DetailRow>
        </DrawerSection>

        {item.signals.length > 0 ? (
          <DrawerSection title="Signals">
            <ul className={lead.signalList}>
              {item.signals.map((signal, i) => (
                <li key={i} className={lead.signalItem}>
                  {signal}
                </li>
              ))}
            </ul>
          </DrawerSection>
        ) : null}

        <DrawerSection title="Recommended action">
          <p className={lead.actionText}>{item.recommendedAction}</p>
        </DrawerSection>

        <DrawerSection title="Drafted outreach">
          <DraftBlock draft={item.draft} />
        </DrawerSection>
      </Drawer>
    );
  }

  if (selected.type === 'waitlist') {
    const { row, item } = selected;
    return (
      <Drawer open onClose={onClose} title={row.email} eyebrow="Waitlist signup" width="wide">
        {item ? (
          <DrawerSection>
            <WhyNow>{item.whyNow}</WhyNow>
          </DrawerSection>
        ) : null}

        <DrawerSection title="Lead">
          {item ? (
            <DetailRow label="Propensity score">
              <span className={lead.scoreInline}>
                <ScoreChip score={item.score} />
              </span>
            </DetailRow>
          ) : null}
          <DetailRow label="Email">{row.email}</DetailRow>
          <DetailRow label="Source">{row.source ?? 'signup'}</DetailRow>
          <DetailRow label="Region">{regionLabel(row.geo_country, row.geo_region)}</DetailRow>
          <DetailRow label="Joined">
            {formatDateShort(row.created_at)} · {relativeTime(row.created_at)}
          </DetailRow>
        </DrawerSection>

        {item ? (
          <>
            <DrawerSection title="Recommended action">
              <p className={lead.actionText}>{item.recommendedAction}</p>
            </DrawerSection>
            <DrawerSection title="Drafted outreach">
              <DraftBlock draft={item.draft} />
            </DrawerSection>
          </>
        ) : null}
      </Drawer>
    );
  }

  const { row, item } = selected;
  return (
    <Drawer
      open
      onClose={onClose}
      title={row.business_name || row.email}
      eyebrow="Audit lead"
      width="wide"
    >
      {item ? (
        <DrawerSection>
          <WhyNow tone="gap">{item.whyNow}</WhyNow>
        </DrawerSection>
      ) : null}

      <DrawerSection title="Lead">
        {item ? (
          <DetailRow label="Propensity score">
            <span className={lead.scoreInline}>
              <ScoreChip score={item.score} />
            </span>
          </DetailRow>
        ) : null}
        <DetailRow label="Email">{row.email}</DetailRow>
        {row.business_name ? <DetailRow label="Business">{row.business_name}</DetailRow> : null}
        <DetailRow label="Source">{row.source ?? 'audit'}</DetailRow>
        <DetailRow label="Region">{regionLabel(row.geo_country, row.geo_region)}</DetailRow>
        <DetailRow label="Standing">
          <StandingBadge band={row.standing_band} />
        </DetailRow>
        <DetailRow label="Converted">
          {row.converted_merchant_id ? (
            <span>
              <Badge tone="verdict">Yes</Badge>
              {row.converted_at ? (
                <span className={s.muted}> · {formatDateShort(row.converted_at)}</span>
              ) : null}
            </span>
          ) : (
            <Badge tone="muted">Not yet</Badge>
          )}
        </DetailRow>
        <DetailRow label="Run">
          {formatDateShort(row.created_at)} · {relativeTime(row.created_at)}
        </DetailRow>
      </DrawerSection>

      <DrawerSection title="Audit numbers">
        <DetailRow label="Estimated dispute rate">
          {formatPercentFraction(row.estimated_dispute_rate)}
        </DetailRow>
        <DetailRow label="Total disputes">{formatNumber(row.total_disputes)}</DetailRow>
        <DetailRow label="Lost disputes">{formatNumber(row.lost_disputes)}</DetailRow>
        <DetailRow label="Should have won">{formatNumber(row.should_have_won_count)}</DetailRow>
        <DetailRow label="Hinged on communications">
          {formatNumber(row.comms_hinged_count)}
        </DetailRow>
      </DrawerSection>

      {item ? (
        <>
          <DrawerSection title="Recommended action">
            <p className={lead.actionText}>{item.recommendedAction}</p>
          </DrawerSection>
          <DrawerSection title="Drafted outreach">
            <DraftBlock draft={item.draft} />
          </DrawerSection>
        </>
      ) : null}
    </Drawer>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function regionLabel(country: string | null, region: string | null): string {
  const c = country?.trim();
  const r = region?.trim();
  if (c && r) return `${r}, ${c}`;
  if (c) return c;
  if (r) return r;
  return 'Region not captured yet';
}
