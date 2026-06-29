import { AppShell } from '../../_components/app-chrome';
import { ConnectStripePanel } from '../../_components/connect-stripe-panel';
import { SectionBar } from '../../_components/ui/section-bar';
import { StatusBadge, type StatusTone } from '../../_components/ui/status-badge';
import { ReassureCard } from '../../_components/ui/reassure-card';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  InfoCircleIcon,
  ListIcon,
  ShieldIcon,
} from '../dash-icons';
import { deadlineTier, type DeadlineTier } from '../signals';
import { type Dispute } from '@/lib/dal';
import s from './disputes.module.css';

// Presentational disputes queue/index. Reuses the dashboard's row treatment and
// helpers, adds filter tabs (needs action / open / all) and a proper empty
// state. Data wrapper lives in page.tsx; a dev-only route renders this directly.
//
// Redesign 2026-06-27 (Claude, design + build lane): brought to the workbench
// gold standard. De-alarm law — status colour is driven by deadline RUNWAY, not
// status alone, so a case with days of runway never reads as alarming as one due
// in hours. Vermilion (--gap) appears only for a genuinely urgent/over deadline
// or a real merchant-closable gap; everything else routes through the calm
// --watch token. Status is ALWAYS icon + text via the shared StatusBadge.
// Money / submission / entitlement logic is untouched — every change here is
// type, token, copy, layout, status-tone reassignment, or presentation only.

export type DisputeFilter = 'needs-action' | 'open' | 'all';
export type DisputeSort = 'deadline' | 'newest' | 'amount';

// Secondary ordering within a filter bucket. URL-driven (?sort=) to match how
// the filter tabs already work — no client-component conversion needed. The
// note re-uses the SectionBar so the active sort is described in plain words.
const SORTS: ReadonlyArray<{ key: DisputeSort; label: string; note: string }> = [
  { key: 'deadline', label: 'Deadline', note: 'Nearest deadline first. Take them one at a time.' },
  { key: 'newest', label: 'Newest', note: 'Most recently opened first.' },
  { key: 'amount', label: 'Amount', note: 'Largest amount at risk first.' },
];

export type DisputesViewProps = {
  email: string | null | undefined;
  businessName: string | null;
  disputes: Dispute[];
  stripeConnected: boolean;
  filter: DisputeFilter;
  sort: DisputeSort;
  /**
   * Present proof pillars per dispute, keyed by dispute id (respondable cases).
   * Optional so the dev preview route can render without a DB read; the chip
   * then reads as an honest "add your proof" gap rather than fabricating one.
   */
  proofByDispute?: Record<string, string[]>;
};

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

// The core proof pillars an evidence record leans on. The chip grades these
// present (verdict green) vs missing (vermilion "still need"). This is evidence
// completeness, not a win prediction: strictly no odds, percentages, or
// guarantees. Reason-code-specific requirements are a later delta (C-F1).
const REQUIRED_PILLARS = ['Delivery', 'Comms', 'Policy'] as const;
type Pillar = (typeof REQUIRED_PILLARS)[number];

// Plain-English gloss for each internal pillar name (X2 / glossary parity). A
// frightened founder does not know what "Comms" is, so the gap chip speaks in
// words they can act on. Kept in sync with lib/glossary.ts in spirit.
const PILLAR_PLAIN: Record<Pillar, string> = {
  Delivery: 'proof you delivered',
  Comms: 'messages with the customer',
  Policy: 'your refund and terms',
};

const FILTERS: Array<{ key: DisputeFilter; label: string; aria: string; hint: string }> = [
  {
    key: 'needs-action',
    label: 'Needs action',
    aria: 'Needs action: disputes waiting on your response',
    hint: 'Waiting on your response',
  },
  {
    key: 'open',
    label: 'Open',
    aria: 'Open: disputes still in flight (needs response, under review, or submitted)',
    hint: 'Still in flight',
  },
  {
    key: 'all',
    label: 'All',
    aria: 'All disputes, including closed',
    hint: 'Everything, including closed',
  },
];

export function isDisputeFilter(value: string | undefined): value is DisputeFilter {
  return value === 'needs-action' || value === 'open' || value === 'all';
}

export function isDisputeSort(value: string | undefined): value is DisputeSort {
  return value === 'deadline' || value === 'newest' || value === 'amount';
}

