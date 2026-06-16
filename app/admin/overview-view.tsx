'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { CommandData, WorklistItem, VampAtRiskItem, RecentSignup } from './command-data';
import type { RangeKey } from '@/lib/admin/ranges';
import type { AuditLeadRow, MerchantRow } from '@/lib/admin/queries';
import { Drawer, DrawerSection, DetailRow, WhyNow } from './_components/drawer';
import { RangeTabs, ScoreChip, Badge, StandingBadge, Chevron } from './_components/console';
import { DraftBlock } from './_components/console-client';
import { Funnel, DeltaBadge, Sparkline, type Tone } from './_components/charts';
import {
  formatNumber,
  formatPercentFraction,
  relativeTime,
  formatDateShort,
} from './_components/ui';
import s from './admin.module.css';
import c from './command.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND — the operator morning screen. An asymmetric bento, not a uniform
// grid. The hero tile carries the single most important state (acquisition →
// activation funnel health + the "needs you now" count). Every surrounding tile
// is a button that opens the master-detail Drawer with the who / why / what-next
// for that metric. A "Needs you now" worklist preview ranks the hottest convert
// items; clicking one opens its outreach draft (copy-only, never sent).
//
// Honest data only. Empty slices render real "not captured yet" states. No
// public win-rate claims, no guarantees, no em dashes in copy.
// ─────────────────────────────────────────────────────────────────────────────

type DrawerKey =
  | { kind: 'waitlist' }
  | { kind: 'auditLeads' }
  | { kind: 'merchants' }
  | { kind: 'activated' }
  | { kind: 'disputes' }
  | { kind: 'vamp' }
  | { kind: 'needs' }
  | { kind: 'work'; item: WorklistItem };

