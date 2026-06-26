import { AppShell } from '../../_components/app-chrome';
import { ConnectStripePanel } from '../../_components/connect-stripe-panel';
import type { CustomerGroup } from '@/lib/dal';
import type { MergeSuggestion } from '@/lib/customers/types';
import { AutoSplitForm, ConfirmMergeForm, RejectMergeForm } from './merge-forms';
import s from './customers.module.css';

// Presentational per-customer evidence view (R8). Groups a merchant's disputes
// by customer email so repeat / daisy-chained disputes from the same customer
// surface together, surfaces "needs your call" prompts for doubtful pairs
// (never auto-merged), and shows confident auto-links transparently with a
// one-click undo. Data wrapper lives in page.tsx; a dev-only route renders this
// directly. Restyled to the 2026-06 redesign comp; all merge/split wiring kept.

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
        </header>
        <p className={s.lead}>
          Disputes from the same customer, grouped so you can see repeat patterns. When the same
          customer disputes again, reuse one record instead of rebuilding it. Verdact never merges on
          a guess.
        </p>

        {!stripeConnected ? (
          <ConnectStripePanel context="disputes" />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {suggestions.length > 0 && <MergeSuggestions suggestions={suggestions} />}
            {autoMerged.length > 0 && <AutoLinked autoMerged={autoMerged} />}

            {repeatGroups.length > 0 && (
              <p className={s.repeatBanner}>
                <strong>{repeatGroups.length}</strong> customer{repeatGroups.length === 1 ? ' has' : 's have'}{' '}
                disputed more than once. Those are first below.
              </p>
            )}

            <section aria-label="Customers">
              <div className={s.list}>
                {linked.map((group) => (
                  <CustomerCard key={group.customerKey} group={group} />
                ))}
              </div>
              <p className={s.guidanceFoot}>
                Grouping is for your view only. Each dispute is still filed on its own. Nothing is
                filed without you, and we never take a cut.
              </p>
            </section>

            {unlinked && unlinked.disputes.length > 0 && (
              <section className={s.unlinkedSection}>
                <h2 className={s.unlinkedHead}>Not yet linked to a customer</h2>
                <p className={s.unlinkedSub}>
                  These disputes do not carry a customer email yet, so we cannot group them. Email-based
                  linkage covers subscription and repeat clients. One-off and guest charges may land here.
                </p>
                <div className={s.list}>
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
// holds the two candidate identities and the confirm / keep-separate actions.
function MergeSuggestions({ suggestions }: { suggestions: MergeSuggestion[] }) {
  return (
    <section aria-labelledby="needs-call-h">
      <div className={s.sectionLabel}>
        <h2 className={s.sectionHead} id="needs-call-h">
          Needs your call
        </h2>
      </div>
      {suggestions.map((sg) => (
        <div key={sg.id} className={s.suggestCard}>
          <div className={s.suggestCardHead}>
            <div>
              <h3 className={s.suggestTitle}>Are these the same customer?</h3>
              <p className={s.suggestReason}>{sg.reason}</p>
            </div>
            <span className={s.gapPill}>
              <span className={s.gapPillDot} aria-hidden="true" />
              Your call
            </span>
          </div>

          <div className={s.mergeRows}>
            <MergeCandidate label={sg.primaryLabel} pairIndex="A" />
            <MergeCandidate label={sg.linkedLabel} pairIndex="B" />
          </div>

          <p className={s.suggestReason}>
            Linking groups their disputes together for your view. It never changes or files anything,
            and you can undo it.
          </p>

          <div className={s.suggestActions}>
            <ConfirmMergeForm suggestion={sg} />
            <RejectMergeForm suggestion={sg} />
          </div>
        </div>
      ))}
    </section>
  );
}

// One candidate identity row inside a "needs your call" card. Label is a name
// and/or email string from the suggestion; we split it for display only.
function MergeCandidate({ label, pairIndex }: { label: string; pairIndex: string }) {
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
      </span>
    </div>
  );
}

// Confident auto-links, shown transparently with a one-click "Not the same" undo
// that Verdact learns from. Always reversible — neutral framing, never alarming.
function AutoLinked({ autoMerged }: { autoMerged: MergeSuggestion[] }) {
  return (
    <section aria-labelledby="auto-h">
      <div className={s.sectionLabel}>
        <h2 className={s.sectionHead} id="auto-h">
          Auto-linked
        </h2>
        <span className={s.sectionCaption}>Matched on exact email. Always reversible.</span>
      </div>
      <div className={s.list}>
        {autoMerged.map((sg) => (
          <div key={sg.id} className={s.card}>
            <div className={s.custHead}>
              <div className={s.cardIdent}>
                <span className={s.cardName}>{sg.primaryLabel}</span>
                <span className={s.cardEmail}>{sg.linkedLabel}</span>
              </div>
              <div className={s.cardMeta}>
                <span className={s.tag}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                  Auto-linked
                </span>
                <AutoSplitForm suggestion={sg} />
              </div>
            </div>
            <p className={s.cardTotal}>{sg.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomerCard({ group }: { group: CustomerGroup }) {
  const isRepeat = group.disputes.length > 1;
  const title = group.customerName || group.customerEmail || 'Unlinked disputes';
  const currency = currencyOf(group);

  return (
    <article className={`${s.card} ${isRepeat ? s.cardRepeat : ''}`} aria-label={title}>
      <header className={s.custHead}>
        <div className={s.cardIdent}>
          <span className={s.cardName}>{title}</span>
          {group.customerEmail && group.customerName && (
            <span className={s.cardEmail}>{group.customerEmail}</span>
          )}
        </div>
        <div className={s.cardMeta}>
          {isRepeat && (
            <span className={s.repeatPill}>
              {group.disputes.length} disputes
            </span>
          )}
        </div>
      </header>

      <p className={s.cardTotal}>
        {group.disputes.length} dispute{group.disputes.length === 1 ? '' : 's'}
        {' · '}
        {formatAmount(group.totalAmount, currency)} total
      </p>

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
                <span className={`${s.statusLabel} ${toneLabelClass(tone)}`}>
                  <span className={`${s.statusDot} ${toneDotClass(tone)}`} aria-hidden="true" />
                  {statusLabel(d.status, d.outcome)}
                </span>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
          <path d="M16 6a3 3 0 010 6" />
        </svg>
      </span>
      <p className={s.emptyTitle}>No customers with disputes yet.</p>
      <p className={s.emptyText}>
        When a dispute arrives, Verdact will group it here by the customer it came from, so repeat
        disputes from the same customer share one evidence record.
      </p>
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

type StatusTone = 'gap' | 'won' | 'neutral';

function currencyOf(group: CustomerGroup): string | null {
  return group.disputes.find((d) => d.currency)?.currency ?? null;
}

// Tone for a dispute row's status. needs_response is a merchant-closable gap
// (vermilion); won is verdict green; everything else (incl. lost) is neutral.
function statusTone(status: string, outcome: string | null): StatusTone {
  if (status === 'needs_response') return 'gap';
  if (outcome === 'won' || status === 'won') return 'won';
  return 'neutral';
}

function toneDotClass(tone: StatusTone): string {
  if (tone === 'gap') return s.statusDotGap;
  if (tone === 'won') return s.statusDotHealthy;
  return s.statusDotNeutral;
}

function toneLabelClass(tone: StatusTone): string {
  if (tone === 'gap') return s.statusLabelGap;
  if (tone === 'won') return s.statusLabelWon;
  return '';
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
