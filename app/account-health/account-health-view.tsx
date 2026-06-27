import type { ReactNode } from 'react';
import { AppShell } from '../_components/app-chrome';
import { type Dispute, type EfwAlert, type VampSnapshot } from '@/lib/dal';
import { HEALTHY_LINE, STRIPE_LINE, GAUGE_MAX } from '@/lib/account-health/lines';
import { MeasuredPopup } from './_components/measured-popup';
import { ExportButton } from './_components/export-button';
import { RefreshButton } from './_components/refresh-button';
import { SectionBar } from '../_components/ui/section-bar';
import { StatusBadge, type StatusTone } from '../_components/ui/status-badge';
import { GlossaryTerm } from '../_components/ui/glossary-term';
import {
  ListIcon,
  EyeIcon,
  RouteIcon,
  ShieldIcon,
  CheckIcon,
  AlertIcon,
  ClockIcon,
  InfoCircleIcon,
  PlugIcon,
  ArrowRightIcon,
} from '../dashboard/dash-icons';
import s from './account-health.module.css';

// ── Constants (mirror the server writer; STRIPE_LINE/GAUGE_MAX are percents) ──
const LINE_FRACTION = STRIPE_LINE / 100; // 0.0075 — the line we score against
const GAUGE_MAX_FRACTION = GAUGE_MAX / 100; // 0.015 — far edge of the gauge
const HEALTHY_BELOW = HEALTHY_LINE / 100; // 0.0065 — shared healthy/close cutoff

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

type Band = 'healthy' | 'close' | 'at-risk';
// The not-scored split (AH3): are we still reading, or just too small to score?
type NotScoredKind = 'gathering' | 'low-volume';

export type AccountHealthViewProps = {
  email: string | null | undefined;
  businessName: string | null;
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  snapshot: VampSnapshot | null;
  stripeConnected: boolean;
};

