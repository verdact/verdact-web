import type { ReactNode } from 'react';
import { AppShell } from '../_components/app-chrome';
import { ConnectStripePanel } from '../_components/connect-stripe-panel';
import { SectionBar } from '../_components/ui/section-bar';
import { StatusBadge } from '../_components/ui/status-badge';
import { ReassureCard } from '../_components/ui/reassure-card';
import { GlossaryTerm } from '../_components/ui/glossary-term';
import { type Dispute, type EfwAlert } from '@/lib/dal';
import { type GuidanceItem, type GuidanceResult, type HealthBand } from '@/lib/guidance';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  InfoCircleIcon,
  ShieldIcon,
  ListIcon,
  RouteIcon,
  ArrowRightIcon,
} from './dash-icons';
import { dismissGuidanceAction } from './actions';
import {
  OPEN_STATUSES,
  STRIPE_LINE_FRACTION,
  GAUGE_MAX_FRACTION,
  bandFor,
  daysUntil,
  deadlineTier,
  type DeadlineTier,
  byDeadlineThenCreated,
  freshnessLabel,
  deriveNeedsAttentionCount,
} from './signals';
import s from './dashboard.module.css';

// Deadline pill class for the row/case figure (calm 3-step gradient, not binary).
// Only a genuinely urgent/over-deadline case earns vermilion; "soon" is amber and
// comfortable stays neutral. Thresholds live in signals.ts; never re-derived here.
function deadClass(tier: DeadlineTier): string {
  if (tier === 'urgent') return `${s.dead} ${s.deadUrgent}`;
  if (tier === 'soon') return `${s.dead} ${s.deadSoon}`;
  return s.dead;
}

// At most this many guidance tips render on the dashboard at once (redesign plan
// §3.2: one "do this now" gap/action + one "get safer" prevention).
const MAX_DASHBOARD_TIPS = 2;

// ── Shared types ─────────────────────────────────────────────────────────────

export type StripeConnection = {
  id: string;
  processor_account_id: string;
  livemode: boolean;
  connected_at: string | null;
} | null;

export type DashboardViewProps = {
  email: string | null | undefined;
  businessName: string | null;
  fullName: string | null;
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  vampRatio: number | null;
  vampConfidence: 'low' | 'medium' | 'high' | null;
  // Proof purposes on file per dispute id (e.g. ['Delivery','Policy']). Real
  // booleans from one batched evidence_files read — never fabricated.
  proofByDispute: Record<string, string[]>;
  stripeConnection: StripeConnection;
  justConnected: boolean;
  stripeError: string | null;
  // Guidance band + primers, already evaluated (with persona + cadence) in the
  // server wrapper. The view only renders it.
  guidance: GuidanceResult;
  // Adaptive-dashboard trigger (redesign plan §2.2), derived server-side in
  // page.tsx. 0 → MODE A (health-hero, vermilion-free); >=1 → MODE B (dispute-hero).
  // Optional so the dev preview route can render without recomputing it; when
  // omitted the view derives the same value from disputes + efwAlerts.
  needsAttentionCount?: number;
};

const STRIPE_ERROR_MESSAGES: Record<string, string> = {
  denied: 'Stripe connection was cancelled.',
  invalid_state: 'OAuth state mismatch. Please try again.',
  no_code: 'No authorization code received from Stripe.',
  exchange_failed: 'Stripe token exchange failed. Please try again.',
  db_error: 'Connection was authorised but could not be saved. Please try again.',
  account_in_use: 'That Stripe account is already connected to another workspace.',
  no_merchant: 'Workspace not found. Please sign out and back in.',
  not_configured: 'Stripe Connect is not configured on this deployment.',
};

// OPEN_STATUSES, STRIPE_LINE_FRACTION, GAUGE_MAX_FRACTION, URGENT_DAYS, bandFor,
// daysUntil, and byDeadlineThenCreated now live in ./signals (+ lib/guidance for
// URGENT_DAYS) so this view and page.tsx share one source of truth.

type CssModuleStyles = Record<string, string>;

// ── Presentational view ──────────────────────────────────────────────────────
// Pure render layer for the Standing Docket dashboard. Receives already-fetched
// data and owns all derivation + markup. The data wrapper lives in page.tsx; a
// dev-only preview route renders this directly with sample data.

