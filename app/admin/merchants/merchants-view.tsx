'use client';

import { useMemo, useState } from 'react';
import type {
  MerchantsData,
  MerchantRecord,
  VampOverLineItem,
} from './data';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  type MerchantCategory,
} from '@/lib/admin/categorize';
import { scoreUnactivatedMerchant, draftVampAlert } from '@/lib/admin/convert';
import { Donut, type DonutSegment } from '../_components/charts';
import {
  Badge,
  CategoryBadge,
  SourceNote,
  StandingBadge,
  ScoreChip,
} from '../_components/console';
import { DraftBlock } from '../_components/console-client';
import { Drawer, DrawerSection, DetailRow, WhyNow } from '../_components/drawer';
import {
  Notice,
  EmptyRow,
  formatNumber,
  formatDateShort,
  formatPercentFraction,
  relativeTime,
} from '../_components/ui';
import { setCategoryAction, markVampDraftedAction } from './actions';
import s from '../admin.module.css';
import m from './merchants.module.css';

const NOTICE_COPY = {
  notices: {
    'category-set': 'Category override saved.',
    'vamp-drafted': 'Alert marked as drafted. Nothing was sent.',
  },
  errors: {
    'invalid-merchant': 'That merchant could not be identified. Nothing changed.',
    'invalid-category': 'Pick one of the four categories. Nothing changed.',
    'category-failed': 'Could not save the category. Please try again.',
    'draft-failed': 'Could not record the draft. Please try again.',
  },
};

// Activation filter values.
type ActivationFilter = 'all' | 'activated' | 'unactivated';
type CategoryFilter = 'all' | MerchantCategory;

const CATEGORY_FILTER_ORDER: MerchantCategory[] = [
  'freelancer',
  'agency',
  'saas',
  'other',
  'uncategorized',
];

const OVERRIDE_CHOICES: { value: MerchantCategory; label: string }[] = [
  { value: 'freelancer', label: CATEGORY_LABELS.freelancer },
  { value: 'agency', label: CATEGORY_LABELS.agency },
  { value: 'saas', label: CATEGORY_LABELS.saas },
  { value: 'other', label: CATEGORY_LABELS.other },
];