export function DisputesView({
  email,
  businessName,
  disputes,
  stripeConnected,
  filter,
  sort,
  proofByDispute = {},
}: DisputesViewProps) {
  const counts = {
    'needs-action': disputes.filter((d) => d.status === 'needs_response').length,
    open: disputes.filter((d) => OPEN_STATUSES.has(d.status)).length,
    all: disputes.length,
  };

  const needsAction = counts['needs-action'];
  const triage = triageHeadline(needsAction);
  const visible = sortDisputesBy(filterDisputes(disputes, filter), sort);
  const activeSort = SORTS.find((o) => o.key === sort) ?? SORTS[0];

  return (
    <AppShell email={email} businessName={businessName} active="disputes">
      <div className={s.page}>
        <header className={s.header}>
          <p className={s.kicker}>Your disputes</p>
          <h1 className={s.title}>Disputes</h1>
          <p className={s.triage}>{triage.headline}</p>
          <p className={s.sub}>{triage.sub}</p>
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
                  aria-label={`${tab.aria}. ${counts[tab.key]} ${counts[tab.key] === 1 ? 'dispute' : 'disputes'}.`}
                  title={tab.hint}
                >
                  {tab.label}
                  <span className={s.tabCount}>{counts[tab.key]}</span>
                </a>
              ))}
            </nav>

            {visible.length === 0 ? (
              <EmptyState filter={filter} hasAny={disputes.length > 0} />
            ) : (
              <>
                <SectionBar
                  icon={<ListIcon />}
                  title={listSectionTitle(filter)}
                  note={activeSort.note}
                  className={s.listBar}
                />
                {disputes.length > 1 ? (
                  <nav className={s.sortRow} aria-label="Sort disputes">
                    <span className={s.sortLabel}>Sort</span>
                    {SORTS.map((opt) => (
                      <a
                        key={opt.key}
                        href={`/dashboard/disputes?filter=${filter}&sort=${opt.key}`}
                        className={`${s.sortBtn} ${sort === opt.key ? s.sortBtnActive : ''}`}
                        aria-current={sort === opt.key ? 'page' : undefined}
                      >
                        {opt.label}
                      </a>
                    ))}
                  </nav>
                ) : null}
                <div className={s.list}>
                  {visible.map((d) => (
                    <DisputeRow key={d.id} dispute={d} proof={proofByDispute[d.id] ?? []} />
                  ))}
                </div>
              </>
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
  // The readiness chip is only meaningful while a response can still be started,
  // i.e. the case is in "needs response". Once filed (under_review/submitted) or
  // closed, "still need…" would be meaningless and slightly alarming, so it is
  // hidden post-submission (DI1a).
  const showReadiness = dispute.status === 'needs_response';
  const hours = isOpen && dispute.due_by ? hoursUntil(dispute.due_by) : null;
  const tier = isOpen && dispute.due_by ? deadlineTier(daysFromHours(hours)) : 'none';
  const status = statusPresentation(dispute.status, tier);
  const action = actionPresentation(dispute.status);
  // A genuinely urgent/over deadline is the ONE place vermilion appears on a row
  // (left accent rail). A comfortable needs-response row gets a calm verdict rail
  // so "act now" and "you have time" read distinct without alarm.
  const railClass =
    tier === 'urgent'
      ? s.rowUrgent
      : dispute.status === 'needs_response'
        ? s.rowOpen
        : '';

  // One coherent plain-English name for the row link, so a screen reader hears a
  // single sentence ("Product not received, needs response, due in 4 days, $1,250,
  // build response") instead of concatenated mono badges and figures. Restates the
  // full state in words (Section 4 a11y) without changing any visible markup.
  const rowAria = rowAriaLabel(dispute, status.label, isOpen, hours, action.label);

  return (
    <a
      href={`/dashboard/disputes/${dispute.id}`}
      className={`${s.row} ${railClass}`}
      aria-label={rowAria}
    >
      <div className={s.rowStatus} aria-hidden="true">
        <StatusBadge tone={status.tone} icon={status.icon}>
          {status.label}
        </StatusBadge>
      </div>

      <div className={s.rowInfo}>
        <span className={s.rowReason}>{dispute.reason ?? 'Dispute'}</span>
        {dispute.network ? (
          <span className={s.rowNetwork} aria-hidden="true">{dispute.network}</span>
        ) : null}
        {/* The readiness chip carries its own merchant-actionable wording, so it
            stays in the a11y tree; the row label intentionally omits it to keep
            the link name short. */}
        {showReadiness && <ReadinessChip proof={proof} />}
      </div>

      <span className={s.rowAmount} aria-hidden="true">
        {dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'No amount'}
      </span>

      {isOpen && dispute.due_by ? (
        <Deadline dueBy={dispute.due_by} hours={hours} tier={tier} />
      ) : (
        <span className={s.rowSettled} aria-hidden="true">
          {closedDeadlineLabel(dispute.status)}
        </span>
      )}

      <span className={`${s.rowAction} ${action.className}`} aria-hidden="true">
        {action.label}
        {action.forward ? <ArrowRightIcon className={s.rowActionIcon} /> : null}
      </span>
    </a>
  );
}

// Live deadline cell. Days-left is rendered as a small display figure (the
// founder's "how much time do I have" at a glance), routed through a three-step
// gradient (comfortable → neutral, soon → amber warning, urgent → vermilion).
// The colour never carries meaning the text omits.
function Deadline({
  dueBy,
  hours,
  tier,
}: {
  dueBy: string;
  hours: number | null;
  tier: DeadlineTier;
}) {
  const tierClass =
    tier === 'urgent' ? s.deadlineUrgent : tier === 'soon' ? s.deadlineSoon : '';
  const figure = deadlineFigure(hours);

  // Visual figure only — the row link's aria-label already states the deadline in
  // plain words, so this is hidden from the a11y tree to avoid double-announcing.
  return (
    <span className={`${s.rowDeadline} ${tierClass}`} aria-hidden="true">
      <ClockIcon className={s.deadlineIcon} />
      <span className={s.deadlineFig}>
        <span className={s.deadlineNum}>{figure.lead}</span>
        <span className={s.deadlineCap}>{figure.caption(formatDueDate(dueBy))}</span>
      </span>
    </span>
  );
}

// Honest, hedged evidence-strength chip — renders only for needs_response cases
// (DI1a). Grades present proof pillars (verdict green) against missing required
// ones. Plain English: pillar names are glossed to words the founder can act on
// (DI1c). This is evidence completeness, not a win prediction: strictly no
// percentages, no odds, no "you'll win", no guarantee.
function ReadinessChip({ proof }: { proof: string[] }) {
  const present = new Set(proof);
  const missing = REQUIRED_PILLARS.filter((p) => !present.has(p));

  // Not started yet: nothing is missing-and-closable, the founder simply has not
  // begun. Calm --watch, not vermilion.
  if (proof.length === 0) {
    return (
      <StatusBadge tone="watch" icon={<AlertIcon />} className={s.readyChip}>
        Add your proof to start your response
      </StatusBadge>
    );
  }

  // Required proof present: forward / safe.
  if (missing.length === 0) {
    return (
      <StatusBadge tone="done" icon={<CheckIcon />} className={s.readyChip}>
        Your key proof is on file
      </StatusBadge>
    );
  }

  // A genuine, merchant-closable gap: vermilion is earned here.
  return (
    <StatusBadge tone="gap" icon={<AlertIcon />} className={s.readyChip}>
      Still need: {formatList(missing.map((p) => PILLAR_PLAIN[p]))}
    </StatusBadge>
  );
}

function EmptyState({ filter, hasAny }: { filter: DisputeFilter; hasAny: boolean }) {
  const copy = emptyCopy(filter, hasAny);
  return (
    <div role="status" className={s.emptyWrap}>
      <ReassureCard icon={copy.icon} title={copy.title} className={s.empty}>
        {copy.text}
      </ReassureCard>
    </div>
  );
}

// ── Presentation logic (pure, presentation only) ────────────────────────────

interface StatusPresentation {
  tone: StatusTone;
  icon: React.ReactNode;
  label: string;
}

// The de-alarm core: status tone is driven by deadline RUNWAY, not status alone.
// A needs_response case with comfortable runway is calm --watch; only a genuinely
// urgent/over deadline turns it vermilion. Submitted/under-review read "in
// motion, in our hands" (watch). Won is forward/safe. Closed states are inert.
function statusPresentation(status: string, tier: DeadlineTier): StatusPresentation {
  switch (status) {
    case 'needs_response':
      return tier === 'urgent'
        ? { tone: 'gap', icon: <AlertIcon />, label: 'Needs response' }
        : { tone: 'watch', icon: <ClockIcon />, label: 'Needs response' };
    case 'under_review':
      return { tone: 'watch', icon: <EyeIcon />, label: 'Under review' };
    case 'submitted':
      return { tone: 'watch', icon: <EyeIcon />, label: 'Filed' };
    case 'won':
      return { tone: 'done', icon: <CheckIcon />, label: 'Won' };
    case 'lost':
      return { tone: 'neutral', icon: <InfoCircleIcon />, label: 'Lost' };
    case 'warning_closed':
      return { tone: 'neutral', icon: <InfoCircleIcon />, label: 'Closed' };
    default:
      return { tone: 'neutral', icon: <InfoCircleIcon />, label: statusLabel(status) };
  }
}

interface ActionPresentation {
  label: string;
  className: string;
  forward: boolean;
}

// Tier the row action by state (DI5): needs_response is the one primary CTA;
// under_review is a quiet secondary; closed states are a de-emphasized "View" so
// a settled case never shouts the same as an open one. These are presentational
// <span>s — the row link itself carries the navigation (no button-in-link).
function actionPresentation(status: string): ActionPresentation {
  if (status === 'needs_response') {
    return { label: 'Build response', className: s.actionPrimary, forward: true };
  }
  if (status === 'under_review') {
    return { label: 'Review', className: s.actionSecondary, forward: false };
  }
  return { label: 'View', className: s.actionQuiet, forward: false };
}

// Compose one plain-English accessible name for the whole row link, so a screen
// reader announces a single coherent sentence instead of the concatenated mono
// badges and display figures inside (which read as noise). Restates the full
// state in words — Section 4 a11y. Presentation only; no data path changes.
function rowAriaLabel(
  dispute: Dispute,
  statusLabel: string,
  isOpen: boolean,
  hours: number | null,
  actionLabel: string,
): string {
  const reason = dispute.reason ?? 'Dispute';
  const amount =
    dispute.amount != null ? formatAmount(dispute.amount, dispute.currency) : 'amount unavailable';
  const deadline =
    isOpen && dispute.due_by
      ? deadlineAria(dispute.due_by, hours)
      : `${closedDeadlineLabel(dispute.status)}`;
  return `${reason}. ${statusLabel}. ${deadline}. ${amount}. ${actionLabel}.`;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function triageHeadline(needsAction: number): { headline: string; sub: string } {
  if (needsAction === 0) {
    return {
      headline: 'Nothing needs you right now.',
      sub: 'You are caught up. Verdact is watching your account and will surface anything new here.',
    };
  }
  if (needsAction === 1) {
    return {
      headline: 'One dispute needs your response.',
      sub: 'Everything else is being watched. Start with the one below.',
    };
  }
  return {
    headline: `${needsAction} disputes need your response.`,
    sub: 'The nearest deadline is first. Take them one at a time.',
  };
}

function listSectionTitle(filter: DisputeFilter): string {
  if (filter === 'needs-action') return 'Waiting on you';
  if (filter === 'open') return 'In flight';
  return 'All disputes';
}

function filterDisputes(disputes: Dispute[], filter: DisputeFilter): Dispute[] {
  if (filter === 'needs-action') return disputes.filter((d) => d.status === 'needs_response');
  if (filter === 'open') return disputes.filter((d) => OPEN_STATUSES.has(d.status));
  return disputes;
}

// Mirrors the DB order (lib/dal getDisputes): due_by ASC, nulls last, then
// created_at DESC as the tiebreaker so same-deadline rows keep a stable,
// intentional order rather than relying on sort stability alone.
function sortByDeadline(disputes: Dispute[]): Dispute[] {
  return [...disputes].sort((a, b) => {
    if (!a.due_by && !b.due_by) return byCreatedDesc(a, b);
    if (!a.due_by) return 1;
    if (!b.due_by) return -1;
    const byDeadline = new Date(a.due_by).getTime() - new Date(b.due_by).getTime();
    return byDeadline !== 0 ? byDeadline : byCreatedDesc(a, b);
  });
}

// Apply the chosen sort. Deadline is the default (nearest first, nulls last);
// newest is created_at descending; amount is largest-at-risk first (nulls last).
// Every branch returns a NEW array (never mutates the prop).
function sortDisputesBy(disputes: Dispute[], sort: DisputeSort): Dispute[] {
  if (sort === 'newest') {
    return [...disputes].sort(byCreatedDesc);
  }
  if (sort === 'amount') {
    return [...disputes].sort((a, b) => {
      if (a.amount == null && b.amount == null) return 0;
      if (a.amount == null) return 1;
      if (b.amount == null) return -1;
      return b.amount - a.amount;
    });
  }
  return sortByDeadline(disputes);
}

// created_at descending (newest first). Unparseable/absent timestamps sort last
// in this (and only) direction, consistent with the nulls-last comparators.
function byCreatedDesc(a: Dispute, b: Dispute): number {
  const at = Date.parse(a.created_at);
  const bt = Date.parse(b.created_at);
  const aBad = Number.isNaN(at);
  const bBad = Number.isNaN(bt);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return bt - at;
}

function emptyCopy(
  filter: DisputeFilter,
  hasAny: boolean,
): { title: string; text: string; icon: React.ReactNode } {
  if (filter === 'needs-action') {
    return {
      title: 'Nothing needs you right now.',
      text: 'No dispute is waiting on a response. Verdact will surface a new one here the moment it arrives, with its deadline.',
      icon: <CheckIcon />,
    };
  }
  if (filter === 'open') {
    return {
      title: 'No open disputes.',
      text: 'Nothing is in flight. Verdact keeps watching and will list new disputes as they open.',
      icon: <EyeIcon />,
    };
  }
  if (hasAny) {
    return {
      title: 'No disputes match this view.',
      text: 'Try another filter above.',
      icon: <InfoCircleIcon />,
    };
  }
  return {
    title: "You're set up. No disputes yet.",
    text: 'Verdact is watching your account. New disputes and early fraud warnings will appear here. One dispute will not suspend your Stripe account, so there is nothing to fear.',
    icon: <ShieldIcon />,
  };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    needs_response: 'Needs response',
    under_review: 'Under review',
    submitted: 'Filed',
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

// Whole days left, for the shared deadlineTier() thresholds. Rounds toward the
// nearer day so a deadline 47 hours out reads as "2 days" pressure, not 1.
function daysFromHours(hours: number | null): number | null {
  if (hours === null) return null;
  return Math.ceil(hours / 24);
}

// The display figure for the deadline cell: a big lead (days/hours number or a
// short word) plus a muted caption with the date. Honest sub-day language is
// preserved; it is just routed through the gradient colour at the call site.
function deadlineFigure(hours: number | null): {
  lead: string;
  caption: (by: string) => string;
} {
  if (hours === null) {
    return { lead: 'None', caption: (by) => `Respond by ${by}` };
  }
  if (hours < 0) {
    return { lead: 'Past', caption: (by) => `Respond by ${by}, deadline passed` };
  }
  if (hours < 1) {
    return { lead: '<1h', caption: (by) => `Respond by ${by}, under an hour left` };
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    return { lead: `${h}h`, caption: (by) => `Respond by ${by}, ${h} hour${h === 1 ? '' : 's'} left` };
  }
  const days = Math.floor(hours / 24);
  return { lead: `${days}d`, caption: (by) => `Respond by ${by}, ${days} day${days === 1 ? '' : 's'} left` };
}

// "Respond by Jun 24, 4 days left" — the full plain sentence for the aria-label.
function deadlineLabel(dueBy: string, hours: number | null): string {
  return deadlineFigure(hours).caption(formatDueDate(dueBy));
}

function deadlineAria(dueBy: string, hours: number | null): string {
  return `Response deadline: ${deadlineLabel(dueBy, hours)}`;
}

// What the deadline cell shows once a case is settled (no live countdown). Quiet
// mono tags so a settled row never competes with a live deadline (DI3).
function closedDeadlineLabel(status: string): string {
  if (status === 'submitted') return 'Filed';
  if (status === 'won') return 'Won';
  if (status === 'lost' || status === 'warning_closed') return 'Closed';
  return 'No deadline';
}

function formatDueDate(dueBy: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dueBy));
}

// "proof you delivered and your refund and terms" — Oxford-free join for the
// gap chip copy.
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