export function DashboardView({
  email,
  businessName,
  disputes,
  efwAlerts,
  vampRatio,
  vampConfidence,
  proofByDispute,
  stripeConnection,
  justConnected,
  stripeError,
  guidance,
  needsAttentionCount,
}: DashboardViewProps) {
  const hasStripe = !!stripeConnection;

  const openDisputes = disputes
    .filter((d) => OPEN_STATUSES.has(d.status))
    .sort(byDeadlineThenCreated);
  const nearestWithDeadline = openDisputes.find((d) => d.due_by) ?? null;
  const nearestDays = nearestWithDeadline?.due_by ? daysUntil(nearestWithDeadline.due_by) : null;

  const healthBand = bandFor(vampRatio);
  const healthConfident = vampConfidence === 'medium' || vampConfidence === 'high';
  const meterPct =
    vampRatio === null ? 0 : Math.min((vampRatio / GAUGE_MAX_FRACTION) * 100, 100);

  const exposure = summarizeAmount(openDisputes);
  const recovered = summarizeAmount(disputes.filter((d) => d.outcome === 'won'));
  const actionableEfw = efwAlerts.filter(
    (e) => e.actionable === true && e.merchant_decision === 'pending',
  );
  const hasFiledBefore = recovered.count > 0 || disputes.length > openDisputes.length;

  // The adaptive flip (redesign plan §2). MODE A leads with the health/monitoring
  // story when nothing needs the merchant; MODE B leads with the live docket the
  // moment a case (or EFW) needs a response. The trigger is derived server-side in
  // page.tsx and passed in; the dev preview omits it, so fall back to the same
  // pure derivation here to keep one source of truth.
  const attentionCount = needsAttentionCount ?? deriveNeedsAttentionCount(disputes, efwAlerts);
  const isModeA = attentionCount === 0;

  // Tip budget (plan §3.2): at most two tips on the dashboard. The single
  // highest-priority band tip is pinned above the docket in MODE B; the rest stay
  // in the rail. Both slices are taken from the real guidance engine output — no
  // tips are invented here.
  const cappedBand = guidance.band.slice(0, MAX_DASHBOARD_TIPS);
  const pinnedTip = cappedBand[0] ?? null;
  const railTips = cappedBand.slice(1);

  // Masthead title — a named greeting, never the dead word "Dashboard". The live
  // standing is carried by the sentence below (Section 3), not the title.
  const deskTitle = businessName ?? 'Your dispute desk';

  return (
    <AppShell email={email} businessName={businessName} active="dashboard">
      <div className={`${s.page} ${s.isLit}`}>
        {justConnected && (
          <div className={s.banner} role="status">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            Stripe connected. Verdact saved the connected account ID; no API keys were stored.
          </div>
        )}
        {stripeError && (
          <div className={`${s.banner} ${s.bannerError}`} role="alert">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {STRIPE_ERROR_MESSAGES[stripeError] ?? 'Something went wrong with Stripe. Please try again.'}
          </div>
        )}

        {/* ── Masthead: mono eyebrow + display title + quiet connection chip ── */}
        <header className={`${s.top} ${s.stagger}`}>
          <div className={s.mast}>
            <span className={s.mastKicker} aria-hidden="true">
              Your standing
            </span>
            <h1 className={s.title}>{deskTitle}</h1>
          </div>
          {hasStripe ? (
            <span className={`${s.chip} ${s.chipConnected}`}>
              <span className={s.chipDot} aria-hidden="true" />
              Stripe connected{stripeConnection!.livemode ? '' : ' (test)'}
              {`  ·  ${formatStripeAccountId(stripeConnection!.processor_account_id)}`}
            </span>
          ) : (
            <span className={`${s.chip} ${s.chipGhost}`}>
              <span className={s.chipDot} aria-hidden="true" />
              Stripe not connected
            </span>
          )}
        </header>

        {!hasStripe ? (
          <NotConnected s={s} />
        ) : (
          <>
            {/* ── Dash toolbar: freshness stamp + refresh (both modes) ─ */}
            <DashToolbar s={s} connectedAt={stripeConnection!.connected_at} />

            {isModeA ? (
              <ModeADashboard
                s={s}
                disputes={disputes}
                recovered={recovered}
                healthBand={healthBand}
                healthConfident={healthConfident}
                vampRatio={vampRatio}
                meterPct={meterPct}
                guidance={guidance}
                hasFiledBefore={hasFiledBefore}
              />
            ) : (
              <ModeBDashboard
                s={s}
                openDisputes={openDisputes}
                proofByDispute={proofByDispute}
                exposure={exposure}
                recovered={recovered}
                healthBand={healthBand}
                healthConfident={healthConfident}
                vampRatio={vampRatio}
                meterPct={meterPct}
                nearestDays={nearestDays}
                actionableEfw={actionableEfw}
                hasFiledBefore={hasFiledBefore}
                pinnedTip={pinnedTip}
                railTips={railTips}
                primers={guidance.primers}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Dash toolbar (freshness + refresh) ───────────────────────────────────────
// The constant "we are watching, and it is current" anchor, present in both
// modes. The refresh affordance re-navigates to /dashboard; the page is
// force-dynamic so that re-fetches live data from the same loaders.

function DashToolbar({ s, connectedAt }: { s: CssModuleStyles; connectedAt: string | null }) {
  const fresh = freshnessLabel(connectedAt);
  return (
    <div className={`${s.toolbar} ${s.stagger}`}>
      <span
        className={s.fresh}
        aria-label={fresh ? `Watching your Stripe account, synced ${fresh}` : 'Watching your Stripe account'}
      >
        <span className={s.freshShield} aria-hidden="true">
          <ShieldIcon />
        </span>
        Watching your Stripe account
        {fresh && (
          <>
            {' · synced '}
            <span className={s.num}>{fresh}</span>
          </>
        )}
      </span>
      <a href="/dashboard" className={s.refresh} aria-label="Refresh from Stripe">
        <RefreshIcon className={s.refreshIcon} />
        Refresh
      </a>
    </div>
  );
}

// ── MODE B — active dispute (dispute-led hero) ───────────────────────────────
// Dispute-led standing sentence, the single top tip pinned as a slim band, then
// the docket as the visual hero with a compact clickable health card + guidance
// in the secondary column.

function ModeBDashboard({
  s,
  openDisputes,
  proofByDispute,
  exposure,
  recovered,
  healthBand,
  healthConfident,
  vampRatio,
  meterPct,
  nearestDays,
  actionableEfw,
  hasFiledBefore,
  pinnedTip,
  railTips,
  primers,
}: {
  s: CssModuleStyles;
  openDisputes: Dispute[];
  proofByDispute: Record<string, string[]>;
  exposure: AmountSummary;
  recovered: AmountSummary;
  healthBand: HealthBand;
  healthConfident: boolean;
  vampRatio: number | null;
  meterPct: number;
  nearestDays: number | null;
  actionableEfw: EfwAlert[];
  hasFiledBefore: boolean;
  pinnedTip: GuidanceItem | null;
  railTips: GuidanceItem[];
  primers: GuidanceItem[];
}) {
  const standing = buildStandingSentence({
    healthBand,
    healthConfident,
    openCount: openDisputes.length,
    nearestDays,
    efwCount: actionableEfw.length,
  });

  // The single-open-case panic path: the case is why the founder is here, so it
  // renders FIRST and the pinned tip drops below it (D2). The account-safety
  // line also rides with the standing block only in this one-case state.
  const singleCase = openDisputes.length === 1;

  return (
    <>
      {/* Standing block: bold lead line + muted qualifier (D3 split), then the
          calm account-safety reassurance once (D1), where the founder is most scared. */}
      <div className={`${s.standBlock} ${s.stagger}`}>
        <p className={s.stand}>{standing.lead}</p>
        {standing.sub && <p className={s.standNote}>{standing.sub}</p>}
        {singleCase && (
          <ReassureCard
            className={s.safetyCard}
            icon={<ShieldIcon />}
            title="One dispute will not suspend your Stripe account"
          >
            Take the time to respond well. Verdact never files anything without your say-so.
          </ReassureCard>
        )}
      </div>

      {/* Ledger line — the calm money line (recovered leads, exposure as context). */}
      <div className={s.stagger}>
        <Ledger s={s} exposure={exposure} recovered={recovered} />
      </div>

      {/* Pinned tip band: when a single case dominates it drops BELOW the case
          (rendered inside the grid main); otherwise it sits here above the docket
          so >=1 tip is always seen before a multi-row docket (plan §3.2-A). */}
      {pinnedTip && !singleCase && (
        <div className={s.stagger}>
          <PinnedTipBand s={s} tip={pinnedTip} />
        </div>
      )}

      <div className={`${s.grid} ${s.stagger}`}>
        {/* PRIMARY (hero): the docket */}
        <div className={s.gridMain}>
          <RecordSection
            s={s}
            openDisputes={openDisputes}
            proofByDispute={proofByDispute}
            hasFiledBefore={hasFiledBefore}
          />
          {pinnedTip && singleCase && <PinnedTipBand s={s} tip={pinnedTip} />}
          <PreventLane s={s} alerts={actionableEfw} hasOpen={openDisputes.length > 0} />
        </div>

        {/* SECONDARY (rail): compact clickable health card + guidance */}
        <aside className={s.gridAside}>
          <HealthCard
            s={s}
            band={healthBand}
            confident={healthConfident}
            vampRatio={vampRatio}
            meterPct={meterPct}
          />
          <GuidanceBand s={s} band={railTips} primers={primers} heading="What Verdact is watching" />
        </aside>
      </div>
    </>
  );
}

// ── MODE A — no dispute (health-hero, vermilion-free) ────────────────────────
// Standing sentence rewritten green/neutral; the health meter promoted to a
// hero-size card with a co-hero "What Verdact is watching" panel; the empty
// docket demoted to a calm reassurance card shown LAST.

function ModeADashboard({
  s,
  disputes,
  recovered,
  healthBand,
  healthConfident,
  vampRatio,
  meterPct,
  guidance,
  hasFiledBefore,
}: {
  s: CssModuleStyles;
  disputes: Dispute[];
  recovered: AmountSummary;
  healthBand: HealthBand;
  healthConfident: boolean;
  vampRatio: number | null;
  meterPct: number;
  guidance: GuidanceResult;
  hasFiledBefore: boolean;
}) {
  // Filed-and-waiting cases still exist as a calm strip, but they are not the
  // merchant's action so they never flip the page to MODE B.
  const filedWaiting = disputes.filter((d) => d.status === 'under_review' || d.status === 'submitted');

  return (
    <>
      {/* Standing block: bold lead + muted qualifier, all green/neutral (no vermilion). */}
      <div className={`${s.standBlock} ${s.stagger}`}>
        <p className={s.stand}>No disputes need you right now.</p>
        <p className={s.standNote}>
          Your account is protected and we are watching. We will alert you the moment a dispute is filed.
          {recovered.count > 0 && (
            <>
              {' '}
              <span className={s.standNoteWin}>{recovered.display} recovered so far.</span>{' '}
              <span className={s.standNoteFine}>Past outcomes, not a prediction.</span>
            </>
          )}
        </p>
        {/* The account-safety reassurance, once (D1), where the founder is most scared. */}
        <ReassureCard
          className={s.safetyCard}
          icon={<ShieldIcon />}
          title="One dispute will not suspend your Stripe account"
        >
          Take the time to respond well. Verdact never files anything without your say-so.
        </ReassureCard>
      </div>

      {/* HERO ROW: health meter (dominant) + watching co-hero panel */}
      <div className={`${s.heroGrid} ${s.stagger}`}>
        <HeroHealthCard
          s={s}
          band={healthBand}
          confident={healthConfident}
          vampRatio={vampRatio}
          meterPct={meterPct}
        />
        <WatchingCoHero s={s} band={guidance.band} primers={guidance.primers} />
      </div>

      {/* DEMOTED docket: calm reassurance card, shown LAST */}
      <section className={`${s.docketSection} ${s.stagger}`} aria-labelledby="docket-h">
        <div className={s.barRow}>
          <SectionBar
            className={s.barFlush}
            icon={<ListIcon />}
            title="Your disputes"
            note="What is open, filed, or settled across your account"
          />
          <a href="/dashboard/disputes" className={s.vlink}>
            View all
          </a>
        </div>
        <div className={s.calmEmpty}>
          <span className={s.calmEmptyIcon} aria-hidden="true">
            <ShieldIcon />
          </span>
          <div className={s.calmEmptyCopy}>
            <p className={s.calmEmptyTitle} id="docket-h">
              Nothing is filed without you
            </p>
            <p className={s.calmEmptyText}>
              {hasFiledBefore
                ? 'Nothing is open right now. We are watching your Stripe account and will surface a case here the moment one is filed, with the evidence already gathered.'
                : 'We are watching your Stripe account and will surface a case here the moment one is filed, with the evidence already gathered. Nothing is ever filed without you.'}
            </p>
          </div>
        </div>

        {filedWaiting.length > 0 && (
          <>
            <SectionBar
              className={s.barFiled}
              icon={<ClockIcon />}
              title="Filed, waiting on the issuer"
              note="No action needed from you while the issuer reviews"
            />
            <div className={s.filedList}>
              {filedWaiting.map((d) => (
                <FiledWaitingRow key={d.id} s={s} dispute={d} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function FiledWaitingRow({ s, dispute }: { s: CssModuleStyles; dispute: Dispute }) {
  return (
    <div className={s.filedRow}>
      <div className={s.filedMain}>
        <div className={s.statusLabel}>{dispute.reason ?? 'Dispute'}</div>
        <div className={s.filedBadgeRow}>
          <StatusBadge tone="watch" icon={<ClockIcon />}>
            Filed, waiting
          </StatusBadge>
        </div>
        <div className={s.filedSub}>
          Issuers usually decide within 2 to 6 weeks. We will alert you.
        </div>
      </div>
      <span className={`${s.amt} ${s.num}`}>
        {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
      </span>
    </div>
  );
}

// ── Ledger ───────────────────────────────────────────────────────────────────

type AmountSummary = { display: string; count: number; sub: string };

// The calm money line. Recovered (the reassuring number) carries the display
// weight; exposure is demoted to a context figure framed without the loss
// connotation ("at stake right now · nothing is lost yet"). The duplicate health
// cell is gone — health has its own dedicated card in both modes.
function Ledger({
  s,
  exposure,
  recovered,
}: {
  s: CssModuleStyles;
  exposure: AmountSummary;
  recovered: AmountSummary;
}) {
  const hasRecovered = recovered.count > 0;
  return (
    <div className={s.ledger}>
      {hasRecovered && (
        <div className={`${s.lcell} ${s.lcellLead}`}>
          <div className={s.lEyebrow}>Recovered for you</div>
          <div className={`${s.figLead} ${s.figRecovered} ${s.num}`}>{recovered.display}</div>
          <div className={s.sub}>lifetime · past outcomes, not a prediction</div>
        </div>
      )}
      <div className={s.lcell}>
        <div className={s.lEyebrow}>At stake right now</div>
        <div className={`${s.fig} ${s.num}`}>{exposure.display}</div>
        <div className={s.sub}>
          across {exposure.count} open case{exposure.count === 1 ? '' : 's'} · nothing is lost yet
        </div>
      </div>
    </div>
  );
}

// ── Health cards (the dispute-rate-vs-0.75%-line context, both modes) ─────────
// Shared meter math, two chromes: a compact clickable rail card (MODE B) and a
// hero-size card (MODE A). Status is icon + text + band label, never color alone.

type HealthCardData = {
  pctLabel: string;
  label: string;
  isHealthy: boolean;
  linePct: number;
};

function healthCardData(band: HealthBand, vampRatio: number): HealthCardData {
  return {
    pctLabel: `${(vampRatio * 100).toFixed(2)}%`,
    label: band === 'healthy' ? 'Healthy' : band === 'close' ? 'Getting close' : 'At risk',
    isHealthy: band === 'healthy',
    linePct: Math.min((STRIPE_LINE_FRACTION / GAUGE_MAX_FRACTION) * 100, 100),
  };
}

function HealthMeter({
  s,
  band,
  vampRatio,
  meterPct,
  hero,
}: {
  s: CssModuleStyles;
  band: HealthBand;
  vampRatio: number;
  meterPct: number;
  hero?: boolean;
}) {
  const d = healthCardData(band, vampRatio);
  const fillClass = d.isHealthy ? s.cardMeterFill : `${s.cardMeterFill} ${s.cardMeterFillGap}`;
  const readoutClass = hero ? `${s.cardReadout} ${s.cardReadoutHero}` : s.cardReadout;
  return (
    <div className={s.cardMeterWrap}>
      <div className={`${readoutClass} ${s.num}`}>{d.pctLabel}</div>
      <div
        className={s.cardMeter}
        role="img"
        aria-label={`Dispute rate ${d.pctLabel}, ${d.label.toLowerCase()}, with headroom to Stripe's 0.75% line.`}
      >
        <div className={fillClass} style={{ width: `${meterPct}%` }} />
        {/* The 0.75% threshold, read as a labelled line not decoration. */}
        <div className={s.cardMeterLine} style={{ left: `${d.linePct}%` }}>
          <span className={`${s.cardMeterTick} ${s.num}`} aria-hidden="true">
            0.75%
          </span>
        </div>
      </div>
      <div className={s.cardScale}>
        <span>0%</span>
        <span>Stripe&rsquo;s line</span>
        <span className={s.num}>1.5%</span>
      </div>
    </div>
  );
}

// Calibrating fallback shared by both card variants (honesty gate).
function HealthCardCalibrating({ s, hero }: { s: CssModuleStyles; hero?: boolean }) {
  return (
    <section className={hero ? `${s.healthCardChrome} ${s.healthCardHero}` : s.healthCardChrome}>
      <div className={s.healthCardHeadRow}>
        <span className={s.eyebrow}>Account health</span>
      </div>
      <div className={s.healthCalibrating}>Calibrating</div>
      <p className={s.sub}>Too early to score. Not enough settled volume yet.</p>
    </section>
  );
}

// MODE B: compact, whole-card clickable health card in the rail.
function HealthCard({
  s,
  band,
  confident,
  vampRatio,
  meterPct,
}: {
  s: CssModuleStyles;
  band: HealthBand;
  confident: boolean;
  vampRatio: number | null;
  meterPct: number;
}) {
  if (!confident || band === 'unknown' || vampRatio === null) {
    return <HealthCardCalibrating s={s} />;
  }
  const d = healthCardData(band, vampRatio);
  return (
    <a href="/account-health" className={s.healthCardLink} aria-label="Open account health">
      <section className={s.healthCardChrome}>
        <div className={s.healthCardHeadRow}>
          <div>
            <span className={s.eyebrow}>Account health</span>
            <h2 className={s.healthCardTitle}>Dispute rate vs Stripe&rsquo;s line</h2>
          </div>
          <HealthBadge s={s} band={band} label={d.label} />
        </div>
        <HealthMeter s={s} band={band} vampRatio={vampRatio} meterPct={meterPct} />
        <p className={s.healthCardFoot}>
          {d.isHealthy ? 'Room to Stripe’s guidance line.' : 'Approaching Stripe’s guidance line.'}{' '}
          Each new dispute moves this. <span className={s.guideLink}>See the detail</span>
        </p>
      </section>
    </a>
  );
}

// MODE A: hero-size health card. Same data, dominant readout.
function HeroHealthCard({
  s,
  band,
  confident,
  vampRatio,
  meterPct,
}: {
  s: CssModuleStyles;
  band: HealthBand;
  confident: boolean;
  vampRatio: number | null;
  meterPct: number;
}) {
  if (!confident || band === 'unknown' || vampRatio === null) {
    return <HealthCardCalibrating s={s} hero />;
  }
  const d = healthCardData(band, vampRatio);
  return (
    <div className={s.heroHealthWrap}>
      <a
        href="/account-health"
        className={`${s.healthCardLink} ${s.healthCardLinkHero}`}
        aria-label="Open account health"
      >
        <section className={`${s.healthCardChrome} ${s.healthCardHero}`}>
          <div className={s.healthCardHeadRow}>
            <div>
              <span className={s.eyebrow}>Account health</span>
              <h2 className={s.healthCardTitleHero}>Dispute rate vs Stripe&rsquo;s line</h2>
            </div>
            <HealthBadge s={s} band={band} label={d.label} />
          </div>
          <HealthMeter s={s} band={band} vampRatio={vampRatio} meterPct={meterPct} hero />
          <p className={s.healthCardFoot}>
            {d.isHealthy ? 'You have room to Stripe’s guidance line.' : 'You are approaching Stripe’s guidance line.'}{' '}
            We recalculate this the moment a new dispute or fraud report lands.{' '}
            <span className={s.guideLink}>See the detail</span>
          </p>
        </section>
      </a>
      {/* Gloss the one piece of jargon once per screen, OUTSIDE the card link so
          the GlossaryTerm button is never nested inside an anchor. */}
      <p className={s.healthGloss}>
        Scored against{' '}
        <GlossaryTerm term="dispute_rate" className={s.glossInline}>
          Stripe&rsquo;s 0.75% line
        </GlossaryTerm>
        .
      </p>
    </div>
  );
}

// Status badge: icon + text, never color alone — routed through the shared
// StatusBadge (the single de-alarm enforcement point). Two-color law: green
// "Safe" only when healthy; vermilion "At risk" only once over Stripe's line (a
// real gap); "getting close" is a calm watch state, never green-safe nor vermilion.
function HealthBadge({ s, band, label }: { s: CssModuleStyles; band: HealthBand; label: string }) {
  if (band === 'at-risk') {
    return (
      <StatusBadge tone="gap" icon={<AlertIcon />} className={s.healthChip}>
        At risk · {label}
      </StatusBadge>
    );
  }
  if (band === 'close') {
    return (
      <StatusBadge tone="watch" icon={<InfoCircleIcon />} className={s.healthChip}>
        Watching · {label}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="done" icon={<CheckIcon />} className={s.healthChip}>
      Safe · {label}
    </StatusBadge>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

// ── The record ───────────────────────────────────────────────────────────────

function RecordSection({
  s,
  openDisputes,
  proofByDispute,
  hasFiledBefore,
}: {
  s: CssModuleStyles;
  openDisputes: Dispute[];
  proofByDispute: Record<string, string[]>;
  hasFiledBefore: boolean;
}) {
  // Collapse: exactly one open case → a single calm case-record (panic mode).
  if (openDisputes.length === 1) {
    return <SingleCase s={s} dispute={openDisputes[0]} proof={proofByDispute[openDisputes[0].id] ?? []} />;
  }

  if (openDisputes.length === 0) {
    return (
      <section>
        <SectionBar
          className={s.barFlush}
          icon={<ListIcon />}
          title="The record"
          note="Every open case, listed the moment it lands"
        />
        <div className={s.well}>
          <p className={s.wellTitle}>Watching your Stripe account.</p>
          <p>
            {hasFiledBefore
              ? 'No open disputes right now. New disputes and early fraud warnings appear here the moment they land.'
              : 'New disputes and early fraud warnings will appear here the moment they land.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className={s.barRow}>
        <SectionBar
          className={s.barFlush}
          icon={<ListIcon />}
          title="The record"
          note="Sorted by deadline, then by how ready each case is"
        />
        <a href="/dashboard/disputes" className={s.vlink}>
          View all
        </a>
      </div>
      <div className={s.docketRows}>
        {openDisputes.map((d, i) => (
          <DocketRow
            key={d.id}
            s={s}
            dispute={d}
            proof={proofByDispute[d.id] ?? []}
            primary={i === 0}
          />
        ))}
      </div>
    </section>
  );
}

// The status badge for a docket case: status drives the base meaning, the
// deadline tier escalates it. needs_response on a comfortable runway is a calm
// "Needs you"; near/over deadline earns the vermilion "Needs you now" gap;
// under_review is always the calm filed-waiting watch state, never alarm.
function caseStatus(status: string, tier: DeadlineTier): {
  tone: 'gap' | 'watch' | 'neutral';
  icon: ReactNode;
  label: string;
} {
  if (status === 'needs_response') {
    if (tier === 'urgent') {
      return { tone: 'gap', icon: <AlertIcon />, label: 'Needs you now' };
    }
    return { tone: 'neutral', icon: <InfoCircleIcon />, label: 'Needs you' };
  }
  if (status === 'under_review') {
    return { tone: 'watch', icon: <ClockIcon />, label: 'Filed, waiting' };
  }
  return { tone: 'neutral', icon: <InfoCircleIcon />, label: statusLabel(status) };
}

function DocketRow({
  s,
  dispute,
  proof,
  primary,
}: {
  s: CssModuleStyles;
  dispute: Dispute;
  proof: string[];
  primary: boolean;
}) {
  const days = dispute.due_by ? daysUntil(dispute.due_by) : null;
  const tier = deadlineTier(days);
  const status = caseStatus(dispute.status, tier);
  const actionLabel =
    dispute.status === 'needs_response'
      ? 'Build response'
      : dispute.status === 'under_review'
        ? 'Review'
        : 'View';

  return (
    <div className={primary ? `${s.row} ${s.rowPrimary}` : s.row}>
      <div className={s.rMain}>
        <div className={s.rReason}>{dispute.reason ?? 'Dispute'}</div>
        {/* Primary meta is the founder-relevant fact only: status + amount. The
            charge ID is demoted behind progressive disclosure. */}
        <div className={s.rBadgeRow}>
          <StatusBadge tone={status.tone} icon={status.icon}>
            {status.label}
          </StatusBadge>
        </div>
        <ProofRow s={s} proof={proof} />
        {dispute.processor_charge_id && (
          <details className={s.idDetails}>
            <summary className={s.idSummary}>Details</summary>
            <span className={`${s.idValue} ${s.num}`}>{dispute.processor_charge_id}</span>
          </details>
        )}
      </div>
      <div className={s.rRight}>
        <div className={`${s.amt} ${s.num}`}>
          {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
        </div>
        {days !== null && (
          <div className={`${deadClass(tier)} ${s.num}`}>{deadlineLabel(days)}</div>
        )}
        <a
          href={`/dashboard/disputes/${dispute.id}`}
          className={primary ? `${s.btn} ${s.btnSolid}` : `${s.btn} ${s.btnGhost}`}
        >
          {actionLabel}
        </a>
      </div>
    </div>
  );
}

function SingleCase({
  s,
  dispute,
  proof,
}: {
  s: CssModuleStyles;
  dispute: Dispute;
  proof: string[];
}) {
  const days = dispute.due_by ? daysUntil(dispute.due_by) : null;
  const tier = deadlineTier(days);
  const status = caseStatus(dispute.status, tier);
  return (
    <section className={s.caseHero}>
      <span className={s.caseKicker} aria-hidden="true">
        The case that needs you
      </span>
      <div className={s.caserec}>
        <div className={s.caseBody}>
          <div className={s.caseBadgeRow}>
            <StatusBadge tone={status.tone} icon={status.icon}>
              {status.label}
            </StatusBadge>
          </div>
          <h3 className={s.caseTitle}>{dispute.reason ?? 'Dispute'}</h3>
          <div className={`${s.caseAmt} ${s.num}`}>
            {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
          </div>
          <ProofRow s={s} proof={proof} />
          {dispute.processor_charge_id && (
            <details className={s.idDetails}>
              <summary className={s.idSummary}>Details</summary>
              <span className={`${s.idValue} ${s.num}`}>{dispute.processor_charge_id}</span>
            </details>
          )}
        </div>
        <div className={s.caseRight}>
          {days !== null && (
            <div className={s.caseDeadTile}>
              <span className={s.caseDeadLbl}>Respond by</span>
              <span className={`${deadClass(tier)} ${s.caseDeadVal} ${s.num}`}>{deadlineLabel(days)}</span>
            </div>
          )}
          <a
            href={`/dashboard/disputes/${dispute.id}`}
            className={`${s.btn} ${s.btnSolid} ${s.btnBig} ${s.caseCta}`}
          >
            Build your response
            <ArrowRightIcon className={s.btnIcon} />
          </a>
        </div>
      </div>
    </section>
  );
}

function ProofRow({ s, proof }: { s: CssModuleStyles; proof: string[] }) {
  if (proof.length === 0) {
    return <div className={s.proof}><span className={s.proofNone}>Proof not added yet</span></div>;
  }
  return (
    <div className={s.proof}>
      {proof.map((p) => (
        <span key={p} className={s.proofOk}>
          {p}
        </span>
      ))}
    </div>
  );
}

// ── Prevention lane ──────────────────────────────────────────────────────────

function PreventLane({
  s,
  alerts,
  hasOpen,
}: {
  s: CssModuleStyles;
  alerts: EfwAlert[];
  hasOpen: boolean;
}) {
  if (alerts.length === 0) {
    // Only show the calm "nothing to prevent" line on the otherwise-empty surface.
    if (hasOpen) return null;
    return (
      <div className={s.prevent}>
        <span className={s.preventLabel}>Prevent</span>
        <span className={s.preventText}>
          No early fraud warnings right now. This is where you can stop a dispute before it counts.
        </span>
      </div>
    );
  }

  return (
    <div className={s.prevent}>
      <span className={s.preventLabel}>Prevent</span>
      <span className={s.preventText}>
        {alerts.length} early fraud warning{alerts.length === 1 ? '' : 's'}. Refunding now may stop a
        dispute before it counts.
      </span>
      <a href="/dashboard/disputes" className={`${s.btn} ${s.btnGhost}`}>
        Review
      </a>
    </div>
  );
}

// ── Pinned tip band (plan §3.2-A) ────────────────────────────────────────────
// The single highest-priority guidance tip, rendered as a slim full-width band
// directly under the standing sentence so >=1 tip is always seen before the
// docket. Reuses the same data + dismiss/action grammar as the rail band.

function PinnedTipBand({ s, tip }: { s: CssModuleStyles; tip: GuidanceItem }) {
  const isGap = tip.severity === 'gap';
  return (
    <section className={s.tipBand} aria-label="What Verdact is watching">
      <SectionBar
        className={s.barFlush}
        icon={<RouteIcon />}
        title="What Verdact is watching"
      />
      <div className={isGap ? `${s.tipCard} ${s.tipCardGap}` : s.tipCard}>
        <span className={s.tipIcon} aria-hidden="true">
          {isGap ? <AlertIcon /> : <InfoCircleIcon />}
        </span>
        <div className={s.tipBody}>
          <span className={s.guideStrong}>{tip.text}</span>{' '}
          {tip.actionHref ? (
            <a href={tip.actionHref} className={s.guideLink}>
              {tip.action}
            </a>
          ) : (
            <span className={s.guideLink}>{tip.action}</span>
          )}
        </div>
        {!tip.urgent && (
          <form action={dismissGuidanceAction.bind(null, tip.id)} className={s.guideDismissForm}>
            <button type="submit" className={s.guideDismiss} aria-label={`Dismiss tip: ${tip.text}`}>
              Dismiss
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// ── Watching co-hero (MODE A) ────────────────────────────────────────────────
// Promoted from a rail footnote to a co-hero card next to the big meter, leading
// with monitoring + prevention. Renders the real guidance band; falls back to a
// calm zero-state so the panel is never an empty void.

function WatchingCoHero({
  s,
  band,
  primers,
}: {
  s: CssModuleStyles;
  band: GuidanceItem[];
  primers: GuidanceItem[];
}) {
  return (
    <aside className={s.watchCard} aria-labelledby="watch-h">
      <div className={s.watchHead}>
        <span className={s.watchKicker} aria-hidden="true">
          Always on
        </span>
        <h2 className={s.watchTitle} id="watch-h">
          What Verdact is watching
        </h2>
      </div>
      <GuidanceTips s={s} band={band} primers={primers} />
      {/* Advisory line only (X3): the account-safety + "nothing filed without you"
          reassurance lives once in the standing block + calm-empty anchor. */}
      <p className={s.guideFoot}>Based on your own data. Verdact advises, you decide.</p>
    </aside>
  );
}

// ── Guidance band (Layer 1) + primers (Layer 4) ──────────────────────────────
// The rail band (MODE B). Optional heading turns it into a labelled surface
// (plan §3.2-C). Tips + primers + zero-state come from GuidanceTips.

function GuidanceBand({
  s,
  band,
  primers,
  heading,
}: {
  s: CssModuleStyles;
  band: GuidanceItem[];
  primers: GuidanceItem[];
  heading?: string;
}) {
  return (
    <section className={s.guideSection} aria-label={heading}>
      {heading && (
        <SectionBar
          className={s.barFlush}
          icon={<RouteIcon />}
          title={heading}
          note="Calm, plain-English signals from your own data"
        />
      )}
      <GuidanceTips s={s} band={band} primers={primers} />
      <p className={s.guideFoot}>Based on your own data. Verdact advises, you decide. No guarantees.</p>
    </section>
  );
}

// Shared tip + primer renderer. Renders a calm zero-state when no band tips fired
// so the watching surface is never an empty void (plan §3.2-C / task 5).
function GuidanceTips({
  s,
  band,
  primers,
}: {
  s: CssModuleStyles;
  band: GuidanceItem[];
  primers: GuidanceItem[];
}) {
  return (
    <>
      <div className={s.guide}>
        {band.length === 0 ? (
          // Calm zero-state: a verdict-tinted reassurance tile, never an empty void.
          <div className={s.guideTile}>
            <span className={`${s.guideTileIcon} ${s.guideTileIconOk}`} aria-hidden="true">
              <CheckIcon />
            </span>
            <p className={s.guideItem}>
              <span className={s.guideStrong}>Nothing needs a change right now.</span> We are watching
              your rate against Stripe&rsquo;s 0.75% line and your evidence patterns.
            </p>
          </div>
        ) : (
          band.map((item) => {
            // A genuine gap tip carries the vermilion icon tile; monitoring tips
            // stay verdict. Urgent tips never offer dismiss — they show until the
            // underlying issue resolves.
            const isGap = item.severity === 'gap';
            return (
              <div
                key={item.id}
                className={isGap ? `${s.guideTile} ${s.guideTileGap}` : s.guideTile}
              >
                <span
                  className={
                    isGap
                      ? `${s.guideTileIcon} ${s.guideTileIconGap}`
                      : `${s.guideTileIcon} ${s.guideTileIconOk}`
                  }
                  aria-hidden="true"
                >
                  {isGap ? <AlertIcon /> : <InfoCircleIcon />}
                </span>
                <div className={s.guideItem}>
                  <span className={s.guideStrong}>{item.text}</span>{' '}
                  {item.actionHref ? (
                    <a href={item.actionHref} className={s.guideLink}>
                      {item.action}
                    </a>
                  ) : (
                    <span className={s.guideLink}>{item.action}</span>
                  )}
                  {!item.urgent && (
                    <form
                      action={dismissGuidanceAction.bind(null, item.id)}
                      className={s.guideDismissForm}
                    >
                      <button
                        type="submit"
                        className={s.guideDismiss}
                        aria-label={`Dismiss tip: ${item.text}`}
                      >
                        Dismiss
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {primers.length > 0 && (
        <div className={s.primers}>
          {primers.map((p) => (
            <a key={p.id} href={p.actionHref ?? '#'} className={s.primerLink}>
              {p.text}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// ── Not connected (muted preview, never empty tiles) ─────────────────────────

function NotConnected({ s }: { s: CssModuleStyles }) {
  return (
    <>
      {/* Connect Stripe is the gate, not a peer to-do (D7): the connect panel is
          the dominant action; the checklist below is "what happens next". */}
      <ConnectStripePanel context="dashboard" />

      <section>
        <SectionBar
          className={s.barFlush}
          icon={<ListIcon />}
          title="The record"
          note="A preview of how your cases will look here"
        />

        {/* The sample is watermarked unmistakably (D6): EXAMPLE caption + diagonal
            mark + reduced opacity, so nobody reads the $1,800 as their own. */}
        <p className={s.exampleCaption}>
          Example only. Your real cases appear here the moment you connect Stripe.
        </p>
        <div className={s.exampleFrame}>
          <span className={s.exampleMark} aria-hidden="true">
            EXAMPLE
          </span>
          <div className={`${s.row} ${s.muted}`}>
            <span className="sr-only">Example data, not a real case.</span>
            <div className={s.rMain}>
              <div className={s.rReason}>Services not rendered</div>
              <div className={s.rBadgeRow}>
                <StatusBadge tone="neutral" icon={<InfoCircleIcon />}>
                  Needs you
                </StatusBadge>
              </div>
              <div className={s.proof}>
                <span className={s.proofOk}>Delivery</span>
                <span className={s.proofOk}>Scope</span>
              </div>
            </div>
            <div className={s.rRight}>
              <div className={`${s.amt} ${s.num}`}>$1,800</div>
              <div className={`${s.dead} ${s.num}`}>Due in 8 days</div>
              <span className={`${s.btn} ${s.btnGhost}`}>Build response</span>
            </div>
          </div>
        </div>

        <div className={s.checklist}>
          <p className={s.checklistLead}>What happens next</p>
          <div className={s.ci}>
            <span className={s.ciBox} aria-hidden="true" />
            We find your disputes and account health from Stripe
          </div>
          <div className={s.ci}>
            <span className={s.ciBox} aria-hidden="true" />
            Add your business profile before your first response
          </div>
          <div className={s.ci}>
            <span className={s.ciBox} aria-hidden="true" />
            Add policies when ready
          </div>
        </div>
      </section>
    </>
  );
}

// ── Derivation helpers ───────────────────────────────────────────────────────

// A two-part standing block (D3): a bold dispute/health LEAD line and a muted
// SUB qualifier. The strings are unchanged from the single-sentence version —
// this only splits them on the existing sentence boundary so the lead reads bold
// and the qualifier reads muted, with this function staying the single source.
type StandingSentence = { lead: string; sub: string };

function buildStandingSentence({
  healthBand,
  healthConfident,
  openCount,
  nearestDays,
  efwCount = 0,
}: {
  healthBand: HealthBand;
  healthConfident: boolean;
  openCount: number;
  nearestDays: number | null;
  efwCount?: number;
}): StandingSentence {
  const healthClause =
    !healthConfident || healthBand === 'unknown'
      ? 'Your account health is still calibrating'
      : healthBand === 'healthy'
        ? 'Your account is healthy, with room to the line'
        : healthBand === 'close'
          ? "Your account is approaching Stripe's 0.75% line"
          : "Your account is over Stripe's 0.75% line";

  // MODE B reached purely through an early fraud warning (no open dispute yet):
  // lead with the time-sensitive warning, not a "nothing needs you" line.
  if (openCount === 0 && efwCount > 0) {
    const warn =
      efwCount === 1
        ? 'One early fraud warning needs a decision'
        : `${efwCount} early fraud warnings need a decision`;
    return { lead: `${warn}.`, sub: `${healthClause}.` };
  }

  if (openCount === 0) {
    return {
      lead: "You're set up. Nothing needs you right now.",
      sub: "Here's what Verdact is watching.",
    };
  }

  if (openCount === 1) {
    const when =
      nearestDays === null
        ? 'One case needs you'
        : nearestDays < 0
          ? 'One case is past due and needs you now'
          : nearestDays === 0
            ? 'One case needs you today'
            : nearestDays === 1
              ? 'One case needs you by tomorrow'
              : `One case needs you in ${nearestDays} days`;
    return { lead: `${when}.`, sub: `${healthClause}.` };
  }

  const nearest =
    nearestDays === null
      ? `${openCount} cases are open`
      : nearestDays < 0
        ? `${openCount} cases are open; the nearest is past due`
        : nearestDays === 0
          ? `${openCount} cases are open; the nearest is due today`
          : nearestDays === 1
            ? `${openCount} cases are open; the nearest is due tomorrow`
            : `${openCount} cases are open; the nearest is due in ${nearestDays} days`;
  return { lead: `${nearest}.`, sub: `${healthClause}.` };
}

function summarizeAmount(disputes: Dispute[]): AmountSummary {
  const count = disputes.length;
  const caseWord = `${count} case${count === 1 ? '' : 's'}`;
  if (count === 0) {
    return { display: '$0', count, sub: 'none' };
  }
  const currencies = new Set(disputes.map((d) => (d.currency ?? 'usd').toLowerCase()));
  if (currencies.size > 1) {
    // Mixed currencies can't be summed honestly — show the count instead.
    return { display: caseWord, count, sub: 'mixed currencies' };
  }
  const total = disputes.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  return {
    display: formatAmount(total, disputes[0].currency),
    count,
    sub: caseWord,
  };
}

// ── Utility functions ────────────────────────────────────────────────────────

function deadlineLabel(days: number): string {
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function formatAmount(cents: number, currency: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'USD').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatStripeAccountId(accountId: string): string {
  if (accountId.length <= 12) return accountId;
  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    needs_response: 'Needs response',
    under_review: 'Under review',
    submitted: 'Submitted',
    won: 'Won',
    lost: 'Lost',
    warning_closed: 'Closed',
  };
  return map[status] ?? status;
}
