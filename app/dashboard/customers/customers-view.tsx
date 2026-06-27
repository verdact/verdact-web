import { AppShell } from '../../_components/app-chrome';
import { ConnectStripePanel } from '../../_components/connect-stripe-panel';
import { SectionBar } from '../../_components/ui/section-bar';
import { StatusBadge } from '../../_components/ui/status-badge';
import { ReassureCard } from '../../_components/ui/reassure-card';
import {
  CheckIcon,
  ClockIcon,
  EyeIcon,
  InfoCircleIcon,
  ListIcon,
  RouteIcon,
  ShieldIcon,
  UserCheckIcon,
} from '../dash-icons';
import type { CustomerGroup } from '@/lib/dal';
import type { MergeSuggestion } from '@/lib/customers/types';
import { AutoSplitForm, ConfirmMergeForm, RejectMergeForm } from './merge-forms';
import s from './customers.module.css';

// Presentational per-customer evidence view (R8). Groups a merchant's disputes
// by customer email so repeat / daisy-chained disputes from the same customer
// surface together, surfaces "needs your call" prompts for doubtful pairs
// (never auto-merged), and shows confident auto-links transparently with a
// one-click undo. Data wrapper lives in page.tsx; a dev-only route renders this
// directly. Restyled to the 2026-06 workbench gold standard; all merge/split
// wiring kept (server actions, MergeSuggestion shape, customer_identity_links
// write semantics untouched). The only added reads are presentational: a
// candidate's dispute count + latest reason, resolved from the groups the page
// already loads (no new query, no write path).

export type CustomersViewProps = {
  email: string | null | undefined;
  businessName: string | null;
  groups: CustomerGroup[];
  // Doubtful pairs the merchant is asked to confirm.
  suggestions: MergeSuggestion[];
  // High-confidence pairs Verdact already merged automatically (shown with undo).
  autoMerged: MergeSuggestion[];
  stripeConnected: boolean;
};

