import { AppShell } from '../_components/app-chrome';
import { ConnectStripePanel } from '../_components/connect-stripe-panel';
import { type Dispute, type EfwAlert } from '@/lib/dal';
import { URGENT_DAYS, type GuidanceItem, type GuidanceResult, type HealthBand } from '@/lib/guidance';
import { AlertIcon, CheckIcon } from './dash-icons';
import { dismissGuidanceAction } from './actions';
import {
  OPEN_STATUSES,
  STRIPE_LINE_FRACTION,
  GAUGE_MAX_FRACTION,
  bandFor,
  daysUntil,
  byDeadlineThenCreated,
} from './signals';
import s from './dashboard.module.css';

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

  const standing = buildStandingSentence({
    healthBand,
    healthConfident,
    openCount: openDisputes.length,
    nearestDays,
  });

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
          <h1 className={s.eyebrow}>Dashboard</h1>
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
            {/* ── Standing sentence ─────────────────────────────────── */}
            <p className={s.stand}>{standing}</p>

            {/* ── Ledger line ───────────────────────────────────────── */}
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

            {/* ── The record (docket / single case / empty) ─────────── */}
            <RecordSection
              s={s}
              openDisputes={openDisputes}
              proofByDispute={proofByDispute}
              hasFiledBefore={recovered.count > 0 || disputes.length > openDisputes.length}
            />

            {/* ── Prevention lane (early fraud warnings) ────────────── */}
            <PreventLane s={s} alerts={actionableEfw} hasOpen={openDisputes.length > 0} />

            {/* ── Guidance band (Layer 1) + primers (Layer 4) ───────── */}
            <GuidanceBand s={s} band={guidance.band} primers={guidance.primers} />
          </>
        )}
      </div>
    </AppShell>
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
        <div className={s.sub}>Too early to score — not enough settled volume yet.</div>
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
          {dispute.processor_charge_id ? truncateChargeId(dispute.processor_charge_id) : '—'} ·{' '}
          {statusLabel(dispute.status)}
        </div>
        <ProofRow s={s} proof={proof} />
      </div>
      <div className={s.rRight}>
        <div className={`${s.amt} ${s.num}`}>
          {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : '—'}
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
            {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : '—'}
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

// ── Guidance band (Layer 1) + primers (Layer 4) ──────────────────────────────

function GuidanceBand({
  s,
  band,
  primers,
}: {
  s: CssModuleStyles;
  band: GuidanceItem[];
  primers: GuidanceItem[];
}) {
  if (band.length === 0 && primers.length === 0) return null;
  return (
    <section className={s.guide}>
      {band.map((item) => (
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
              <button type="submit" className={s.guideDismiss} aria-label={`Dismiss tip: ${item.text}`}>
                Dismiss
              </button>
            </form>
          )}
        </div>
      ))}
      {primers.length > 0 && (
        <div className={s.primers}>
          {primers.map((p) => (
            <a key={p.id} href={p.actionHref ?? '#'} className={s.primerLink}>
              {p.text}
            </a>
          ))}
        </div>
      )}
      <p className={s.guideFoot}>Based on your own data. Verdact advises, you decide. No guarantees.</p>
    </section>
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
}: {
  healthBand: HealthBand;
  healthConfident: boolean;
  openCount: number;
  nearestDays: number | null;
}): string {
  const healthClause =
    !healthConfident || healthBand === 'unknown'
      ? 'Your account health is still calibrating'
      : healthBand === 'healthy'
        ? 'Your account is healthy, with room to the line'
        : healthBand === 'close'
          ? "Your account is approaching Stripe's 0.75% line"
          : "Your account is over Stripe's 0.75% line";

  if (openCount === 0) {
    return "You're set up. Nothing needs you right now — here's what Verdact is watching.";
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