export function MerchantsView({
  data,
  notice,
  error,
}: {
  data: MerchantsData;
  notice: string | null;
  error: string | null;
}) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [activationFilter, setActivationFilter] = useState<ActivationFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { merchants, categoryBreakdown, totals, activationRate, vampOverLine } = data;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((rec) => {
      if (categoryFilter !== 'all' && rec.category.category !== categoryFilter) return false;
      if (activationFilter === 'activated' && !rec.activation.stripeConnected) return false;
      if (activationFilter === 'unactivated' && rec.activation.stripeConnected) return false;
      if (q.length > 0) {
        const name = (rec.businessName ?? '').toLowerCase();
        const email = (rec.ownerEmail ?? '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [merchants, categoryFilter, activationFilter, query]);

  const unactivated = useMemo(
    () => merchants.filter((rec) => !rec.activation.stripeConnected),
    [merchants],
  );

  const selected = useMemo(
    () => merchants.find((rec) => rec.id === selectedId) ?? null,
    [merchants, selectedId],
  );

  const donutSegments = buildDonutSegments(categoryBreakdown);
  const categorizedCount = totals.merchants - categoryBreakdown.uncategorized;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Merchants</h1>
          <p className={s.sectionLead}>
            The customer base and its risk. Who they are, how they bill, whether they have connected
            Stripe, and which accounts are over the dispute line. Categories are inferred from real
            signals and can be set by hand.
          </p>
        </div>
        <div className={s.headerMeta}>
          <span className={s.metaLabel}>Activation</span>
          <span className={s.metaValue}>
            {activationRate == null
              ? 'No merchants yet'
              : `${Math.round(activationRate * 100)}% on Stripe`}
          </span>
        </div>
      </header>

      <Notice notice={notice} error={error} copy={NOTICE_COPY} />

      {/* Top KPIs */}
      <section className={s.cardGrid} aria-label="Merchant base">
        <KpiTile
          label="Merchants"
          value={formatNumber(totals.merchants)}
          sub="Total accounts"
          hint="View all merchants"
          onClick={() => {
            setCategoryFilter('all');
            setActivationFilter('all');
            setQuery('');
            document
              .getElementById('all-merchants')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        <KpiTile
          label="Activated"
          value={formatNumber(totals.activated)}
          sub="Stripe connected"
        />
        <KpiTile
          label="Unactivated"
          value={formatNumber(totals.unactivated)}
          sub="No Stripe connection"
        />
        <KpiTile
          label="Over the line"
          value={formatNumber(totals.overLine)}
          sub="VAMP ratio at or above 0.75%"
        />
      </section>

      {/* Category breakdown */}
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Differentiate the base</p>
            <h2 className={s.panelTitle}>Category breakdown</h2>
          </div>
          <span className={s.countPill}>
            {formatNumber(categorizedCount)} of {formatNumber(totals.merchants)} categorized
          </span>
        </div>
        {totals.merchants === 0 ? (
          <p className={s.sectionLead}>No merchants yet. Categories will appear as accounts sign up.</p>
        ) : (
          <div className={m.categorySplit}>
            <Donut
              segments={donutSegments}
              centerValue={formatNumber(totals.merchants)}
              centerLabel="merchants"
            />
            <div className={m.categoryCounts}>
              {CATEGORY_FILTER_ORDER.map((cat) => {
                const count = categoryBreakdown[cat];
                const share = totals.merchants > 0 ? count / totals.merchants : 0;
                return (
                  <div key={cat} className={m.categoryCount}>
                    <div className={m.categoryCountTop}>
                      <span className={m.categoryCountValue}>{formatNumber(count)}</span>
                      <span className={m.categoryCountShare}>{Math.round(share * 100)}%</span>
                    </div>
                    <div className={m.categoryCountFoot}>
                      <CategoryBadge category={cat} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className={s.sectionLead} style={{ marginTop: 12 }}>
          Categories come from a strict cascade: a founder override wins, then the merchant&rsquo;s
          self-selected persona, then activity patterns. Where there is no signal, the account stays
          honestly uncategorized.
        </p>
      </section>

      {/* VAMP / over the line */}
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Risk</p>
            <h2 className={s.panelTitle}>Over the VAMP line</h2>
          </div>
          <span className={s.countPill}>{formatNumber(vampOverLine.length)} merchants</span>
        </div>
        {vampOverLine.length === 0 ? (
          <p className={s.sectionLead}>
            No merchant is currently at or above the 0.75% Stripe dispute line. Accounts appear here
            the moment their latest VAMP snapshot crosses it.
          </p>
        ) : (
          <div className={m.vampList}>
            {vampOverLine.map((item) => (
              <VampRow key={item.merchantId} item={item} onOpen={() => setSelectedId(item.merchantId)} />
            ))}
          </div>
        )}
      </section>

      {/* Unactivated worklist */}
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Activation worklist</p>
            <h2 className={s.panelTitle}>Signed up, no Stripe yet</h2>
          </div>
          <span className={s.countPill}>{formatNumber(unactivated.length)} to activate</span>
        </div>
        {unactivated.length === 0 ? (
          <p className={s.sectionLead}>
            {totals.merchants === 0
              ? 'No merchants yet.'
              : 'Every merchant has connected Stripe. Nothing to chase here.'}
          </p>
        ) : (
          <div className={s.worklist}>
            {unactivated
              .map((rec) => ({
                rec,
                item: scoreUnactivatedMerchant(
                  {
                    merchant: {
                      id: rec.id,
                      business_name: rec.businessName,
                      created_at: rec.createdAt,
                    },
                    daysSinceSignup: rec.daysSinceSignup,
                    profileComplete: rec.profile.completeness >= 1,
                  },
                  Date.now(),
                ),
              }))
              .sort((a, b) => b.item.score - a.item.score)
              .map(({ rec, item }) => (
                <button
                  key={rec.id}
                  type="button"
                  className={s.worklistItem}
                  onClick={() => setSelectedId(rec.id)}
                >
                  <ScoreChip score={item.score} />
                  <div className={s.worklistMain}>
                    <span className={s.worklistLabel}>{rec.businessName || 'Unnamed workspace'}</span>
                    <span className={s.worklistWhy}>{item.whyNow}</span>
                  </div>
                  <span className={s.worklistMeta}>{relativeTime(rec.createdAt)}</span>
                </button>
              ))}
          </div>
        )}
      </section>

      {/* Merchant table */}
      <section className={s.panel} id="all-merchants">
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Accounts</p>
            <h2 className={s.panelTitle}>All merchants</h2>
          </div>
          <span className={s.countPill}>{formatNumber(filtered.length)} shown</span>
        </div>

        <div className={s.filterBar}>
          <div className={s.searchWrap}>
            <input
              type="search"
              className={s.searchInput}
              placeholder="Search by name or owner email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search merchants"
            />
          </div>
        </div>

        <div className={s.chipRow} role="group" aria-label="Filter by category">
          <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
            All categories
          </FilterChip>
          {CATEGORY_FILTER_ORDER.map((cat) => (
            <FilterChip
              key={cat}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </FilterChip>
          ))}
        </div>

        <div className={s.chipRow} role="group" aria-label="Filter by activation">
          <FilterChip active={activationFilter === 'all'} onClick={() => setActivationFilter('all')}>
            Any activation
          </FilterChip>
          <FilterChip
            active={activationFilter === 'activated'}
            onClick={() => setActivationFilter('activated')}
          >
            Stripe connected
          </FilterChip>
          <FilterChip
            active={activationFilter === 'unactivated'}
            onClick={() => setActivationFilter('unactivated')}
          >
            Not connected
          </FilterChip>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Category</th>
                <th>Activation</th>
                <th>VAMP</th>
                <th className={s.numCell}>Disputes</th>
                <th>Profile</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow
                  colSpan={7}
                  label={
                    merchants.length === 0
                      ? 'No merchants yet.'
                      : 'No merchants match these filters.'
                  }
                />
              ) : (
                filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => setSelectedId(rec.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className={s.strong}>
                      {rec.businessName || 'Unnamed workspace'}
                      {rec.ownerEmail ? <span className={s.cellNote}>{rec.ownerEmail}</span> : null}
                    </td>
                    <td>
                      <CategoryBadge category={rec.category.category} />
                      {rec.category.source === 'admin_override' ? (
                        <span className={s.cellNote}>set by founder</span>
                      ) : null}
                    </td>
                    <td>
                      {rec.activation.stripeConnected ? (
                        <Badge tone="verdict" dot>
                          Stripe connected
                        </Badge>
                      ) : (
                        <Badge tone="muted">Not connected</Badge>
                      )}
                    </td>
                    <td>
                      <StandingBadge band={rec.vamp.band} />
                    </td>
                    <td className={s.numCell}>{formatNumber(rec.disputes.total)}</td>
                    <td>
                      <Completeness profile={rec.profile} />
                    </td>
                    <td>{formatDateShort(rec.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <MerchantDrawer record={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

function MerchantDrawer({
  record,
  onClose,
}: {
  record: MerchantRecord | null;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  const { category, activation, vamp, disputes, profile } = record;
  const overLine = vamp.ratio != null && vamp.band === 'atRisk';

  const nudge = !activation.stripeConnected
    ? scoreUnactivatedMerchant(
        {
          merchant: {
            id: record.id,
            business_name: record.businessName,
            created_at: record.createdAt,
          },
          daysSinceSignup: record.daysSinceSignup,
          profileComplete: profile.completeness >= 1,
        },
        Date.now(),
      )
    : null;

  const vampDraft = overLine
    ? draftVampAlert({
        businessName: record.businessName,
        ratioPct: (vamp.ratio as number) * 100,
      })
    : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={record.businessName || 'Unnamed workspace'}
      eyebrow="Merchant"
      width="wide"
    >
      {/* Identity */}
      <DrawerSection title="Identity">
        <DetailRow label="Business">{record.businessName || 'Unnamed workspace'}</DetailRow>
        <DetailRow label="Owner email">{record.ownerEmail ?? 'Not captured yet'}</DetailRow>
        <DetailRow label="Created">
          {formatDateShort(record.createdAt)} · {relativeTime(record.createdAt)}
        </DetailRow>
      </DrawerSection>

      {/* Category + override */}
      <DrawerSection title="Category">
        <DetailRow label="Best guess">
          <CategoryBadge category={category.category} />
        </DetailRow>
        <DetailRow label="Source">
          <SourceNote source={category.source} />
        </DetailRow>
        <DetailRow label="Confidence">{Math.round(category.confidence * 100)}%</DetailRow>
        <WhyNow tone="neutral">{category.rationale}</WhyNow>

        <form action={setCategoryAction} className={m.overrideForm}>
          <input type="hidden" name="merchantId" value={record.id} />
          <div className={m.overrideRow}>
            <div className={m.overrideField}>
              <label className={s.label} htmlFor="category-override">
                Set category by hand
              </label>
              <select
                id="category-override"
                name="category"
                className={m.select}
                defaultValue={profile.categoryOverride ?? ''}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {OVERRIDE_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={s.primaryBtn}>
              Save override
            </button>
          </div>
          <p className={m.overrideHint}>
            A founder override always wins over inferred categories. It is recorded against this
            merchant&rsquo;s profile as {SOURCE_LABELS.admin_override.toLowerCase()}.
          </p>
        </form>
      </DrawerSection>

      {/* Activation */}
      <DrawerSection title="Activation">
        <DetailRow label="Stripe">
          {activation.stripeConnected ? (
            <Badge tone="verdict" dot>
              Connected
            </Badge>
          ) : (
            <Badge tone="muted">Not connected</Badge>
          )}
        </DetailRow>
        {activation.connectedAt ? (
          <DetailRow label="Connected">{formatDateShort(activation.connectedAt)}</DetailRow>
        ) : null}
      </DrawerSection>

      {/* VAMP standing */}
      <DrawerSection title="VAMP standing">
        <DetailRow label="Band">
          <StandingBadge band={vamp.band} />
        </DetailRow>
        <DetailRow label="Estimated ratio">
          {vamp.ratio == null ? 'Not scored yet' : formatPercentFraction(vamp.ratio)}
        </DetailRow>
        {vamp.calculatedAt ? (
          <DetailRow label="Last calculated">{formatDateShort(vamp.calculatedAt)}</DetailRow>
        ) : null}
        {vamp.confidence ? <DetailRow label="Confidence">{vamp.confidence}</DetailRow> : null}
        {overLine ? (
          <WhyNow tone="gap">
            This merchant is at or above the 0.75% Stripe dispute line. Worth getting ahead of.
          </WhyNow>
        ) : null}
      </DrawerSection>

      {/* Disputes summary */}
      <DrawerSection title="Disputes">
        <DetailRow label="Total">{formatNumber(disputes.total)}</DetailRow>
        <DetailRow label="Won / lost">
          {formatNumber(disputes.won)} won · {formatNumber(disputes.lost)} lost
        </DetailRow>
        <DetailRow label="Open">{formatNumber(disputes.open)}</DetailRow>
        <DetailRow label="Avg amount">
          {disputes.avgAmountUsd == null
            ? 'Not captured yet'
            : `$${disputes.avgAmountUsd.toFixed(2)}`}
        </DetailRow>
        <DetailRow label="Subscription-cancel share">
          {disputes.total === 0
            ? 'No disputes on record'
            : `${Math.round(disputes.subscriptionCanceledShare * 100)}%`}
        </DetailRow>
      </DrawerSection>

      {/* Profile completeness */}
      <DrawerSection title="Profile completeness">
        <DetailRow label="Completeness">
          <Completeness profile={profile} />
        </DetailRow>
        <DetailRow label="Persona">{profile.persona ?? 'Not set'}</DetailRow>
        <DetailRow label="Customer type">{profile.customerType ?? 'Not set'}</DetailRow>
        <DetailRow label="Delivery">{profile.deliveryMethod ?? 'Not set'}</DetailRow>
        <DetailRow label="Product">{profile.productDescription ?? 'Not captured yet'}</DetailRow>
      </DrawerSection>

      {/* Convert / nudge draft for unactivated */}
      {nudge ? (
        <DrawerSection title="Activation nudge">
          <WhyNow tone="neutral">{nudge.whyNow}</WhyNow>
          <p className={s.sectionLead}>{nudge.recommendedAction}</p>
          <DraftBlock draft={nudge.draft} />
        </DrawerSection>
      ) : null}

      {/* VAMP alert draft for over-the-line */}
      {vampDraft ? (
        <DrawerSection title="VAMP alert">
          <p className={s.sectionLead}>
            A network-guided heads-up the founder can copy and send from their own inbox. Marking it
            drafted records the action only. Nothing is ever sent from Verdact.
          </p>
          <DraftBlock draft={vampDraft} />
          <form action={markVampDraftedAction}>
            <input type="hidden" name="merchantId" value={record.id} />
            <input type="hidden" name="ratio" value={String(vamp.ratio ?? '')} />
            <input type="hidden" name="band" value={vamp.band} />
            <button type="submit" className={s.secondaryBtn}>
              Mark alert as drafted
            </button>
          </form>
        </DrawerSection>
      ) : null}
    </Drawer>
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  onClick,
  hint,
}: {
  label: string;
  value: string;
  sub: string;
  /** When provided, the tile becomes an interactive button (e.g. jump to the list). */
  onClick?: () => void;
  /** Accessible label / tooltip for the interactive variant. */
  hint?: string;
}) {
  if (onClick) {
    return (
      <div
        className={s.statCard}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: 'pointer' }}
        title={hint}
        aria-label={hint ?? `${label}: ${value}`}
      >
        <span className={s.metricLabel}>{label}</span>
        <strong className={s.statValue}>{value}</strong>
        <span className={s.statSub}>{sub}</span>
      </div>
    );
  }
  return (
    <div className={s.statCard}>
      <span className={s.metricLabel}>{label}</span>
      <strong className={s.statValue}>{value}</strong>
      <span className={s.statSub}>{sub}</span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.chip} ${active ? s.chipActive : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Completeness({
  profile,
}: {
  profile: { completeness: number; filledFields: number; totalFields: number };
}) {
  const pct = Math.round(profile.completeness * 100);
  return (
    <span className={m.completeness}>
      <span className={m.completenessTrack}>
        <span className={m.completenessFill} style={{ width: `${pct}%` }} />
      </span>
      <span className={m.completenessLabel}>
        {profile.filledFields}/{profile.totalFields}
      </span>
    </span>
  );
}

function VampRow({ item, onOpen }: { item: VampOverLineItem; onOpen: () => void }) {
  return (
    <button type="button" className={m.vampItem} onClick={onOpen}>
      <div className={m.vampMain}>
        <span className={m.vampName}>{item.businessName || 'Unnamed workspace'}</span>
        <span className={m.vampMeta}>
          {item.overLineSince ? `Over the line since ${formatDateShort(item.overLineSince)}` : 'Over the line'}
          {' · '}
          {item.drafted ? (
            <span className={`${m.draftStatus} ${m.draftStatusDone}`}>Alert drafted</span>
          ) : (
            <span className={`${m.draftStatus} ${m.draftStatusPending}`}>No alert drafted yet</span>
          )}
        </span>
      </div>
      <span className={m.vampRatio}>{formatPercentFraction(item.ratio)}</span>
    </button>
  );
}

// ── Donut segment builder ────────────────────────────────────────────────────

function buildDonutSegments(breakdown: MerchantsData['categoryBreakdown']): DonutSegment[] {
  // Color is for status only; category is descriptive, so we render the split in
  // neutral tones and let the legend + badges carry the labels. The uncategorized
  // slice is also neutral — it is honest absence, not a risk state.
  const segments: DonutSegment[] = [];
  for (const cat of CATEGORY_FILTER_ORDER) {
    const value = breakdown[cat];
    if (value > 0) {
      segments.push({ label: CATEGORY_LABELS[cat], value, tone: 'neutral' });
    }
  }
  return segments;
}
