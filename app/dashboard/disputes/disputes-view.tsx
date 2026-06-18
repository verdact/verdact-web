import { AppShell } from '../../_components/app-chrome';
import { ConnectStripePanel } from '../../_components/connect-stripe-panel';
import { type Dispute } from '@/lib/dal';
import s from './disputes.module.css';

// Presentational disputes queue/index. Reuses the dashboard's row treatment and
// helpers, adds filter tabs (needs action / open / all) and a proper empty
// state. Data wrapper lives in page.tsx; a dev-only route renders this directly.

export type DisputeFilter = 'needs-action' | 'open' | 'all';

export type DisputesViewProps = {
  email: string | null | undefined;
  businessName: string | null;
  disputes: Dispute[];
  stripeConnected: boolean;
  filter: DisputeFilter;
  /**
   * Present proof pillars per dispute, keyed by dispute id (respondable cases).
   * Optional so the dev preview route can render without a DB read; the chip
   * then reads as an honest "add your proof" gap rather than fabricating one.
   */
  proofByDispute?: Record<string, string[]>;
};

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

// Statuses where a "Worth responding" readiness chip is meaningful: a response
// can still be built. Closed/resolved cases never carry the chip.
const RESPONDABLE_STATUSES = new Set(['needs_response', 'under_review']);

// The core proof pillars an evidence record leans on. The chip grades these
// present (verdict green) vs missing (vermilion "Gap"). This is evidence
// completeness, not a win prediction: strictly no odds, percentages, or
// guarantees. Reason-code-specific requirements are a later delta (C-F1).
const REQUIRED_PILLARS = ['Delivery', 'Comms', 'Policy'] as const;

// Under 48 hours to respond is the only window that earns the vermilion
// deadline accent. Anything further out stays neutral.
const URGENT_HOURS = 48;

const FILTERS: Array<{ key: DisputeFilter; label: string }> = [
  { key: 'needs-action', label: 'Needs action' },
  { key: 'open', label: 'Open' },
  { key: 'all', label: 'All' },
];

export function isDisputeFilter(value: string | undefined): value is DisputeFilter {
  return value === 'needs-action' || value === 'open' || value === 'all';
}

