import { AppShell } from '../_components/app-chrome';
import { type Dispute, type EfwAlert } from '@/lib/dal';
import { AlertIcon, CheckIcon } from './dash-icons';
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
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  vampRatio: number | null;
  stripeConnection: StripeConnection;
  justConnected: boolean;
  stripeError: string | null;
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

const OPEN_STATUSES = new Set(['needs_response', 'under_review']);

// ── Presentational view ──────────────────────────────────────────────────────
// Pure render layer for the dashboard. Receives already-fetched data and owns
// all derivation + markup. The data wrapper lives in page.tsx; a dev-only
// preview route renders this directly with sample data.

export function DashboardView({
  email,
  businessName,
  disputes,
  efwAlerts,
  vampRatio,
  stripeConnection,
  justConnected,
  stripeError,
}: DashboardViewProps) {
  const greetingName = businessName || email?.split('@')[0] || 'there';

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const openDisputes = disputes.filter((d) => OPEN_STATUSES.has(d.status));
  const needsActionDisputes = disputes.filter((d) => d.status === 'needs_response');

  const sortedByDeadline = [...openDisputes]
    .filter((d) => d.due_by)
    .sort((a, b) => new Date(a.due_by!).getTime() - new Date(b.due_by!).getTime());

  const nextDeadlineDispute = sortedByDeadline[0] ?? null;

  const healthBand =
    vampRatio === null
      ? ('unknown' as const)
      : vampRatio < 0.005
        ? ('healthy' as const)
        : vampRatio < 0.0075
          ? ('close' as const)
          : ('at-risk' as const);

  // Percentage for the meter (capped at 150% of the 0.75% line for visual range)
  const meterPct =
    vampRatio === null ? 0 : Math.min((vampRatio / 0.01125) * 100, 100);

  const stripeAccountLabel = stripeConnection
    ? formatStripeAccountId(stripeConnection.processor_account_id)
    : null;

  // Guidance insights (rule-based heuristics)
  const insights = buildInsights({
    needsActionCount: needsActionDisputes.length,
    healthBand,
    efwAlerts,
    hasStripe: !!stripeConnection,
  });

  return (
    <AppShell email={email} businessName={businessName} active="dashboard">
      {/* ── Not-connected soft banner ────────────────────────────── */}
      {!stripeConnection && (
        <div className={s.connectBanner}>
          <span>Connect Stripe to start watching your disputes and account health.</span>
          <a href="/api/stripe/connect/start" className={s.connectBannerAction}>
            Connect Stripe
          </a>
        </div>
      )}

      <div className={s.page}>
        {/* Stripe connection banners */}
        {justConnected && (
          <div className={s.banner} role="status">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            Stripe connected. Verdact saved the connected account ID; no API keys were stored.
          </div>
        )}
        {stripeError && (
          <div className={`${s.banner} ${s.bannerError}`} role="alert">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {STRIPE_ERROR_MESSAGES[stripeError] ??
              'Something went wrong with Stripe. Please try again.'}
          </div>
        )}

        {/* ── Zone A: Header line ──────────────────────────────────── */}
        <header className={s.header}>
          <div className={s.greeting}>
            <h1 className={s.greetingText}>
              Good {timeOfDay}, {greetingName}.
            </h1>
            {businessName && <p className={s.workspaceName}>{businessName}</p>}
          </div>

          {stripeConnection ? (
            <span className={`${s.chip} ${s.chipConnected}`}>
              <span className={s.chipDot} aria-hidden="true" />
              Stripe connected{stripeConnection.livemode ? '' : ' (test)'}
              {stripeAccountLabel ? ` · ${stripeAccountLabel}` : ''}
            </span>
          ) : (
            <a href="/api/stripe/connect/start" className={s.chip}>
              Connect Stripe
            </a>
          )}
        </header>

        {/* ── Zone B: Status tiles ─────────────────────────────────── */}
        <div className={s.tiles}>
          {/* Tile 1: Account health */}
          <div className={s.tile}>
            <p className={s.tileLabel}>Account health</p>
            <AccountHealthContent
              band={healthBand}
              ratio={vampRatio}
              meterPct={meterPct}
              s={s}
            />
          </div>

          {/* Tile 2: Open disputes */}
          <a href="/disputes?filter=needs-action" className={s.tile}>
            <p className={s.tileLabel}>Open disputes</p>
            <p className={s.tileFigure}>{openDisputes.length}</p>
            <p className={s.tileSub}>
              {needsActionDisputes.length === 0
                ? 'None need action'
                : `${needsActionDisputes.length} need${needsActionDisputes.length === 1 ? 's' : ''} action`}
            </p>
          </a>

          {/* Tile 3: Next deadline */}
          {nextDeadlineDispute ? (
            <a href={`/dashboard/disputes/${nextDeadlineDispute.id}`} className={s.tile}>
              <p className={s.tileLabel}>Next deadline</p>
              <DeadlineContent dispute={nextDeadlineDispute} s={s} />
            </a>
          ) : (
            <div className={s.tile}>
              <p className={s.tileLabel}>Next deadline</p>
              <p className={`${s.tileFigure} ${s.tileSub}`} style={{ fontSize: '14px', marginTop: '8px' }}>
                No open disputes
              </p>
            </div>
          )}
        </div>

        {/* ── Zone C: Disputes queue ───────────────────────────────── */}
        <section className={s.queueSection}>
          <div className={s.queueHeader}>
            <h2 className={s.queueTitle}>Disputes</h2>
            <a href="/disputes" className={s.viewAllLink}>
              View all disputes
            </a>
          </div>

          <DisputeQueue disputes={disputes} efwAlerts={efwAlerts} s={s} />
        </section>

        {/* ── Zone D: Guidance band ────────────────────────────────── */}
        {stripeConnection && (
          <section className={s.guidance}>
            <h2 className={s.guidanceTitle}>What Verdact is watching</h2>
            <div className={s.insights}>
              {insights.map((insight, i) => (
                <div key={i} className={s.insightCard}>
                  <p className={s.insightText}>{insight.text}</p>
                  <p className={s.insightAction}>{insight.action}</p>
                </div>
              ))}
            </div>
            <p className={s.guidanceFoot}>
              Based on your own data. Verdact advises, you decide. No guarantees.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

type CssModuleStyles = Record<string, string>;

function AccountHealthContent({
  band,
  ratio,
  meterPct,
  s,
}: {
  band: 'healthy' | 'close' | 'at-risk' | 'unknown';
  ratio: number | null;
  meterPct: number;
  s: CssModuleStyles;
}) {
  if (band === 'unknown') {
    return (
      <>
        <p className={s.tileFigure} style={{ fontSize: '22px' }}>
          Low volume
        </p>
        <p className={s.tileSub}>Not enough data for a read</p>
      </>
    );
  }

  const pctLabel = ratio !== null ? `${(ratio * 100).toFixed(2)}%` : '—';
  const dotClass =
    band === 'healthy'
      ? s.statusDotHealthy
      : band === 'close'
        ? s.statusDotClose
        : s.statusDotAtRisk;
  const labelClass =
    band === 'healthy'
      ? s.statusLabelHealthy
      : band === 'close'
        ? s.statusLabelClose
        : s.statusLabelAtRisk;
  const label =
    band === 'healthy' ? 'Healthy' : band === 'close' ? 'Getting close' : 'At risk';
  const fillClass =
    band === 'healthy'
      ? ''
      : band === 'close'
        ? s.meterFillClose
        : s.meterFillAtRisk;

  return (
    <>
      <p className={s.tileFigure}>{pctLabel}</p>
      <div
        className={s.tileStatusRow}
        role="img"
        aria-label={`Account health: ${label}. Dispute rate ${pctLabel} vs Stripe's 0.75% threshold.`}
      >
        <span className={`${s.statusDot} ${dotClass}`} aria-hidden="true" />
        <span className={`${s.statusLabel} ${labelClass}`}>{label}</span>
      </div>
      <div className={s.meterBar} aria-hidden="true">
        <div
          className={`${s.meterFill} ${fillClass}`}
          style={{ width: `${meterPct}%` }}
        />
      </div>
      <p className={s.tileSub}>vs Stripe's 0.75% line</p>
    </>
  );
}

function DeadlineContent({
  dispute,
  s,
}: {
  dispute: Dispute;
  s: CssModuleStyles;
}) {
  if (!dispute.due_by) {
    return <p className={s.tileSub}>No deadline set</p>;
  }
  const days = daysUntil(dispute.due_by);
  const label = deadlineLabel(days);
  const isUrgent = days <= 3;

  return (
    <>
      <p className={`${s.tileFigure} ${isUrgent ? s.tileFigureUrgent : ''}`}>{label}</p>
      <p className={s.tileSub}>
        {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : '—'}
        {dispute.reason ? ` · ${dispute.reason}` : ''}
      </p>
    </>
  );
}

function DisputeQueue({
  disputes,
  efwAlerts,
  s,
}: {
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  s: CssModuleStyles;
}) {
  const activeDisputes = disputes
    .filter((d) => OPEN_STATUSES.has(d.status))
    .sort((a, b) => {
      if (!a.due_by && !b.due_by) return 0;
      if (!a.due_by) return 1;
      if (!b.due_by) return -1;
      return new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
    });

  // Marcus simplification: exactly one active dispute → action card
  if (activeDisputes.length === 1) {
    const d = activeDisputes[0];
    const days = d.due_by ? daysUntil(d.due_by) : null;
    const deadlineCopy = days !== null ? deadlineLabel(days) : null;

    return (
      <div className={s.actionCard}>
        <div>
          <p className={s.actionCardLabel}>Action needed</p>
          <p className={s.actionCardTitle}>{d.reason ?? 'Dispute'}</p>
          <p className={s.actionCardMeta}>
            {d.amount != null ? formatAmount(d.amount, d.currency) : '—'}
            {deadlineCopy ? ` · ${deadlineCopy}` : ''}
          </p>
        </div>
        <a href={`/dashboard/disputes/${d.id}`} className={s.actionCardBtn}>
          Build your response
        </a>
      </div>
    );
  }

  // Empty state (Stripe connected, no open disputes)
  if (activeDisputes.length === 0 && efwAlerts.length === 0) {
    return (
      <div className={s.queueEmpty}>
        <p className={s.queueEmptyTitle}>
          {disputes.length === 0
            ? "You're set up. Nothing needs you yet."
            : 'No open disputes right now.'}
        </p>
        <p className={s.queueEmptyText}>
          Verdact is watching your account health and will surface new disputes as they arrive.
        </p>
      </div>
    );
  }

  return (
    <div className={s.disputeList}>
      {activeDisputes.map((d) => {
        const days = d.due_by ? daysUntil(d.due_by) : null;
        const isUrgent = days !== null && days <= 3;
        const actionLabel =
          d.status === 'needs_response'
            ? 'Build response'
            : d.status === 'under_review'
              ? 'Review'
              : 'View';

        return (
          <div key={d.id} className={s.disputeRow}>
            <div className={s.disputeRowStatus}>
              <span
                className={`${s.statusDot} ${s.statusDotNeutral}`}
                aria-hidden="true"
              />
              <span className={s.disputeRowStatusLabel}>
                {statusLabel(d.status)}
              </span>
            </div>

            <div className={s.disputeRowInfo}>
              <span className={s.disputeRowReason}>{d.reason ?? 'Dispute'}</span>
              <span className={s.disputeRowId}>
                {d.processor_charge_id ? truncateChargeId(d.processor_charge_id) : '—'}
              </span>
            </div>

            <span className={s.disputeRowAmount}>
              {d.amount != null ? formatAmount(d.amount, d.currency) : '—'}
            </span>

            <span
              className={`${s.disputeRowDeadline} ${isUrgent ? s.disputeRowDeadlineUrgent : ''}`}
            >
              {days !== null ? deadlineLabel(days) : '—'}
            </span>

            <a
              href={`/dashboard/disputes/${d.id}`}
              className={s.disputeRowAction}
            >
              {actionLabel}
            </a>
          </div>
        );
      })}

      {efwAlerts.map((efw) => (
        <div key={efw.id} className={`${s.disputeRow} ${s.efwRow}`}>
          <span className={s.efwRowLabel}>EFW</span>
          <div className={s.disputeRowInfo}>
            <span className={s.disputeRowReason}>{efw.fraud_type ?? 'Early fraud warning'}</span>
            <span className={s.disputeRowId}>{efw.processor_charge_id ? truncateChargeId(efw.processor_charge_id) : '—'}</span>
          </div>
          <span />
          <span className={s.disputeRowDeadline} />
          <span
            className={s.disputeRowStatusLabel}
            style={{ fontSize: '12px', color: 'var(--ink-3)' }}
          >
            {efw.merchant_decision === 'pending' ? 'Pending review' : efw.merchant_decision}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Guidance insight builder ─────────────────────────────────────────────────

type Insight = { text: string; action: string };

function buildInsights({
  needsActionCount,
  healthBand,
  efwAlerts,
  hasStripe,
}: {
  needsActionCount: number;
  healthBand: 'healthy' | 'close' | 'at-risk' | 'unknown';
  efwAlerts: EfwAlert[];
  hasStripe: boolean;
}): Insight[] {
  const list: Insight[] = [];

  if (!hasStripe) {
    list.push({
      text: 'Connect Stripe to start seeing disputes and account health data.',
      action: 'Connect Stripe in settings',
    });
  }

  if (needsActionCount > 0) {
    list.push({
      text: `${needsActionCount} dispute${needsActionCount === 1 ? '' : 's'} need${needsActionCount === 1 ? 's' : ''} a response. Review the proof checklist before you write.`,
      action: 'Open the nearest deadline',
    });
  }

  if (healthBand === 'close' || healthBand === 'at-risk') {
    list.push({
      text:
        healthBand === 'at-risk'
          ? "Your dispute rate is above Stripe's 0.75% threshold. Act on the nearest deadlines first."
          : "Your dispute rate is approaching Stripe's 0.75% threshold. Fighting the strongest cases first helps.",
      action: 'See account health',
    });
  }

  const actionableEfw = efwAlerts.filter(
    (e) => e.actionable === true && e.merchant_decision === 'pending',
  );
  if (actionableEfw.length > 0) {
    list.push({
      text: `You have ${actionableEfw.length} early fraud warning${actionableEfw.length === 1 ? '' : 's'}. Issuing a refund now may prevent a dispute from opening.`,
      action: 'Review early fraud warnings',
    });
  }

  if (list.length < 2) {
    list.push({
      text: 'Add your refund policy and delivery confirmation now so they are ready when a dispute lands.',
      action: 'Set up evidence sources in settings',
    });
  }

  if (list.length < 2) {
    list.push({
      text: 'Reason code 13.1 is the most common dispute type for service merchants. Your scope and delivery proof is usually strong here.',
      action: 'View account health',
    });
  }

  return list.slice(0, 4);
}

// ── Utility functions ────────────────────────────────────────────────────────

function daysUntil(dueBy: string): number {
  const now = new Date();
  const due = new Date(dueBy);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

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