export function OverviewView({ data }: { data: CommandData }) {
  const [drawer, setDrawer] = useState<DrawerKey | null>(null);
  const close = () => setDrawer(null);

  // Path-aware + deterministic (no window read) so the href is identical on the
  // server and client (no hydration mismatch) and stays on the current path,
  // including the /dev/admin?view= preview. Preserves other query params.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hrefForRange = useMemo(
    () => (key: RangeKey): string => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('range', key);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  const { totals, kpis, vamp, vampAtRisk, worklist, worklistTotal, outcomes } = data;
  const activationPct = data.activationRate != null ? Math.round(data.activationRate * 100) : null;
  const conversionPct = data.conversionRate != null ? Math.round(data.conversionRate * 100) : null;

  // The single most important number on the screen: how many things need a human.
  const needsYouNow = worklistTotal + vampAtRisk.length;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Command</h1>
          <p className={s.sectionLead}>
            Your morning read on the platform. Deltas and trends reflect {data.rangeLabel.toLowerCase()}.
          </p>
        </div>
        <div className={s.headerActions}>
          <RangeTabs active={data.range} hrefForRange={hrefForRange} />
        </div>
      </header>

      {/* ── Asymmetric bento ─────────────────────────────────────────────── */}
      <section className={s.bento} aria-label="Command tiles">
        {/* HERO: funnel health + needs-you-now count */}
        <button type="button" className={`${s.tile} ${s.tileHero} ${s.bentoHero}`} onClick={() => setDrawer({ kind: 'needs' })}>
          <div className={s.tileTop}>
            <span className={s.metricLabel}>Needs you now</span>
            <Chevron />
          </div>
          <strong className={s.tileValue}>{formatNumber(needsYouNow)}</strong>
          <div className={c.heroMeta}>
            <HeroStat label="Hottest leads + nudges" value={formatNumber(worklistTotal)} />
            <HeroStat label="Over the VAMP line" value={formatNumber(vampAtRisk.length)} tone={vampAtRisk.length > 0 ? 'gap' : 'neutral'} />
          </div>
          <div className={c.heroFunnel}>
            <div className={c.heroFunnelHead}>
              <span className={s.metricLabel}>Acquisition to activation</span>
              <span className={s.countPill}>
                {conversionPct != null ? `${conversionPct}% lead to merchant` : 'No leads yet'}
              </span>
            </div>
            <Funnel steps={data.funnel} />
          </div>
        </button>

        <KpiTile
          label="Waitlist"
          total={totals.waitlist}
          kpi={kpis.waitlist}
          onOpen={() => setDrawer({ kind: 'waitlist' })}
        />
        <KpiTile
          label="Audit leads"
          total={totals.auditLeads}
          kpi={kpis.auditLeads}
          onOpen={() => setDrawer({ kind: 'auditLeads' })}
        />
        <KpiTile
          label="Merchants"
          total={totals.merchants}
          kpi={kpis.merchants}
          onOpen={() => setDrawer({ kind: 'merchants' })}
        />
        <button type="button" className={s.tile} onClick={() => setDrawer({ kind: 'activated' })}>
          <div className={s.tileTop}>
            <span className={s.metricLabel}>Activated</span>
            <Chevron />
          </div>
          <strong className={s.tileValue}>{formatNumber(totals.stripeConnected)}</strong>
          <span className={s.tileSub}>
            {activationPct != null ? `${activationPct}% of merchants on Stripe` : 'No merchants yet'}
          </span>
        </button>

        <button type="button" className={s.tile} onClick={() => setDrawer({ kind: 'disputes' })}>
          <div className={s.tileTop}>
            <span className={s.metricLabel}>Disputes</span>
            <Chevron />
          </div>
          <strong className={s.tileValue}>{formatNumber(totals.disputes)}</strong>
          <span className={s.tileSub}>
            {formatNumber(outcomes.won)} won · {formatNumber(outcomes.lost)} lost · {formatNumber(outcomes.open)} open
          </span>
        </button>

        <button type="button" className={s.tile} onClick={() => setDrawer({ kind: 'vamp' })}>
          <div className={s.tileTop}>
            <span className={s.metricLabel}>VAMP at risk</span>
            <Chevron />
          </div>
          <strong className={s.tileValue}>{formatNumber(vamp.atRisk)}</strong>
          <span className={s.tileSub}>
            {vamp.measured > 0
              ? `${formatNumber(vamp.atRisk)} over · ${formatNumber(vamp.close)} close · ${formatNumber(vamp.healthy)} healthy`
              : 'No merchant scored yet'}
          </span>
        </button>
      </section>

      {/* ── Needs you now worklist preview ───────────────────────────────── */}
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Needs you now</p>
            <h2 className={s.panelTitle}>Ranked worklist</h2>
          </div>
          <span className={s.countPill}>
            {worklistTotal > 0 ? `${formatNumber(worklistTotal)} ranked` : 'Clear'}
          </span>
        </div>
        {worklist.length === 0 ? (
          <p className={s.sectionLead}>
            Nothing needs you right now. New audit leads and unactivated merchants will surface here, ranked by how warm they are.
          </p>
        ) : (
          <div className={s.worklist}>
            {worklist.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                className={s.worklistItem}
                onClick={() => setDrawer({ kind: 'work', item })}
              >
                <ScoreChip score={item.score} />
                <span className={s.worklistMain}>
                  <span className={s.worklistLabel}>{item.label}</span>
                  <span className={s.worklistWhy}>{item.whyNow}</span>
                </span>
                <span className={s.worklistMeta}>
                  <Badge tone="muted">{kindLabel(item.kind)}</Badge>
                  <Chevron />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent activity preview ──────────────────────────────────────── */}
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <p className={s.panelKicker}>Live</p>
            <h2 className={s.panelTitle}>Recent activity</h2>
          </div>
          <a className={s.textBtn} href="/admin/activity">
            View all
          </a>
        </div>
        {data.feed.length === 0 ? (
          <p className={s.sectionLead}>Nothing has happened yet. Signups, merchants, and admin actions show up here.</p>
        ) : (
          <div className={s.feed}>
            {data.feed.map((item) => (
              <div key={item.id} className={s.feedRow}>
                <span className={s.feedWhen}>{relativeTime(item.when)}</span>
                <span className={s.feedText}>{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Drawer ───────────────────────────────────────────────────────── */}
      {renderDrawer(drawer, data, close)}
    </div>
  );
}

// ── Hero sub-pieces ──────────────────────────────────────────────────────────

function HeroStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={c.heroStat}>
      <span className={`${c.heroStatValue} ${tone === 'gap' ? c.heroStatGap : ''}`}>{value}</span>
      <span className={c.heroStatLabel}>{label}</span>
    </div>
  );
}

function KpiTile({
  label,
  total,
  kpi,
  onOpen,
}: {
  label: string;
  total: number;
  kpi: CommandData['kpis']['waitlist'];
  onOpen: () => void;
}) {
  const tone: Tone = kpi.delta >= 0 ? 'verdict' : 'gap';
  return (
    <button type="button" className={s.tile} onClick={onOpen}>
      <div className={s.tileTop}>
        <span className={s.metricLabel}>{label}</span>
        {kpi.current > 0 || kpi.prior > 0 ? <DeltaBadge delta={kpi.delta} /> : <Chevron />}
      </div>
      <strong className={s.tileValue}>{formatNumber(total)}</strong>
      {kpi.spark.length > 0 ? <Sparkline points={kpi.spark} tone={tone} /> : null}
      <span className={s.tileSub}>{formatNumber(kpi.current)} new in window</span>
    </button>
  );
}

// ── Drawer router ────────────────────────────────────────────────────────────

function renderDrawer(drawer: DrawerKey | null, data: CommandData, close: () => void) {
  if (!drawer) return null;

  switch (drawer.kind) {
    case 'needs':
      return <NeedsDrawer data={data} onClose={close} />;
    case 'waitlist':
      return <WaitlistDrawer data={data} onClose={close} />;
    case 'auditLeads':
      return <AuditLeadsDrawer data={data} onClose={close} />;
    case 'merchants':
      return <MerchantsDrawer data={data} onClose={close} />;
    case 'activated':
      return <ActivatedDrawer data={data} onClose={close} />;
    case 'disputes':
      return <DisputesDrawer data={data} onClose={close} />;
    case 'vamp':
      return <VampDrawer data={data} onClose={close} />;
    case 'work':
      return <WorkItemDrawer item={drawer.item} onClose={close} />;
  }
}

function NeedsDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { worklist, worklistTotal, vampAtRisk } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Command" title="Needs you now">
      <DrawerSection>
        <WhyNow tone={worklistTotal + vampAtRisk.length > 0 ? 'gap' : 'neutral'}>
          {worklistTotal + vampAtRisk.length > 0
            ? `${formatNumber(worklistTotal)} ranked outreach ${plural(worklistTotal, 'item', 'items')} and ${formatNumber(vampAtRisk.length)} ${plural(vampAtRisk.length, 'merchant', 'merchants')} over the VAMP line are waiting on you.`
            : 'Nothing needs you right now. The worklist is clear and no merchant is over the line.'}
        </WhyNow>
      </DrawerSection>

      {worklist.length > 0 ? (
        <DrawerSection title="Top of the worklist">
          <div className={s.worklist}>
            {worklist.map((item) => (
              <div key={`${item.kind}-${item.id}`} className={s.worklistItem} style={{ cursor: 'default' }}>
                <ScoreChip score={item.score} />
                <span className={s.worklistMain}>
                  <span className={s.worklistLabel}>{item.label}</span>
                  <span className={s.worklistWhy}>{item.whyNow}</span>
                </span>
                <span className={s.worklistMeta}>
                  <Badge tone="muted">{kindLabel(item.kind)}</Badge>
                </span>
              </div>
            ))}
          </div>
        </DrawerSection>
      ) : null}

      {vampAtRisk.length > 0 ? (
        <DrawerSection title="Over the VAMP line">
          {vampAtRisk.slice(0, 5).map((m) => (
            <DetailRow key={m.merchantId} label={m.businessName || 'Unnamed workspace'}>
              <StandingBadge band="atRisk" /> {m.ratioPct.toFixed(2)}%
            </DetailRow>
          ))}
        </DrawerSection>
      ) : null}

      <DrawerSection>
        <a className={s.secondaryBtn} href="/admin/leads">
          Open Leads
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function WaitlistDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { recentSignups } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Acquisition" title="Waitlist">
      <DrawerSection>
        <DetailRow label="Total signups">{formatNumber(data.totals.waitlist)}</DetailRow>
        <DetailRow label="New in window">{formatNumber(data.kpis.waitlist.current)}</DetailRow>
        <DetailRow label="vs prior window">
          <DeltaBadge delta={data.kpis.waitlist.delta} />
        </DetailRow>
      </DrawerSection>
      <DrawerSection title="Recent signups">
        {recentSignups.length === 0 ? (
          <p className={s.sectionLead}>No signups captured yet.</p>
        ) : (
          recentSignups.map((sig: RecentSignup) => (
            <DetailRow key={sig.id} label={sig.email}>
              {sig.source ? <Badge tone="muted">{sig.source}</Badge> : null} {formatDateShort(sig.created_at)}
            </DetailRow>
          ))
        )}
      </DrawerSection>
      <DrawerSection>
        <a className={s.secondaryBtn} href="/admin/leads">
          View all in Leads
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function AuditLeadsDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { recentAuditLeads } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Acquisition" title="Audit leads">
      <DrawerSection>
        <DetailRow label="Total leads">{formatNumber(data.totals.auditLeads)}</DetailRow>
        <DetailRow label="New in window">{formatNumber(data.kpis.auditLeads.current)}</DetailRow>
        <DetailRow label="vs prior window">
          <DeltaBadge delta={data.kpis.auditLeads.delta} />
        </DetailRow>
        <DetailRow label="Lead to merchant">
          {data.conversionRate != null ? `${Math.round(data.conversionRate * 100)}%` : 'No leads yet'}
        </DetailRow>
      </DrawerSection>
      <DrawerSection title="Recent audits">
        {recentAuditLeads.length === 0 ? (
          <p className={s.sectionLead}>No audit leads captured yet.</p>
        ) : (
          recentAuditLeads.map((lead: AuditLeadRow) => (
            <DetailRow key={lead.id} label={lead.business_name || lead.email}>
              <StandingBadge band={lead.standing_band} /> {formatPercentFraction(lead.estimated_dispute_rate)}
            </DetailRow>
          ))
        )}
      </DrawerSection>
      <DrawerSection>
        <a className={s.secondaryBtn} href="/admin/leads">
          View all in Leads
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function MerchantsDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { recentMerchants } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Product" title="Merchants">
      <DrawerSection>
        <DetailRow label="Total merchants">{formatNumber(data.totals.merchants)}</DetailRow>
        <DetailRow label="New in window">{formatNumber(data.kpis.merchants.current)}</DetailRow>
        <DetailRow label="vs prior window">
          <DeltaBadge delta={data.kpis.merchants.delta} />
        </DetailRow>
        <DetailRow label="On Stripe">
          {data.activationRate != null ? `${formatNumber(data.totals.stripeConnected)} (${Math.round(data.activationRate * 100)}%)` : 'No merchants yet'}
        </DetailRow>
      </DrawerSection>
      <DrawerSection title="Recent merchants">
        {recentMerchants.length === 0 ? (
          <p className={s.sectionLead}>No merchants yet.</p>
        ) : (
          recentMerchants.map((m: MerchantRow) => (
            <DetailRow key={m.id} label={m.business_name || 'Unnamed workspace'}>
              {formatDateShort(m.created_at)}
            </DetailRow>
          ))
        )}
      </DrawerSection>
      <DrawerSection>
        <a className={s.secondaryBtn} href="/admin/merchants">
          View all in Merchants
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function ActivatedDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const pct = data.activationRate != null ? Math.round(data.activationRate * 100) : null;
  const unactivated = Math.max(data.totals.merchants - data.totals.stripeConnected, 0);
  return (
    <Drawer open onClose={onClose} eyebrow="Activation" title="Stripe activated">
      <DrawerSection>
        <WhyNow tone={unactivated > 0 ? 'neutral' : 'verdict'}>
          {pct != null
            ? `${pct}% of merchants have connected Stripe. ${formatNumber(unactivated)} ${plural(unactivated, 'merchant has', 'merchants have')} signed up but not connected yet.`
            : 'No merchants have signed up yet, so there is nothing to activate.'}
        </WhyNow>
      </DrawerSection>
      <DrawerSection>
        <DetailRow label="Activated">{formatNumber(data.totals.stripeConnected)}</DetailRow>
        <DetailRow label="Not yet connected">{formatNumber(unactivated)}</DetailRow>
        <DetailRow label="Activation rate">{pct != null ? `${pct}%` : 'n/a'}</DetailRow>
      </DrawerSection>
      <DrawerSection>
        <p className={s.sectionLead}>
          Unactivated merchants surface in the worklist as activation nudges. Stripe is the one step that lets Verdact pull dispute history.
        </p>
        <a className={s.secondaryBtn} href="/admin/merchants">
          Open Merchants
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function DisputesDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { outcomes } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Product" title="Disputes">
      <DrawerSection>
        <DetailRow label="Total disputes">{formatNumber(data.totals.disputes)}</DetailRow>
        <DetailRow label="New in window">{formatNumber(data.kpis.disputes.current)}</DetailRow>
        <DetailRow label="vs prior window">
          <DeltaBadge delta={data.kpis.disputes.delta} />
        </DetailRow>
      </DrawerSection>
      <DrawerSection title="Outcomes">
        <DetailRow label="Won">{formatNumber(outcomes.won)}</DetailRow>
        <DetailRow label="Lost">{formatNumber(outcomes.lost)}</DetailRow>
        <DetailRow label="Open">{formatNumber(outcomes.open)}</DetailRow>
        <DetailRow label="Warning closed">{formatNumber(outcomes.warningClosed)}</DetailRow>
      </DrawerSection>
      <DrawerSection>
        <p className={s.sectionLead}>
          Outcomes are counts only. Warning-closed cases are tracked separately and never counted as won or lost.
        </p>
        <a className={s.secondaryBtn} href="/admin/disputes">
          Open Disputes
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function VampDrawer({ data, onClose }: { data: CommandData; onClose: () => void }) {
  const { vamp, vampAtRisk } = data;
  return (
    <Drawer open onClose={onClose} eyebrow="Account health" title="VAMP standing">
      <DrawerSection>
        <WhyNow tone={vamp.atRisk > 0 ? 'gap' : 'verdict'}>
          {vamp.measured === 0
            ? 'No merchant has enough settled volume for a confident VAMP read yet.'
            : vamp.atRisk > 0
              ? `${formatNumber(vamp.atRisk)} ${plural(vamp.atRisk, 'merchant is', 'merchants are')} over the Stripe dispute line. Each one has a heads-up draft ready below.`
              : 'No merchant is over the Stripe dispute line right now.'}
        </WhyNow>
      </DrawerSection>
      <DrawerSection>
        <DetailRow label="Over the line">{formatNumber(vamp.atRisk)}</DetailRow>
        <DetailRow label="Getting close">{formatNumber(vamp.close)}</DetailRow>
        <DetailRow label="Healthy">{formatNumber(vamp.healthy)}</DetailRow>
        <DetailRow label="Not scored">{formatNumber(vamp.notScored)}</DetailRow>
      </DrawerSection>
      {vampAtRisk.length > 0 ? (
        <DrawerSection title="Over-the-line merchants">
          {vampAtRisk.map((m: VampAtRiskItem) => (
            <DetailRow key={m.merchantId} label={m.businessName || 'Unnamed workspace'}>
              <StandingBadge band="atRisk" /> {m.ratioPct.toFixed(2)}%
            </DetailRow>
          ))}
          <DraftBlock draft={vampAtRisk[0].draft} />
        </DrawerSection>
      ) : null}
      <DrawerSection>
        <a className={s.secondaryBtn} href="/admin/merchants">
          Open Merchants
        </a>
      </DrawerSection>
    </Drawer>
  );
}

function WorkItemDrawer({ item, onClose }: { item: WorklistItem; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} eyebrow={kindLabel(item.kind)} title={item.label}>
      <DrawerSection>
        <WhyNow tone={item.score >= 70 ? 'gap' : 'neutral'}>{item.whyNow}</WhyNow>
        <DetailRow label="Propensity score">
          <ScoreChip score={item.score} />
        </DetailRow>
        <DetailRow label="Recommended next step">{item.recommendedAction}</DetailRow>
      </DrawerSection>
      {item.signals.length > 0 ? (
        <DrawerSection title="Signals">
          {item.signals.map((sig, i) => (
            <DetailRow key={i} label={`Signal ${i + 1}`}>
              {sig}
            </DetailRow>
          ))}
        </DrawerSection>
      ) : null}
      <DrawerSection title="Outreach draft">
        <DraftBlock draft={item.draft} />
      </DrawerSection>
      <DrawerSection>
        <a className={s.secondaryBtn} href={item.href}>
          Open in {item.href.includes('merchants') ? 'Merchants' : 'Leads'}
        </a>
      </DrawerSection>
    </Drawer>
  );
}

// ── Small utilities ──────────────────────────────────────────────────────────

function kindLabel(kind: WorklistItem['kind']): string {
  if (kind === 'audit_lead') return 'Audit lead';
  if (kind === 'waitlist') return 'Waitlist';
  return 'Unactivated';
}

function plural(count: number, singular: string, many: string): string {
  return count === 1 ? singular : many;
}