export function DisputesView({
  email,
  businessName,
  disputes,
  stripeConnected,
  filter,
  proofByDispute = {},
}: DisputesViewProps) {
  const counts = {
    'needs-action': disputes.filter((d) => d.status === 'needs_response').length,
    open: disputes.filter((d) => OPEN_STATUSES.has(d.status)).length,
    all: disputes.length,
  };

  const visible = sortByDeadline(filterDisputes(disputes, filter));

  return (
    <AppShell email={email} businessName={businessName} active="disputes">
      <div className={s.page}>
        <header className={s.header}>
          <h1 className={s.title}>Disputes</h1>
          <p className={s.sub}>
            Every dispute Verdact is watching, with the strongest cases and nearest deadlines first.
          </p>
        </header>

        {!stripeConnected ? (
          <ConnectStripePanel context="disputes" />
        ) : (
          <>
            <nav className={s.tabs} aria-label="Filter disputes">
              {FILTERS.map((tab) => (
                <a
                  key={tab.key}
                  href={`/dashboard/disputes?filter=${tab.key}`}
                  className={`${s.tab} ${filter === tab.key ? s.tabActive : ''}`}
                  aria-current={filter === tab.key ? 'page' : undefined}
                >
                  {tab.label}
                  <span className={s.tabCount}>{counts[tab.key]}</span>
                </a>
              ))}
            </nav>

            {visible.length === 0 ? (
              <EmptyState filter={filter} hasAny={disputes.length > 0} />
            ) : (
              <div className={s.list}>
                {visible.map((d) => (
                  <DisputeRow key={d.id} dispute={d} proof={proofByDispute[d.id] ?? []} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DisputeRow({ dispute, proof }: { dispute: Dispute; proof: string[] }) {
  const isOpen = OPEN_STATUSES.has(dispute.status);
  const isRespondable = RESPONDABLE_STATUSES.has(dispute.status);
  const hours = dispute.due_by ? hoursUntil(dispute.due_by) : null;
  const isUrgent = isOpen && hours !== null && hours < URGENT_HOURS;
  const actionLabel =
    dispute.status === 'needs_response'
      ? 'Build response'
      : dispute.status === 'under_review'
        ? 'Review'
        : 'View';

  return (
    <a href={`/dashboard/disputes/${dispute.id}`} className={s.row}>
      <div className={s.rowStatus}>
        <span className={`${s.statusDot} ${dotClass(dispute.status)}`} aria-hidden="true" />
        <span className={s.rowStatusLabel}>{statusLabel(dispute.status)}</span>
      </div>

      <div className={s.rowInfo}>
        <span className={s.rowReason}>{dispute.reason ?? 'Dispute'}</span>
        <span className={s.rowId}>
          {dispute.processor_charge_id ? truncateChargeId(dispute.processor_charge_id) : '—'}
        </span>
        {isRespondable && <ReadinessChip proof={proof} />}
      </div>

      <span className={s.rowAmount}>
        {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : '—'}
      </span>

      {isOpen && dispute.due_by ? (
        <span
          className={`${s.rowDeadline} ${isUrgent ? s.rowDeadlineUrgent : ''}`}
          aria-label={deadlineAria(dispute.due_by, hours)}
        >
          <ClockIcon />
          <span>{deadlineLabel(dispute.due_by, hours)}</span>
        </span>
      ) : (
        <span className={s.rowDeadline}>{closedDeadlineLabel(dispute.status)}</span>
      )}

      <span className={s.rowAction}>{actionLabel}</span>
    </a>
  );
}

// Honest, hedged evidence-strength chip. Grades the present proof pillars
// (verdict green, icon + text) against the missing required ones (vermilion
// "Gap"). This is evidence completeness, not a win prediction: strictly no
// percentages, no odds, no "you'll win", no guarantee.
function ReadinessChip({ proof }: { proof: string[] }) {
  const present = new Set(proof);
  const missing = REQUIRED_PILLARS.filter((p) => !present.has(p));

  if (proof.length === 0) {
    return (
      <span className={`${s.chip} ${s.chipGap}`}>
        <GapIcon />
        <span>Worth responding: add your proof to start</span>
      </span>
    );
  }

  if (missing.length === 0) {
    return (
      <span className={`${s.chip} ${s.chipReady}`}>
        <CheckIcon />
        <span>Worth responding: your required proof is on file</span>
      </span>
    );
  }

  return (
    <span className={`${s.chip} ${s.chipGap}`}>
      <GapIcon />
      <span>Worth responding: gap in {formatList(missing)}</span>
    </span>
  );
}

function ClockIcon() {
  return (
    <svg className={s.deadlineIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className={s.chipIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function GapIcon() {
  return (
    <svg className={s.chipIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

function EmptyState({ filter, hasAny }: { filter: DisputeFilter; hasAny: boolean }) {
  const copy = emptyCopy(filter, hasAny);
  return (
    <div className={s.empty}>
      <p className={s.emptyTitle}>{copy.title}</p>
      <p className={s.emptyText}>{copy.text}</p>
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function filterDisputes(disputes: Dispute[], filter: DisputeFilter): Dispute[] {
  if (filter === 'needs-action') return disputes.filter((d) => d.status === 'needs_response');
  if (filter === 'open') return disputes.filter((d) => OPEN_STATUSES.has(d.status));
  return disputes;
}

function sortByDeadline(disputes: Dispute[]): Dispute[] {
  return [...disputes].sort((a, b) => {
    if (!a.due_by && !b.due_by) return 0;
    if (!a.due_by) return 1;
    if (!b.due_by) return -1;
    return new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
  });
}

function emptyCopy(filter: DisputeFilter, hasAny: boolean): { title: string; text: string } {
  if (filter === 'needs-action') {
    return {
      title: 'Nothing needs you right now.',
      text: 'No dispute is waiting on a response. Verdact will surface new ones here the moment they arrive.',
    };
  }
  if (filter === 'open') {
    return {
      title: 'No open disputes.',
      text: 'Nothing is currently in flight. Verdact keeps watching and will list new disputes as they open.',
    };
  }
  return {
    title: hasAny ? 'No disputes match this view.' : "You're set up. No disputes yet.",
    text: hasAny
      ? 'Try another filter above.'
      : 'Verdact is watching your account. New disputes and early fraud warnings will appear here.',
  };
}

function dotClass(status: string): string {
  if (status === 'needs_response') return s.statusDotAtRisk;
  if (status === 'won') return s.statusDotHealthy;
  return s.statusDotNeutral;
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

function hoursUntil(dueBy: string): number {
  const diff = new Date(dueBy).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60));
}

// "Respond by Jun 24, 4 days left". When under a day, the lead drops to hours
// left so the urgency reads honestly; when overdue it states the date passed.
function deadlineLabel(dueBy: string, hours: number | null): string {
  const by = formatDueDate(dueBy);
  if (hours === null) return `Respond by ${by}`;
  if (hours < 0) return `Respond by ${by}, deadline passed`;
  if (hours < 1) return `Respond by ${by}, under an hour left`;
  if (hours < 24) {
    const h = Math.floor(hours);
    return `Respond by ${by}, ${h} hour${h === 1 ? '' : 's'} left`;
  }
  const days = Math.floor(hours / 24);
  return `Respond by ${by}, ${days} day${days === 1 ? '' : 's'} left`;
}

function deadlineAria(dueBy: string, hours: number | null): string {
  return `Response deadline: ${deadlineLabel(dueBy, hours)}`;
}

// What the deadline cell shows once a case is closed (no live countdown).
function closedDeadlineLabel(status: string): string {
  if (status === 'submitted') return 'Submitted';
  if (status === 'won' || status === 'lost' || status === 'warning_closed') return 'Closed';
  return '—';
}

function formatDueDate(dueBy: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dueBy));
}

// "Delivery, Comms and Policy" — Oxford-free join for the gap chip copy.
function formatList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function formatAmount(cents: number, currency: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'USD').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function truncateChargeId(chargeId: string): string {
  if (chargeId.length <= 16) return chargeId;
  return `${chargeId.slice(0, 8)}…${chargeId.slice(-4)}`;
}