export function CustomersView({
  email,
  businessName,
  groups,
  suggestions,
  autoMerged,
  stripeConnected,
}: CustomersViewProps) {
  const linked = groups.filter((g) => g.customerKey !== null);
  const unlinked = groups.find((g) => g.customerKey === null) ?? null;
  const repeatGroups = linked.filter((g) => g.disputes.length > 1);

  return (
    <AppShell email={email} businessName={businessName} active="customers">
      <div className={s.page}>
        <header className={s.header}>
          <p className={s.eyebrow}>Grouped by customer</p>
          <h1 className={s.title}>Customers</h1>
          <p className={s.lead}>
            <b>Same customer, same record.</b> When the same customer disputes again, you reuse one
            evidence record instead of rebuilding it. Grouping is for your view only.{' '}
            <b>Verdact never links two customers on a guess, and you can undo any link.</b>
          </p>
        </header>

        {!stripeConnected ? (
          <ConnectStripePanel context="disputes" />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {suggestions.length > 0 && (
              <MergeSuggestions suggestions={suggestions} groups={groups} />
            )}
            {autoMerged.length > 0 && <AutoLinked autoMerged={autoMerged} />}

            <section aria-labelledby="your-customers-h">
              <SectionBar
                icon={<ListIcon />}
                title="Your customers"
                note="Everyone with a dispute on file, repeat customers first."
                className={s.sectionBar}
              />
              <h2 id="your-customers-h" className="sr-only">
                Your customers
              </h2>

              {repeatGroups.length > 0 && (
                <p className={s.repeatBanner}>
                  <span className={s.repeatCount}>{repeatGroups.length}</span>
                  <span className={s.repeatText}>
                    <InfoCircleIcon />
                    {repeatGroups.length === 1 ? 'customer has' : 'customers have'} disputed more
                    than once. They are sorted to the top so the repeat patterns are easy to see.
                  </span>
                </p>
              )}

              <div className={s.list}>
                {linked.map((group) => (
                  <CustomerCard key={group.customerKey} group={group} />
                ))}
              </div>
              <p className={s.guidanceFoot}>
                Each dispute is still filed on its own. Grouping changes nothing about how a case is
                handled, and Verdact never takes a cut.
              </p>
            </section>

            {unlinked && unlinked.disputes.length > 0 && (
              <section className={s.unlinkedSection} aria-labelledby="not-linked-h">
                <SectionBar
                  icon={<RouteIcon />}
                  title="Not yet linked"
                  note="These disputes did not come with a customer email, so we could not group them. That is normal for one-off or guest checkouts."
                  className={s.sectionBar}
                />
                <h2 id="not-linked-h" className="sr-only">
                  Not yet linked
                </h2>
                <div className={s.unlinkedList}>
                  <CustomerCard group={unlinked} />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

// "Needs your call" — doubtful pairs surfaced as suggest-and-confirm. Each card
// holds the two candidate identities (with their dispute context), the
// reassurance band, and the confirm / keep-separate actions. `groups` is read
// only to resolve a candidate key to its dispute summary (presentational).
function MergeSuggestions({
  suggestions,
  groups,
}: {
  suggestions: MergeSuggestion[];
  groups: CustomerGroup[];
}) {
  const groupByKey = new Map(groups.map((g) => [g.customerKey, g] as const));

  return (
    <section aria-labelledby="needs-call-h">
      <SectionBar
        icon={<UserCheckIcon />}
        title="Needs your call"
        note="We are not sure these are the same customer. Your call, and it is reversible."
        className={s.sectionBar}
      />
      <h2 id="needs-call-h" className="sr-only">
        Needs your call
      </h2>

      {suggestions.map((sg) => (
        <div key={sg.id} className={s.suggestCard}>
          <div className={s.suggestCardHead}>
            <h3 className={s.suggestTitle}>Are these the same customer?</h3>
            <StatusBadge tone="watch" icon={<EyeIcon />}>
              Your call
            </StatusBadge>
          </div>

          <ReassureCard
            icon={<ShieldIcon />}
            title="Linking only groups their disputes together in your view."
            className={s.assureBand}
          >
            It never edits, combines, or files anything, and one click undoes it.
          </ReassureCard>

          <div className={s.mergeRows}>
            <MergeCandidate
              label={sg.primaryLabel}
              pairIndex="A"
              summary={candidateSummary(sg.primaryKey, groupByKey)}
            />
            <MergeCandidate
              label={sg.linkedLabel}
              pairIndex="B"
              summary={candidateSummary(sg.linkedKey, groupByKey)}
            />
          </div>

          <p className={s.mergeConnect}>
            <RouteIcon />
            {sg.reason}
          </p>

          <div className={s.suggestActions}>
            <ConfirmMergeForm suggestion={sg} />
            <RejectMergeForm suggestion={sg} />
            <span className={s.actionsNote}>You can change this anytime.</span>
          </div>
        </div>
      ))}
    </section>
  );
}

// One candidate identity row inside a "needs your call" card. Label is a name
// and/or email string from the suggestion; we split it for display only. The
// summary line gives the founder the dispute context to decide (C2).
function MergeCandidate({
  label,
  pairIndex,
  summary,
}: {
  label: string;
  pairIndex: string;
  summary: string;
}) {
  const { name, sub } = splitLabel(label);
  return (
    <div className={s.mergeRow}>
      <span className={s.mergeAvatar} aria-hidden="true">
        {initials(name)}
        <span className={s.mergePairIx}>{pairIndex}</span>
      </span>
      <span className={s.mergeWho}>
        <span className={s.mergeName}>{name}</span>
        {sub && <span className={s.mergeEmail}>{sub}</span>}
        <span className={s.mergeEvidence}>{summary}</span>
      </span>
    </div>
  );
}

// Confident auto-links, shown transparently with a one-click undo that Verdact
// learns from. Always reversible — calm "done" framing, never alarming.
function AutoLinked({ autoMerged }: { autoMerged: MergeSuggestion[] }) {
  return (
    <section aria-labelledby="auto-h">
      <SectionBar
        icon={<CheckIcon />}
        title="Already linked for you"
        note="Same email, so we grouped these automatically. Nothing was filed. Undo any that look wrong."
        className={s.sectionBar}
      />
      <h2 id="auto-h" className="sr-only">
        Already linked for you
      </h2>

      <div className={s.list}>
        {autoMerged.map((sg) => (
          <div key={sg.id} className={s.autoCard}>
            <div className={s.custHead}>
              <div className={s.cardIdent}>
                <span className={s.cardName}>{sg.primaryLabel}</span>
                <span className={s.cardEmail}>{sg.linkedLabel}</span>
              </div>
              <div className={s.cardMeta}>
                <StatusBadge tone="done" icon={<CheckIcon />}>
                  Auto-linked
                </StatusBadge>
              </div>
            </div>
            <p className={s.autoReason}>{sg.reason}</p>
            <div className={s.undoRow}>
              <span className={s.undoLead}>Not the same person?</span>
              <AutoSplitForm suggestion={sg} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomerCard({ group }: { group: CustomerGroup }) {
  const isRepeat = group.disputes.length > 1;
  const count = group.disputes.length;
  const title = group.customerName || group.customerEmail || 'Unlinked disputes';
  const currency = currencyOf(group);

  return (
    <article className={`${s.card} ${isRepeat ? s.cardRepeat : ''}`} aria-label={title}>
      <header className={s.custHead}>
        <div className={s.cardIdent}>
          {isRepeat && (
            <span className={s.repeatEyebrow}>
              <UserCheckIcon />
              Repeat customer
            </span>
          )}
          <span className={s.cardName}>{title}</span>
          {group.customerEmail && group.customerName && (
            <span className={s.cardEmail}>{group.customerEmail}</span>
          )}
        </div>
        <div className={s.cardFigures}>
          <span className={s.figCount}>{count}</span>
          <span className={s.figCountUnit}>{count === 1 ? 'dispute' : 'disputes'}</span>
          <span className={s.figTotal}>{formatAmount(group.totalAmount, currency)} total</span>
        </div>
      </header>

      <ul className={s.disputeList}>
        {group.disputes.map((d) => {
          const tone = statusTone(d.status, d.outcome);
          return (
            <li key={d.id}>
              <a href={`/dashboard/disputes/${d.id}`} className={s.disputeRow}>
                <span className={s.disputeWhy}>
                  <span className={s.disputeReason}>{d.reason ?? 'Dispute'}</span>
                  <span className={s.disputeMeta}>Opened {formatDate(d.created_at)}</span>
                </span>
                <span className={s.disputeAmount}>
                  {d.amount != null ? formatAmount(d.amount, d.currency) : 'No amount'}
                </span>
                <StatusBadge
                  tone={badgeTone(tone)}
                  icon={statusIcon(tone)}
                  className={s.statusBadgeRow}
                >
                  {statusLabel(d.status, d.outcome)}
                </StatusBadge>
              </a>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function EmptyState() {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon} aria-hidden="true">
        <UserCheckIcon />
      </span>
      <p className={s.emptyEyebrow}>Nothing to group yet</p>
      <p className={s.emptyTitle}>No repeat customers so far.</p>
      <p className={s.emptyText}>
        When a customer disputes more than once, Verdact groups their cases here so you reuse one
        evidence record instead of starting over. A quiet page here is a good sign.
      </p>
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

type StatusTone = 'gap' | 'won' | 'neutral';

function currencyOf(group: CustomerGroup): string | null {
  return group.disputes.find((d) => d.currency)?.currency ?? null;
}

// Resolve a candidate identity key to a short, sr-readable dispute summary (C2).
// Reads only data the page already loaded (the groups). Falls back gracefully
// when the candidate is not yet a grouped customer.
function candidateSummary(
  key: string,
  groupByKey: Map<string | null, CustomerGroup>,
): string {
  const group = groupByKey.get(key);
  if (!group || group.disputes.length === 0) {
    return 'No disputes on file yet';
  }
  const count = group.disputes.length;
  const latest = group.disputes.reduce((a, b) =>
    new Date(b.created_at).getTime() > new Date(a.created_at).getTime() ? b : a,
  );
  const reason = (latest.reason ?? '').trim();
  if (count === 1) {
    return reason ? `1 dispute · ${reason}` : `1 dispute · opened ${formatDate(latest.created_at)}`;
  }
  return reason
    ? `${count} disputes · latest: ${reason}`
    : `${count} disputes · latest opened ${formatDate(latest.created_at)}`;
}

// Tone for a dispute row's status (de-alarm law, X1). On this grouped overview
// we have no per-row deadline data, so needs_response stays neutral --watch
// rather than vermilion to avoid a false alarm; won is verdict green;
// everything else (incl. lost) is neutral.
function statusTone(status: string, outcome: string | null): StatusTone {
  if (status === 'needs_response') return 'gap';
  if (outcome === 'won' || status === 'won') return 'won';
  return 'neutral';
}

// Map the local tone to the StatusBadge tone vocabulary. needs_response is a
// real merchant-closable action, but on this overview (no deadline data) we keep
// it calm as "watch"; "won" is "done"; everything else neutral.
function badgeTone(tone: StatusTone): 'done' | 'watch' | 'neutral' {
  if (tone === 'gap') return 'watch';
  if (tone === 'won') return 'done';
  return 'neutral';
}

function statusIcon(tone: StatusTone) {
  if (tone === 'won') return <CheckIcon />;
  if (tone === 'gap') return <EyeIcon />;
  return <ClockIcon />;
}

function statusLabel(status: string, outcome: string | null): string {
  if (outcome === 'won') return 'Won';
  if (outcome === 'lost') return 'Lost';
  const map: Record<string, string> = {
    needs_response: 'Needs response',
    under_review: 'Under review',
    submitted: 'Filed, waiting',
    won: 'Won',
    lost: 'Lost',
    warning_closed: 'Closed',
  };
  return map[status] ?? status;
}

// Split a suggestion label ("Jordan Okafor <jordan@atlas.studio>" or "name · email"
// or a bare email) into a display name and an optional sub-line. Display only.
function splitLabel(label: string): { name: string; sub: string | null } {
  const angle = label.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angle) return { name: angle[1].trim() || angle[2].trim(), sub: angle[2].trim() };
  const dot = label.split('·').map((p) => p.trim());
  if (dot.length === 2) return { name: dot[0], sub: dot[1] };
  return { name: label.trim(), sub: null };
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAmount(cents: number, currency: string | null): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'USD').toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}
