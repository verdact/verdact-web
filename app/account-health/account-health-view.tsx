import { AppShell } from '../_components/app-chrome';
import { type Dispute, type EfwAlert, type VampSnapshot } from '@/lib/dal';
import { STRIPE_LINE, GAUGE_MAX } from '@/lib/account-health/vamp-snapshots';
import { MeasuredPopup } from './_components/measured-popup';
import { ExportButton } from './_components/export-button';
import { RefreshButton } from './_components/refresh-button';
import s from './account-health.module.css';

// ── Constants (mirror the server writer; STRIPE_LINE/GAUGE_MAX are percents) ──
const LINE_FRACTION = STRIPE_LINE / 100; // 0.0075 — the line we score against
const GAUGE_MAX_FRACTION = GAUGE_MAX / 100; // 0.015 — far edge of the gauge
const HEALTHY_BELOW = 0.005;

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

type Band = 'healthy' | 'close' | 'at-risk';

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

  return (
    <AppShell email={email} businessName={businessName} active="account-health">
      <div className={s.page}>
        {/* ── Zone A: header + freshness + status chip ─────────────── */}
        <header className={s.headerRow}>
          <div className={s.headerText}>
            <h1 className={s.pageTitle}>Account health</h1>
            <div className={s.freshnessRow}>
              <p className={s.freshness}>{freshnessLine(snapshot, stripeConnected)}</p>
              {stripeConnected ? <RefreshButton /> : null}
            </div>
          </div>
          <StatusChip stripeConnected={stripeConnected} scored={scored} band={band} />
        </header>

        {/* ── Zone B: standing read ────────────────────────────────── */}
        <section className={s.panel} aria-labelledby="standing-label">
          <p className={s.panelLabel} id="standing-label">
            Dispute rate
          </p>

          {!stripeConnected ? (
            <div className={s.notScored}>
              <p className={s.notScoredTitle}>Connect Stripe to measure your account health.</p>
              <p className={s.notScoredText}>
                Verdact reads your settled charges, disputes, and early fraud warnings
                to show where your dispute rate stands. No card data is stored, and no
                API keys are kept.
              </p>
              <a href="/api/stripe/connect/start" className={s.connectCta}>
                Connect Stripe
              </a>
            </div>
          ) : !scored ? (
            <div className={s.notScored}>
              <p className={s.notScoredTitle}>Too early to score.</p>
              <p className={s.notScoredText}>
                {confidence === 'low'
                  ? "You don't have enough settled volume yet for a stable read. We won't show a rate we can't stand behind. As your charge volume grows, this fills in on its own."
                  : 'Verdact is still gathering your first full read. This will populate shortly, with no action needed from you.'}
              </p>
              <LiveCounts disputes={disputes} efwAlerts={efwAlerts} />
              <MeasuredPopup />
            </div>
          ) : (
            <>
              <div className={s.standingTop}>
                <p className={s.readNumber}>{formatPct(ratio as number)}</p>
                <p className={`${s.readBand} ${bandClass(band, 'readBand')}`}>{bandLabel(band)}</p>
              </div>
              <p className={s.headroom}>{headroomLine(ratio as number, band)}</p>

              <div className={s.gauge} role="img" aria-label={gaugeAria(ratio as number, band)}>
                <div className={s.gaugeTrack}>
                  <div
                    className={`${s.gaugeFill} ${bandClass(band, 'gaugeFill')}`}
                    style={{ width: `${gaugePct(ratio as number)}%` }}
                  />
                  <span className={s.gaugeMarker} style={{ left: `${markerPct(LINE_FRACTION)}%` }} />
                </div>
                <div className={s.gaugeScale}>
                  <span>0%</span>
                  <span>0.75% line</span>
                  <span>{GAUGE_MAX}%</span>
                </div>
              </div>

              <div className={s.counts}>
                <CountItem num={snapshot?.visa_settled_transaction_count ?? 0} label="Settled card charges" />
                <CountItem num={snapshot?.visa_dispute_count ?? 0} label="Disputes" />
                <CountItem num={snapshot?.visa_efw_count ?? 0} label="Early fraud warnings" />
              </div>
              <p className={s.windowNote}>{windowNote(snapshot)}</p>

              <div className={s.exportRow}>
                <MeasuredPopup />
                <div className={s.exportRow}>
                  <span className={s.betaTag}>Beta</span>
                  <ExportButton />
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Zone C: trend ────────────────────────────────────────── */}
        <section className={s.panel}>
          <p className={s.panelLabel}>Trend</p>
          <p className={s.trendEmpty}>{trendLine(stripeConnected, scored)}</p>
        </section>

        {/* ── Zone D: drivers (live data, renders pre-writer) ──────── */}
        <section className={s.panel} aria-labelledby="drivers-label">
          <p className={s.panelLabel} id="drivers-label">
            What is affecting your account health
          </p>
          <Drivers disputes={disputes} efwAlerts={efwAlerts} stripeConnected={stripeConnected} />
        </section>

        {/* ── Zone E: monitoring reassurance ───────────────────────── */}
        <section className={s.panel}>
          <p className={s.panelLabel}>What Verdact is watching</p>
          <ul className={s.monitorList}>
            {MONITOR_ITEMS.map((item) => (
              <li key={item} className={s.monitorItem}>
                <TickIcon className={s.monitorTick} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className={s.foot}>
            Reference lines from Stripe and the card networks, not a verdict on your
            account. Verdact advises, you decide.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const MONITOR_ITEMS: string[] = [
  'Your dispute rate against the 0.75% line, recomputed daily.',
  'Early fraud warnings, where a refund now can stop a dispute from opening.',
  'Disputes that may qualify under CE 3.0, which can be excluded from your rate.',
  'Deadlines on open disputes, so the strongest cases get fought in time.',
];

function StatusChip({
  stripeConnected,
  scored,
  band,
}: {
  stripeConnected: boolean;
  scored: boolean;
  band: Band | null;
}) {
  if (!stripeConnected) {
    return (
      <span className={s.statusChip}>
        <span className={`${s.statusDot} ${s.statusDotNeutral}`} aria-hidden="true" />
        Not connected
      </span>
    );
  }
  if (!scored || !band) {
    return (
      <span className={s.statusChip}>
        <span className={`${s.statusDot} ${s.statusDotNeutral}`} aria-hidden="true" />
        Not yet scored
      </span>
    );
  }
  return (
    <span className={`${s.statusChip} ${chipClass(band)}`}>
      <span className={`${s.statusDot} ${dotClass(band)}`} aria-hidden="true" />
      {bandLabel(band)}
    </span>
  );
}

function LiveCounts({ disputes, efwAlerts }: { disputes: Dispute[]; efwAlerts: EfwAlert[] }) {
  const open = disputes.filter((d) => OPEN_STATUSES.has(d.status)).length;
  return (
    <div className={s.counts}>
      <CountItem num={disputes.length} label="Disputes on record" />
      <CountItem num={open} label="Open right now" />
      <CountItem num={efwAlerts.length} label="Early fraud warnings" />
    </div>
  );
}

function CountItem({ num, label }: { num: number; label: string }) {
  return (
    <div className={s.countItem}>
      <span className={s.countNum}>{num.toLocaleString('en-US')}</span>
      <span className={s.countLabel}>{label}</span>
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

  const rows: Array<{ mark: 'gap' | 'verdict' | 'neutral'; text: string; sub?: string }> = [];

  if (openDisputes.length > 0) {
    rows.push({
      mark: 'gap',
      text: `${openDisputes.length} open dispute${openDisputes.length === 1 ? '' : 's'} still counting toward your rate.`,
      sub: 'Fighting or resolving these is what moves your headroom.',
    });
  }
  if (topReason) {
    rows.push({
      mark: 'neutral',
      text: `Most common reason on record: ${topReason.reason}.`,
      sub: `${topReason.count} of your disputes. Service-delivery reasons usually have strong proof.`,
    });
  }
  if (actionableEfw.length > 0) {
    rows.push({
      mark: 'gap',
      text: `${actionableEfw.length} early fraud warning${actionableEfw.length === 1 ? '' : 's'} awaiting a decision.`,
      sub: 'A refund now can prevent a dispute from opening and counting against you.',
    });
  }

  if (rows.length === 0) {
    return (
      <p className={s.driverEmpty}>
        Nothing is pulling your account health down right now. Verdact will surface
        new disputes and warnings here as they arrive.
      </p>
    );
  }

  return (
    <div className={s.driverList}>
      {rows.map((row, i) => (
        <div key={i} className={s.driverRow}>
          <span className={`${s.driverMark} ${markClass(row.mark)}`} aria-hidden="true" />
          <div>
            <p className={s.driverText}>{row.text}</p>
            {row.sub ? <p className={s.driverSub}>{row.sub}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function TickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function bandClass(band: Band | null, base: 'readBand' | 'gaugeFill'): string {
  if (base === 'readBand') {
    return band === 'healthy' ? s.readBandHealthy : band === 'close' ? s.readBandClose : s.readBandAtRisk;
  }
  return band === 'healthy' ? '' : band === 'close' ? s.gaugeFillClose : s.gaugeFillAtRisk;
}

function chipClass(band: Band): string {
  return band === 'healthy' ? s.statusChipHealthy : band === 'close' ? s.statusChipClose : s.statusChipAtRisk;
}

function dotClass(band: Band): string {
  return band === 'healthy' ? s.statusDotHealthy : band === 'close' ? s.statusDotClose : s.statusDotAtRisk;
}

function markClass(mark: 'gap' | 'verdict' | 'neutral'): string {
  return mark === 'gap' ? s.driverMarkGap : mark === 'verdict' ? s.driverMarkVerdict : '';
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

function headroomLine(ratio: number, band: Band | null): string {
  const linePct = STRIPE_LINE; // 0.75
  const currentPct = ratio * 100;
  if (band === 'at-risk') {
    const over = (currentPct - linePct).toFixed(2);
    return `You are ${over} points over Stripe's 0.75% line. Acting on your open disputes first is what brings this down.`;
  }
  const headroom = (linePct - currentPct).toFixed(2);
  if (band === 'close') {
    return `You have ${headroom} points of headroom before Stripe's 0.75% line. Worth watching.`;
  }
  return `You have ${headroom} points of headroom before Stripe's 0.75% line. Comfortable.`;
}

function gaugeAria(ratio: number, band: Band | null): string {
  return `Dispute rate ${formatPct(ratio)} of settled charges, ${bandLabel(band).toLowerCase()}, against Stripe's 0.75% line.`;
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
    return 'Connect Stripe and your dispute-rate trend will build here as daily readings accumulate.';
  }
  if (!scored) {
    return 'Your trend will appear here once there is enough volume for a stable daily reading. Nothing to do in the meantime.';
  }
  return 'Verdact records a reading every day. Your trend over time will appear here as the history builds.';
}

function freshnessLine(snapshot: VampSnapshot | null, stripeConnected: boolean): string {
  if (!stripeConnected) return 'Not measured yet.';
  if (!snapshot?.calculated_at) return 'Waiting for the first reading.';
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
  return formatDate(iso);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