export function AccountHealthView({
  email,
  businessName,
  disputes,
  efwAlerts,
  snapshot,
  stripeConnected,
}: AccountHealthViewProps) {
  const ratio = snapshot?.estimated_vamp_ratio ?? null;
  const confidence = snapshot?.confidence_level ?? null;

  // Data-honesty gate: a number only on a real, confident read.
  const scored = ratio !== null && confidence !== null && confidence !== 'low';
  const band: Band | null = scored ? bandFor(ratio as number) : null;
  const notScoredKind: NotScoredKind = confidence === 'low' ? 'low-volume' : 'gathering';

  return (
    <AppShell email={email} businessName={businessName} active="account-health">
      <div className={s.page}>
        {/* ── Zone A: header (kicker + state headline + signal tile) ─ */}
        <header className={s.headerRow}>
          <div className={s.headerText}>
            <p className={s.kicker}>Account health</p>
            <h1 className={s.pageTitle}>
              {headlineFor(stripeConnected, scored, band, notScoredKind)}
            </h1>
            <div className={s.freshnessRow}>
              <p className={s.freshness}>{freshnessLine(snapshot, stripeConnected)}</p>
              {stripeConnected ? <RefreshButton /> : null}
            </div>
          </div>
          <StatusSignal
            stripeConnected={stripeConnected}
            scored={scored}
            band={band}
            notScoredKind={notScoredKind}
          />
        </header>

        {/* ── Zone B: standing read ────────────────────────────────── */}
        {!stripeConnected ? (
          <NotConnectedCard />
        ) : !scored ? (
          <section className={`${s.panel} ${s.panelStanding}`} aria-label="Your dispute rate">
            <SectionBar
              icon={<ClockIcon />}
              title={notScoredKind === 'low-volume' ? 'Not enough volume yet' : 'Calibrating'}
              note="What we can stand behind so far"
              className={s.sectionBarFirst}
            />
            <NotScored kind={notScoredKind} />
            <LiveCounts disputes={disputes} efwAlerts={efwAlerts} />
            <div className={s.footerRow}>
              <MeasuredPopup />
            </div>
          </section>
        ) : (
          <section className={`${s.panel} ${s.panelStanding}`} aria-label="Your dispute rate">
            <SectionBar
              icon={<ListIcon />}
              title="Your dispute rate"
              note="Counted against Stripe's 0.75% line"
              className={s.sectionBarFirst}
            />

            <div className={s.standingTop}>
              <p className={s.readNumber}>{formatPct(ratio as number)}</p>
              <span className={s.readBadge}>
                <StatusBadge tone={bandTone(band)} icon={<BandIcon band={band as Band} />}>
                  {bandLabel(band)}
                </StatusBadge>
              </span>
            </div>

            <Headroom ratio={ratio as number} band={band as Band} snapshot={snapshot} />

            <div className={s.gauge} role="img" aria-label={gaugeAria(ratio as number, band)}>
              <div className={s.gaugeTrack}>
                <span
                  className={s.gaugeDanger}
                  style={{ left: `${markerPct(LINE_FRACTION)}%` }}
                  aria-hidden="true"
                />
                <div
                  className={`${s.gaugeFill} ${gaugeFillClass(band)}`}
                  style={{ width: `${gaugePct(ratio as number)}%` }}
                />
                {band !== 'at-risk' ? (
                  <span
                    className={s.gaugeGhost}
                    style={{ left: `${markerPct(nextDisputeFraction(snapshot, ratio as number))}%` }}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`${s.gaugeMarker} ${band === 'at-risk' ? s.gaugeMarkerAtRisk : ''}`}
                  style={{ left: `${markerPct(LINE_FRACTION)}%` }}
                  aria-hidden="true"
                >
                  <span className={s.gaugeMarkerCap}>0.75%</span>
                </span>
              </div>
              <div className={s.gaugeScale}>
                <span>0%</span>
                <span>{GAUGE_MAX}%</span>
              </div>
            </div>

            <Counts snapshot={snapshot} />

            <div className={s.footerRow}>
              <MeasuredPopup />
              <div className={s.exportGroup}>
                <span className={s.betaTag}>Beta</span>
                <ExportButton />
              </div>
            </div>
          </section>
        )}

        {/* ── Zone C: trend (demoted until data exists) ────────────── */}
        <section className={`${s.panel} ${s.panelQuiet}`} aria-labelledby="trend-label">
          <SectionBar
            icon={<RouteIcon />}
            title="Trend"
            note="Your rate over time, as readings build"
            className={s.sectionBarFirst}
          />
          <div className={s.trendBody}>
            <GhostSparkline />
            <p className={s.trendEmpty} id="trend-label">
              {trendLine(stripeConnected, scored)}
            </p>
          </div>
        </section>

        {/* ── Zone D: drivers (live data, renders pre-writer) ──────── */}
        <section className={s.panel} aria-label="What is affecting your account health">
          <SectionBar
            icon={<ListIcon />}
            title="What is affecting your rate"
            note="Disputes and warnings moving your number"
            className={s.sectionBarFirst}
          />
          <Drivers disputes={disputes} efwAlerts={efwAlerts} stripeConnected={stripeConnected} />
        </section>

        {/* ── Zone E: monitoring reassurance ───────────────────────── */}
        <section className={`${s.panel} ${s.panelWatch}`} aria-labelledby="watching-label">
          <div className={s.watchHead}>
            <div className={s.watchTitle}>
              <p className={s.eyebrow}>
                <EyeIcon className={s.eyebrowIcon} />
                Always on
              </p>
              <p className={s.watchHeadline} id="watching-label">
                What Verdact is watching, so you do not have to
              </p>
            </div>
            {MONITOR_ITEMS.length > 0 ? (
              <span className={s.watchCount}>
                <span className={s.watchCountNum}>{MONITOR_ITEMS.length}</span> things we are watching
              </span>
            ) : null}
          </div>

          {MONITOR_ITEMS.length > 0 ? (
            <ul className={s.monitorList}>
              {MONITOR_ITEMS.map((item) => (
                <li key={item.id} className={s.monitorItem}>
                  <span className={s.monitorIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={s.monitorText}>
                    <span className={s.monitorWhat}>{item.title}</span>
                    <span className={s.monitorWhy}>{item.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={s.watchEmpty}>
              <CheckIcon className={s.watchEmptyIcon} />
              <p>
                Nothing needs a change right now. We are watching your rate and your
                evidence patterns, and will surface anything worth a small fix here.
              </p>
            </div>
          )}

          <p className={s.youDecide}>
            <ShieldIcon className={s.youDecideIcon} />
            <span>
              Reference lines from Stripe and the card networks, not a verdict on your
              account. <b>Verdact advises, you decide.</b>
            </span>
          </p>
        </section>
      </div>
    </AppShell>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface MonitorItem {
  id: string;
  title: ReactNode;
  why: string;
  icon: ReactNode;
}

// What Verdact watches, restructured into "what" + "why it helps you" pairs so
// each line reads as a reassurance, not a dense rule. Jargon goes behind a
// GlossaryTerm (the stronger-evidence rule -> Visa CE 3.0).
const MONITOR_ITEMS: MonitorItem[] = [
  {
    id: 'rate',
    title: 'Your dispute rate',
    why: "Recomputed every day against Stripe's 0.75% line, so you always know where you stand.",
    icon: <ListIcon />,
  },
  {
    id: 'efw',
    title: 'Early fraud warnings',
    why: 'Where a refund now can stop a dispute from opening and counting against you.',
    icon: <AlertIcon />,
  },
  {
    id: 'ce3',
    title: (
      <>
        Disputes that may qualify for the{' '}
        <GlossaryTerm term="ce3">stronger-evidence rule</GlossaryTerm>
      </>
    ),
    why: 'Some disputes can be excluded from your rate, which buys back headroom.',
    icon: <ShieldIcon />,
  },
  {
    id: 'deadlines',
    title: 'Deadlines on open disputes',
    why: 'So the strongest cases get fought in time, flagged automatically.',
    icon: <ClockIcon />,
  },
];

function StatusSignal({
  stripeConnected,
  scored,
  band,
  notScoredKind,
}: {
  stripeConnected: boolean;
  scored: boolean;
  band: Band | null;
  notScoredKind: NotScoredKind;
}) {
  let tone: StatusTone;
  let icon: ReactNode;
  let label: string;
  let lead: string;

  if (!stripeConnected) {
    tone = 'neutral';
    icon = <PlugIcon />;
    label = 'Not connected';
    lead = 'Status';
  } else if (!scored || !band) {
    tone = 'watch';
    icon = notScoredKind === 'low-volume' ? <InfoCircleIcon /> : <ClockIcon />;
    label = notScoredKind === 'low-volume' ? 'Not enough volume yet' : 'Calibrating';
    lead = 'Status';
  } else {
    tone = bandTone(band);
    icon = <BandIcon band={band} />;
    label = bandLabel(band);
    lead = 'Where you stand';
  }

  return (
    <div className={`${s.signalTile} ${signalToneClass(tone)}`}>
      <p className={s.signalLead}>{lead}</p>
      <StatusBadge tone={tone} icon={icon} className={s.signalBadge}>
        {label}
      </StatusBadge>
    </div>
  );
}

// Status is carried by icon + text, never color alone (brand law). Healthy uses
// the verdict check; getting-close and over-the-line use the alert glyph.
function BandIcon({ band, className }: { band: Band; className?: string }) {
  if (band === 'healthy') return <CheckIcon className={className} />;
  return <AlertIcon className={className} />;
}

function NotConnectedCard() {
  return (
    <section className={s.nextAction} aria-labelledby="connect-head">
      <span className={s.naSeal} aria-hidden="true">
        <PlugIcon className={s.naSealIcon} />
      </span>
      <div className={s.naText}>
        <p className={s.naEyebrow}>One step to see your health</p>
        <h2 className={s.naHead} id="connect-head">
          Connect Stripe to measure where you stand.
        </h2>
        <p className={s.naSub}>
          Verdact reads your settled charges, disputes, and early fraud warnings to
          show how close you are to Stripe&apos;s line. No card numbers are stored, and
          no keys are kept.
        </p>
      </div>
      <a href="/api/stripe/connect/start" className={s.naCta}>
        Connect Stripe
        <ArrowRightIcon className={s.naCtaIcon} />
      </a>
    </section>
  );
}

function NotScored({ kind }: { kind: NotScoredKind }) {
  if (kind === 'low-volume') {
    return (
      <div className={s.notScored}>
        <p className={s.notScoredTitle}>Not enough settled volume to score yet.</p>
        <p className={s.notScoredText}>
          We will not show a rate we cannot stand behind. As your charge volume grows,
          this fills in on its own.
        </p>
      </div>
    );
  }
  return (
    <div className={s.notScored}>
      <p className={s.notScoredTitle}>We are still taking your first full reading.</p>
      <p className={s.notScoredText}>
        This fills in on its own within a day or so. Nothing for you to do.
      </p>
    </div>
  );
}

// Two-line headroom: a bold plain-English status + a muted concrete sub-line that
// names the real stakes (AH1/AH4). Copy only; every number reuses figures already
// computed from the snapshot.
function Headroom({
  ratio,
  band,
  snapshot,
}: {
  ratio: number;
  band: Band;
  snapshot: VampSnapshot | null;
}) {
  const disputesToLine = disputesUntilLine(snapshot, ratio);
  const rateTerm = <GlossaryTerm term="dispute_rate">dispute rate</GlossaryTerm>;

  if (band === 'at-risk') {
    return (
      <div className={s.headroom}>
        <p className={s.headroomLead}>You are over Stripe&apos;s 0.75% line right now.</p>
        <p className={s.headroomSub}>
          This is the level where Stripe may take a closer look at your account.
          Resolving your open disputes first is what brings this back down.
        </p>
      </div>
    );
  }

  if (band === 'close') {
    return (
      <div className={s.headroom}>
        <p className={s.headroomLead}>You are getting close to Stripe&apos;s 0.75% line.</p>
        <p className={s.headroomSub}>
          {disputesToLine !== null
            ? `About ${disputesToLine} more disputes would put you at the line. `
            : ''}
          Worth keeping an eye on, nothing urgent today. Your {rateTerm} is recomputed
          daily.
        </p>
      </div>
    );
  }

  return (
    <div className={s.headroom}>
      <p className={s.headroomLead}>You are well under Stripe&apos;s 0.75% line.</p>
      <p className={s.headroomSub}>
        {disputesToLine !== null
          ? `That is about ${disputesToLine} more disputes before you would reach it. Plenty of room. `
          : 'Plenty of room. '}
        Your {rateTerm} is recomputed daily.
      </p>
    </div>
  );
}

// Counts with hierarchy (AH §4d): lead with the two figures that move the rate
// (disputes, early fraud warnings) at display scale; settled volume folds into a
// single mono context line below, not a co-equal third tile.
function Counts({ snapshot }: { snapshot: VampSnapshot | null }) {
  const settled = snapshot?.visa_settled_transaction_count ?? 0;
  return (
    <div className={s.counts}>
      <div className={s.countPair}>
        <Figure num={snapshot?.visa_dispute_count ?? 0} label="Disputes" />
        <Figure num={snapshot?.visa_efw_count ?? 0} label="Early fraud warnings" />
      </div>
      <p className={s.countContext}>
        Out of {settled.toLocaleString('en-US')} settled card charges. {windowNote(snapshot)}
      </p>
    </div>
  );
}

function Figure({ num, label }: { num: number; label: ReactNode }) {
  return (
    <div className={s.figure}>
      <span className={s.figureNum}>{num.toLocaleString('en-US')}</span>
      <span className={s.figureLabel}>{label}</span>
    </div>
  );
}

function LiveCounts({ disputes, efwAlerts }: { disputes: Dispute[]; efwAlerts: EfwAlert[] }) {
  const open = disputes.filter((d) => OPEN_STATUSES.has(d.status)).length;
  return (
    <div className={s.counts}>
      <div className={s.countPair}>
        <Figure num={open} label="Open right now" />
        <Figure num={efwAlerts.length} label="Early fraud warnings" />
      </div>
      <p className={s.countContext}>
        Out of {disputes.length.toLocaleString('en-US')} disputes on record.
      </p>
    </div>
  );
}

function Drivers({
  disputes,
  efwAlerts,
  stripeConnected,
}: {
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  stripeConnected: boolean;
}) {
  if (!stripeConnected) {
    return (
      <p className={s.driverEmpty}>
        Once Stripe is connected, the disputes and warnings affecting your rate show up here.
      </p>
    );
  }

  const openDisputes = disputes.filter((d) => OPEN_STATUSES.has(d.status));
  const actionableEfw = efwAlerts.filter(
    (e) => e.actionable === true && e.merchant_decision === 'pending',
  );
  const topReason = mostCommonReason(disputes);

  type DriverRow = {
    tone: 'gap' | 'watch' | 'neutral';
    text: string;
    sub?: string;
    route?: { href: string; label: string };
  };
  const rows: DriverRow[] = [];

  // Open disputes are being worked, not a one-click-closable gap -> neutral watch.
  if (openDisputes.length > 0) {
    rows.push({
      tone: 'watch',
      text: `${openDisputes.length} open dispute${openDisputes.length === 1 ? '' : 's'} still counting toward your rate.`,
      sub: 'Fighting or resolving these is what moves your headroom.',
      route: { href: '/dashboard', label: 'Review' },
    });
  }
  if (topReason) {
    rows.push({
      tone: 'neutral',
      text: `Most common reason on record: ${topReason.reason}.`,
      sub: `${topReason.count} of your disputes. Service-delivery reasons usually have strong proof.`,
    });
  }
  // An actionable EFW is a real, closable action (refund now) -> the one true gap.
  if (actionableEfw.length > 0) {
    rows.push({
      tone: 'gap',
      text: `${actionableEfw.length} early fraud warning${actionableEfw.length === 1 ? '' : 's'} awaiting a decision.`,
      sub: 'A refund now can prevent a dispute from opening and counting against you.',
      route: { href: '/dashboard', label: 'Decide' },
    });
  }

  if (rows.length === 0) {
    return (
      <div className={s.driverEmptyCard}>
        <CheckIcon className={s.driverEmptyIcon} />
        <p className={s.driverEmpty}>
          Nothing is pulling your account health down right now. Verdact will surface
          new disputes and warnings here as they arrive.
        </p>
      </div>
    );
  }

  return (
    <div className={s.driverList}>
      {rows.map((row, i) => (
        <div key={i} className={`${s.driverRow} ${row.tone === 'gap' ? s.driverRowGap : ''}`}>
          <span
            className={`${s.driverIcon} ${row.tone === 'gap' ? s.driverIconGap : s.driverIconWatch}`}
            aria-hidden="true"
          >
            {row.tone === 'gap' ? <AlertIcon /> : row.tone === 'watch' ? <ClockIcon /> : <InfoCircleIcon />}
          </span>
          <div className={s.driverMain}>
            <p className={s.driverText}>{row.text}</p>
            {row.sub ? <p className={s.driverSub}>{row.sub}</p> : null}
          </div>
          {row.route ? (
            <a className={s.driverRoute} href={row.route.href}>
              {row.route.label}
              <ArrowRightIcon className={s.driverRouteIcon} />
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// A reserved-but-building placeholder so the empty Trend reads as "a chart will
// live here", not a broken feature. Decorative + aria-hidden; static (no motion).
function GhostSparkline() {
  return (
    <svg
      className={s.ghostSpark}
      viewBox="0 0 240 60"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="0" y1="59" x2="240" y2="59" stroke="var(--watch-edge)" strokeWidth="1" />
      <path
        d="M0 46 L40 40 L80 44 L120 30 L160 34 L200 22 L240 26"
        stroke="var(--watch-edge)"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function bandFor(ratio: number): Band {
  if (ratio < HEALTHY_BELOW) return 'healthy';
  if (ratio < LINE_FRACTION) return 'close';
  return 'at-risk';
}

function bandLabel(band: Band | null): string {
  if (band === 'healthy') return 'Healthy';
  if (band === 'close') return 'Getting close';
  if (band === 'at-risk') return 'Over the line';
  return '';
}

// Two-color law: healthy = done (verdict), close = watch (neutral monitoring),
// at-risk = gap (vermilion, the only genuine merchant-actionable alarm here).
function bandTone(band: Band | null): StatusTone {
  if (band === 'healthy') return 'done';
  if (band === 'close') return 'watch';
  if (band === 'at-risk') return 'gap';
  return 'neutral';
}

function gaugeFillClass(band: Band | null): string {
  return band === 'healthy' ? '' : band === 'close' ? s.gaugeFillClose : s.gaugeFillAtRisk;
}

function signalToneClass(tone: StatusTone): string {
  if (tone === 'done') return s.signalTileDone;
  if (tone === 'gap') return s.signalTileGap;
  if (tone === 'watch') return s.signalTileWatch;
  return s.signalTileNeutral;
}

function headlineFor(
  stripeConnected: boolean,
  scored: boolean,
  band: Band | null,
  notScoredKind: NotScoredKind,
): string {
  if (!stripeConnected) return 'Let us measure where you stand.';
  if (!scored || !band) {
    return notScoredKind === 'low-volume'
      ? 'We need a little more volume to score you.'
      : 'We are still reading your account.';
  }
  if (band === 'healthy') return 'You have room to spare.';
  if (band === 'close') return 'You are getting close to the line.';
  return "You are over Stripe's line right now.";
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function gaugePct(ratio: number): number {
  return Math.min((ratio / GAUGE_MAX_FRACTION) * 100, 100);
}

function markerPct(fraction: number): number {
  return Math.min((fraction / GAUGE_MAX_FRACTION) * 100, 100);
}

// Where the rate would sit if one more dispute landed, using the real settled
// denominator from the snapshot. The ghost marker shows this "one more dispute"
// position so the headroom feels concrete. Falls back to the current rate when
// we have no denominator (no false precision).
function nextDisputeFraction(snapshot: VampSnapshot | null, ratio: number): number {
  const settled = snapshot?.visa_settled_transaction_count ?? 0;
  const disputes = snapshot?.visa_dispute_count ?? 0;
  const efw = snapshot?.visa_efw_count ?? 0;
  if (settled <= 0) return ratio;
  return Math.min((disputes + efw + 1) / settled, GAUGE_MAX_FRACTION);
}

// How many more disputes would land the merchant at Stripe's line, using the real
// settled denominator. Clamped to >= 1; null when there is no denominator (drop
// the clause rather than invent precision). Math only on figures already on file.
function disputesUntilLine(snapshot: VampSnapshot | null, ratio: number): number | null {
  const settled = snapshot?.visa_settled_transaction_count ?? 0;
  if (settled <= 0) return null;
  const remaining = Math.floor((LINE_FRACTION - ratio) * settled);
  return Math.max(remaining, 1);
}

function gaugeAria(ratio: number, band: Band | null): string {
  return `Dispute rate ${formatPct(ratio)} of settled charges, ${bandLabel(band).toLowerCase()}, against Stripe's 0.75% line. Above the 0.75% line is where Stripe may take a closer look.`;
}

function mostCommonReason(disputes: Dispute[]): { reason: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const d of disputes) {
    if (!d.reason) continue;
    counts.set(d.reason, (counts.get(d.reason) ?? 0) + 1);
  }
  let best: { reason: string; count: number } | null = null;
  for (const [reason, count] of counts) {
    if (!best || count > best.count) best = { reason, count };
  }
  return best;
}

function trendLine(stripeConnected: boolean, scored: boolean): string {
  if (!stripeConnected) {
    return 'Connect Stripe and your dispute-rate trend builds here as daily readings add up.';
  }
  if (!scored) {
    return 'Your trend appears here once there is enough volume for a stable daily reading. Nothing to do in the meantime.';
  }
  return 'Verdact takes a reading every day. Your trend over time appears here as the history builds. Nothing to do in the meantime.';
}

function freshnessLine(snapshot: VampSnapshot | null, stripeConnected: boolean): string {
  if (!stripeConnected) return 'Not measured yet.';
  if (!snapshot?.calculated_at) return 'Reading your account now.';
  return `Updated ${relativeTime(snapshot.calculated_at)}.`;
}

function windowNote(snapshot: VampSnapshot | null): string {
  if (!snapshot?.calculation_window_start || !snapshot?.calculation_window_end) {
    return 'Trailing 90 days.';
  }
  return `Trailing 90 days, through ${formatDate(snapshot.calculation_window_end)}.`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return `on ${formatDate(iso)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
