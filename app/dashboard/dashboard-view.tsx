import { AppShell } from '../_components/app-chrome';
import { ConnectStripePanel } from '../_components/connect-stripe-panel';
import { type Dispute, type EfwAlert } from '@/lib/dal';
import { URGENT_DAYS, type GuidanceItem, type GuidanceResult, type HealthBand } from '@/lib/guidance';
import { AlertIcon, CheckIcon, InfoCircleIcon, ShieldIcon } from './dash-icons';
import { dismissGuidanceAction } from './actions';
import {
  OPEN_STATUSES,
  STRIPE_LINE_FRACTION,
  GAUGE_MAX_FRACTION,
  bandFor,
  daysUntil,
  byDeadlineThenCreated,
  freshnessLabel,
  deriveNeedsAttentionCount,
} from './signals';
import s from './dashboard.module.css';

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

  return (
    <AppShell email={email} businessName={businessName} active="dashboard">
      <div className={s.page}>
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

        {/* ── Masthead: h1 + connection chip ──────────────────────────── */}
        <header className={s.top}>
          <h1 className={s.title}>Dashboard</h1>
          {hasStripe ? (
            <span className={`${s.chip} ${s.chipConnected}`}>
              <span className={s.chipDot} aria-hidden="true" />
              Stripe connected{stripeConnection!.livemode ? '' : ' (test)'}
              {`  ·  ${formatStripeAccountId(stripeConnection!.processor_account_id)}`}
            </span>
          ) : (
            <a href="/api/stripe/connect/start" className={`${s.chip} ${s.chipGhost}`}>
              <span className={s.chipDot} aria-hidden="true" />
              Connect Stripe
            </a>
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
    <div className={s.toolbar}>
      {fresh ? (
        <span className={s.fresh} aria-label={`Synced from Stripe ${fresh}`}>
          <span className={s.freshDot} aria-hidden="true" />
          Synced from Stripe <span className={s.num}>{fresh}</span>
        </span>
      ) : (
        <span className={s.fresh}>
          <span className={s.freshDot} aria-hidden="true" />
          Watching your Stripe account
        </span>
      )}
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

  return (
    <>
      {/* Standing sentence (dispute leads, safety follows) */}
      <p className={s.stand}>{standing}</p>

      {/* Ledger line — persistent dispute-rate-vs-line context */}
      <Ledger
        s={s}
        collapsed={openDisputes.length === 1}
        exposure={exposure}
        recovered={recovered}
        healthBand={healthBand}
        healthConfident={healthConfident}
        vampRatio={vampRatio}
        meterPct={meterPct}
      />

      {/* Pinned tip band: the single highest-priority guidance tip, directly
          under the standing sentence so >=1 tip is always seen before the
          docket (plan §3.2-A). The rest of the budget stays in the rail. */}
      {pinnedTip && <PinnedTipBand s={s} tip={pinnedTip} />}

      <div className={s.grid}>
        {/* PRIMARY (hero): the docket */}
        <div className={s.gridMain}>
          <RecordSection
            s={s}
            openDisputes={openDisputes}
            proofByDispute={proofByDispute}
            hasFiledBefore={hasFiledBefore}
          />
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
      {/* Standing sentence: protected + watching, all green/neutral (no vermilion) */}
      <p className={s.stand}>
        No disputes need you right now. Your account is protected and we are watching.
      </p>
      <p className={s.standNote}>
        We will alert you the moment a dispute is filed.
        {recovered.count > 0 && (
          <>
            {' '}
            <span className={s.standNoteWin}>{recovered.display} recovered so far.</span>{' '}
            <span className={s.standNoteFine}>Past outcomes, not a prediction.</span>
          </>
        )}
      </p>

      {/* HERO ROW: health meter (dominant) + watching co-hero panel */}
      <div className={s.heroGrid}>
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
      <section className={s.docketSection} aria-labelledby="docket-h">
        <div className={s.sec}>
          <h2 className={s.eyebrow} id="docket-h">
            Your disputes
          </h2>
          <a href="/dashboard/disputes" className={s.vlink}>
            View all
          </a>
        </div>
        <div className={s.calmEmpty}>
          <span className={s.calmEmptyIcon} aria-hidden="true">
            <ShieldIcon />
          </span>
          <div className={s.calmEmptyCopy}>
            <p className={s.calmEmptyTitle}>Nothing is filed without you</p>
            <p className={s.calmEmptyText}>
              {hasFiledBefore
                ? 'Nothing is open right now. We are watching your Stripe account and will surface a case here the moment one is filed, with the evidence already gathered.'
                : 'We are watching your Stripe account and will surface a case here the moment one is filed, with the evidence already gathered. Nothing is ever filed without you.'}
            </p>
          </div>
        </div>

        {filedWaiting.length > 0 && (
          <>
            <div className={s.sec} style={{ marginTop: 'var(--space-6)' }}>
              <h2 className={s.eyebrow}>Filed, waiting on the issuer</h2>
            </div>
            {filedWaiting.map((d) => (
              <FiledWaitingRow key={d.id} s={s} dispute={d} />
            ))}
          </>
        )}
      </section>
    </>
  );
}

function FiledWaitingRow({ s, dispute }: { s: CssModuleStyles; dispute: Dispute }) {
  return (
    <div className={s.filedRow}>
      <div>
        <div className={s.statusLabel}>
          <span className={s.statusDotNeutral} aria-hidden="true" />
          {dispute.reason ?? 'Dispute'}
        </div>
        <div className={s.filedSub}>
          {statusLabel(dispute.status)}. Issuers usually decide within 2 to 6 weeks. We will alert you.
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

function Ledger({
  s,
  collapsed,
  exposure,
  recovered,
  healthBand,
  healthConfident,
  vampRatio,
  meterPct,
}: {
  s: CssModuleStyles;
  collapsed: boolean;
  exposure: AmountSummary;
  recovered: AmountSummary;
  healthBand: HealthBand;
  healthConfident: boolean;
  vampRatio: number | null;
  meterPct: number;
}) {
  return (
    <div className={`${s.ledger} ${collapsed ? s.ledgerCollapsed : ''}`}>
      <div className={s.lcell}>
        <div className={s.lEyebrow}>Open exposure</div>
        <div className={`${s.fig} ${s.num}`}>{exposure.display}</div>
        <div className={s.sub}>watching · {exposure.sub}</div>
      </div>
      {!collapsed && (
        <div className={s.lcell}>
          <div className={s.lEyebrow}>Recovered to date</div>
          <div className={`${s.fig} ${s.figRecovered} ${s.num}`}>{recovered.display}</div>
          <div className={s.sub}>lifetime · {recovered.sub}</div>
        </div>
      )}
      <div className={s.lcell}>
        <LedgerHealthCell
          s={s}
          band={healthBand}
          confident={healthConfident}
          vampRatio={vampRatio}
          meterPct={meterPct}
        />
      </div>
    </div>
  );
}

function LedgerHealthCell({
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
  // Honesty gate: no number/band until the snapshot is a confident read.
  if (!confident || band === 'unknown' || vampRatio === null) {
    return (
      <div className={s.health}>
        <div className={s.lEyebrow}>Account health</div>
        <div className={s.healthCalibrating}>Calibrating</div>
        <div className={s.sub}>Too early to score. Not enough settled volume yet.</div>
      </div>
    );
  }

  const pctLabel = `${(vampRatio * 100).toFixed(2)}%`;
  const label = band === 'healthy' ? 'Healthy' : band === 'close' ? 'Getting close' : 'At risk';
  const linePct = Math.min((STRIPE_LINE_FRACTION / GAUGE_MAX_FRACTION) * 100, 100);
  const fillClass =
    band === 'healthy' ? s.meterFill : `${s.meterFill} ${s.meterFillGap}`;
  const hrowClass = band === 'healthy' ? s.hrow : `${s.hrow} ${s.hrowGap}`;

  return (
    <div className={s.health}>
      <div className={s.lEyebrow}>Account health</div>
      <div
        className={s.meter}
        role="img"
        aria-label={`Account health: ${label}. Dispute rate ${pctLabel} vs Stripe's 0.75% line.`}
      >
        <div className={fillClass} style={{ width: `${meterPct}%` }} />
        <div className={s.meterLine} style={{ left: `${linePct}%` }} />
      </div>
      <div className={hrowClass}>
        <span className={band === 'healthy' ? s.tick : s.tickGap} aria-hidden="true" />
        {label} · <span className={s.num}>{pctLabel}</span>
      </div>
      <div className={s.sub}>room to Stripe&rsquo;s 0.75% line</div>
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
        <div className={s.cardMeterLine} style={{ left: `${d.linePct}%` }} />
      </div>
      <div className={s.cardScale}>
        <span>0%</span>
        <span>Stripe&rsquo;s 0.75% line</span>
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
  );
}

// Status badge: icon + text, never color alone. Two-color law: green "Safe" only
// when healthy; vermilion "At risk" only once over Stripe's line (a real gap);
// "getting close" is a neutral monitoring state, not green-safe and not vermilion.
function HealthBadge({ s, band, label }: { s: CssModuleStyles; band: HealthBand; label: string }) {
  if (band === 'at-risk') {
    return (
      <span className={`${s.healthBadge} ${s.healthBadgeGap}`}>
        <AlertIcon className={s.healthBadgeIcon} />
        At risk <span className={s.healthBadgeFine}>· {label}</span>
      </span>
    );
  }
  if (band === 'close') {
    return (
      <span className={`${s.healthBadge} ${s.healthBadgeNeutral}`}>
        <InfoCircleIcon className={s.healthBadgeIcon} />
        Watching <span className={s.healthBadgeFine}>· {label}</span>
      </span>
    );
  }
  return (
    <span className={s.healthBadge}>
      <CheckIcon className={s.healthBadgeIcon} />
      Safe <span className={s.healthBadgeFine}>· {label}</span>
    </span>
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
        <div className={s.sec}>
          <span className={s.eyebrow}>The record</span>
        </div>
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
      <div className={s.sec}>
        <span className={s.eyebrow}>The record</span>
        <span className={s.secRight}>
          <span className={s.sort}>Deadline × readiness</span>
          <a href="/dashboard/disputes" className={s.vlink}>
            View all
          </a>
        </span>
      </div>
      {openDisputes.map((d, i) => (
        <DocketRow
          key={d.id}
          s={s}
          dispute={d}
          proof={proofByDispute[d.id] ?? []}
          primary={i === 0}
        />
      ))}
    </section>
  );
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
  const urgent = days !== null && days <= URGENT_DAYS;
  const actionLabel =
    dispute.status === 'needs_response'
      ? 'Build response'
      : dispute.status === 'under_review'
        ? 'Review'
        : 'View';

  return (
    <div className={s.row}>
      <div>
        <div className={s.rReason}>
          <span className={s.sdot} aria-hidden="true" />
          {dispute.reason ?? 'Dispute'}
        </div>
        <div className={`${s.rMeta} ${s.num}`}>
          {dispute.processor_charge_id ? truncateChargeId(dispute.processor_charge_id) : 'No charge ID'} ·{' '}
          {statusLabel(dispute.status)}
        </div>
        <ProofRow s={s} proof={proof} />
      </div>
      <div className={s.rRight}>
        <div className={`${s.amt} ${s.num}`}>
          {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
        </div>
        {days !== null && (
          <div className={`${s.dead} ${urgent ? s.deadUrgent : ''} ${s.num}`}>{deadlineLabel(days)}</div>
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
  const urgent = days !== null && days <= URGENT_DAYS;
  return (
    <section>
      <div className={s.sec}>
        <span className={s.eyebrow}>The case that needs you</span>
      </div>
      <div className={s.caserec}>
        <div>
          <div className={s.caseLabel}>Action needed</div>
          <h3 className={s.caseTitle}>{dispute.reason ?? 'Dispute'}</h3>
          <div className={`${s.caseMeta} ${s.num}`}>
            {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
            {dispute.processor_charge_id ? ` · ${truncateChargeId(dispute.processor_charge_id)}` : ''}
          </div>
          <ProofRow s={s} proof={proof} />
        </div>
        <div className={s.caseRight}>
          {days !== null && (
            <div className={`${s.dead} ${urgent ? s.deadUrgent : ''} ${s.num}`}>{deadlineLabel(days)}</div>
          )}
          <a href={`/dashboard/disputes/${dispute.id}`} className={`${s.btn} ${s.btnSolid} ${s.btnBig}`}>
            Build your response
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
        {alerts.length} early fraud warning{alerts.length === 1 ? '' : 's'}
        {alerts[0].processor_charge_id ? ` · ${truncateChargeId(alerts[0].processor_charge_id)}` : ''}.
        Refunding now may stop a dispute before it counts.
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
  return (
    <section className={s.tipBand} aria-labelledby="tip-band-h">
      <div className={s.tipBandHead}>
        <span className={s.eyebrow} id="tip-band-h">
          What Verdact is watching
        </span>
      </div>
      <div className={tip.severity === 'gap' ? `${s.tipCard} ${s.tipCardGap}` : s.tipCard}>
        <span className={s.tipIcon} aria-hidden="true">
          {tip.severity === 'gap' ? <AlertIcon /> : <InfoCircleIcon />}
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
        <span className={s.eyebrow}>Always on</span>
        <h2 className={s.watchTitle} id="watch-h">
          What Verdact is watching
        </h2>
      </div>
      <GuidanceTips s={s} band={band} primers={primers} />
      <p className={s.guideFoot}>
        Based on your own data. Verdact advises, you decide. Nothing is filed without you.
      </p>
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
    <section className={s.guideSection} aria-labelledby={heading ? 'guide-h' : undefined}>
      {heading && (
        <div className={s.guideHead}>
          <span className={s.eyebrow} id="guide-h">
            {heading}
          </span>
        </div>
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
          <p className={s.guideItem}>
            <span className={s.guideStrong}>Nothing needs a change right now.</span> We are watching
            your rate against Stripe&rsquo;s 0.75% line and your evidence patterns.
          </p>
        ) : (
          band.map((item) => (
            // A div (not a p) so the dismiss <form> is valid flow content. Urgent
            // tips (deadline / account-risk) never offer dismiss — they show until
            // the underlying issue resolves.
            <div key={item.id} className={s.guideItem}>
              <span className={s.guideStrong}>{item.text}</span>{' '}
              {item.actionHref ? (
                <a href={item.actionHref} className={s.guideLink}>
                  {item.action}
                </a>
              ) : (
                <span className={s.guideLink}>{item.action}</span>
              )}
              {!item.urgent && (
                <form action={dismissGuidanceAction.bind(null, item.id)} className={s.guideDismissForm}>
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
          ))
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
      <ConnectStripePanel context="dashboard" />
      <p className={`${s.stand} ${s.standMuted}`}>
        Once you connect, your standing and open cases appear here.
      </p>
      <section>
        <div className={s.sec}>
          <span className={s.eyebrow}>
            The record <span className={s.sampleTag}>Sample</span>
          </span>
        </div>
        <div className={`${s.row} ${s.muted}`}>
          <div>
            <div className={s.rReason}>
              <span className={s.sdot} aria-hidden="true" />
              Services not rendered
            </div>
            <div className={`${s.rMeta} ${s.num}`}>ch_0000…0000 · Needs response</div>
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
        <div className={s.checklist}>
          <div className={`${s.ci} ${s.ciFirst}`}>
            <span className={s.ciBox} aria-hidden="true" />
            Connect Stripe to find your disputes and account health
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
}): string {
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
    return `${warn}. ${healthClause}.`;
  }

  if (openCount === 0) {
    return "You're set up. Nothing needs you right now. Here's what Verdact is watching.";
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
    return `${when}. ${healthClause}.`;
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
  return `${healthClause}. ${nearest}.`;
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

function truncateChargeId(chargeId: string): string {
  if (chargeId.length <= 16) return chargeId;
  return `${chargeId.slice(0, 8)}…${chargeId.slice(-4)}`;
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
