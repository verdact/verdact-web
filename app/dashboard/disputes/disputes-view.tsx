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
};

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

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
                  <DisputeRow key={d.id} dispute={d} />
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

function DisputeRow({ dispute }: { dispute: Dispute }) {
  const days = dispute.due_by ? daysUntil(dispute.due_by) : null;
  const isUrgent = days !== null && days <= 3;
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
      </div>

      <span className={s.rowAmount}>
        {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : '—'}
      </span>

      <span className={`${s.rowDeadline} ${isUrgent ? s.rowDeadlineUrgent : ''}`}>
        {days !== null ? deadlineLabel(days) : '—'}
      </span>

      <span className={s.rowAction}>{actionLabel}</span>
    </a>
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

function daysUntil(dueBy: string): number {
  const diff = new Date(dueBy).getTime() - Date.now();
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

function truncateChargeId(chargeId: string): string {
  if (chargeId.length <= 16) return chargeId;
  return `${chargeId.slice(0, 8)}…${chargeId.slice(-4)}`;
}
