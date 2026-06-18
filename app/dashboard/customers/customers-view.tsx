import { AppShell } from '../../_components/app-chrome';
import { ConnectStripePanel } from '../../_components/connect-stripe-panel';
import type { CustomerGroup } from '@/lib/dal';
import type { MergeSuggestion } from '@/lib/customers/types';
import { AutoSplitForm, ConfirmMergeForm, RejectMergeForm } from './merge-forms';
import s from './customers.module.css';

// Presentational per-customer evidence view (R8). Groups a merchant's disputes
// by customer email so repeat / daisy-chained disputes from the same customer
// surface together, and surfaces "possible same customer" suggestions to confirm
// (never auto-merged). Data wrapper lives in page.tsx; a dev-only route renders
// this directly.

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
          <h1 className={s.title}>Customers</h1>
          <p className={s.sub}>
            Your disputes grouped by the customer they came from. When the same customer disputes again,
            reuse one record instead of rebuilding it.
          </p>
        </header>

        {!stripeConnected ? (
          <ConnectStripePanel context="disputes" />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {autoMerged.length > 0 && <AutoLinked autoMerged={autoMerged} />}
            {suggestions.length > 0 && <MergeSuggestions suggestions={suggestions} />}

            {repeatGroups.length > 0 && (
              <p className={s.repeatBanner}>
                <strong>{repeatGroups.length}</strong> customer{repeatGroups.length === 1 ? ' has' : 's have'}{' '}
                disputed more than once. Those are first below.
              </p>
            )}

            <div className={s.list}>
              {linked.map((group) => (
                <CustomerCard key={group.customerKey} group={group} />
              ))}
            </div>

            {unlinked && unlinked.disputes.length > 0 && (
              <section className={s.unlinkedSection}>
                <h2 className={s.unlinkedHead}>Not yet linked to a customer</h2>
                <p className={s.unlinkedSub}>
                  These disputes do not carry a customer email yet, so we cannot group them. Email-based
                  linkage covers subscription and repeat clients; one-off and guest charges may land here.
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

function AutoLinked({ autoMerged }: { autoMerged: MergeSuggestion[] }) {
  return (
    <section className={s.autoSection}>
      <h2 className={s.autoHead}>Auto-linked</h2>
      <p className={s.autoSub}>
        Verdact was confident these are the same customer and linked them for you. If any is wrong,
        split it — Verdact learns from the correction.
      </p>
      <div className={s.autoList}>
        {autoMerged.map((sg) => (
          <div key={sg.id} className={s.autoRow}>
            <span className={s.autoPair}>
              {sg.primaryLabel} <span aria-hidden="true">↔</span> {sg.linkedLabel}
            </span>
            <span className={s.autoReason}>{sg.reason}</span>
            <AutoSplitForm suggestion={sg} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MergeSuggestions({ suggestions }: { suggestions: MergeSuggestion[] }) {
  return (
    <section className={s.suggestSection}>
      <h2 className={s.suggestHead}>Possible same customer</h2>
      <p className={s.suggestSub}>
        Verdact spotted disputes that may belong to the same customer. Nothing is merged until you
        confirm — your choice is remembered.
      </p>
      <div className={s.suggestList}>
        {suggestions.map((sg) => (
          <div key={sg.id} className={s.suggestCard}>
            <div className={s.suggestPair}>
              <span className={s.suggestId}>{sg.primaryLabel}</span>
              <span className={s.suggestArrow} aria-hidden="true">
                ↔
              </span>
              <span className={s.suggestId}>{sg.linkedLabel}</span>
              <span className={s.suggestConfidence}>{confidenceLabel(sg.confidence)} confidence</span>
            </div>
            <p className={s.suggestReason}>{sg.reason}</p>
            <div className={s.suggestActions}>
              <ConfirmMergeForm suggestion={sg} />
              <RejectMergeForm suggestion={sg} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.4) return 'Medium';
  return 'Low';
}

function CustomerCard({ group }: { group: CustomerGroup }) {
  const isRepeat = group.disputes.length > 1;
  const title = group.customerName || group.customerEmail || 'Unlinked disputes';

  return (
    <section className={`${s.card} ${isRepeat ? s.cardRepeat : ''}`}>
      <header className={s.cardHead}>
        <div className={s.cardIdent}>
          <span className={s.cardName}>{title}</span>
          {group.customerEmail && group.customerName && (
            <span className={s.cardEmail}>{group.customerEmail}</span>
          )}
        </div>
        <div className={s.cardMeta}>
          {isRepeat && <span className={s.repeatPill}>{group.disputes.length} disputes</span>}
          <span className={s.cardAmount}>{formatAmount(group.totalAmount, currencyOf(group))}</span>
        </div>
      </header>

      <div className={s.cardStats}>
        <Stat label="Open" value={group.openCount} tone={group.openCount > 0 ? 'warn' : 'neutral'} />
        <Stat label="Won" value={group.wonCount} tone="ok" />
        <Stat label="Lost" value={group.lostCount} tone={group.lostCount > 0 ? 'gap' : 'neutral'} />
      </div>

      <ul className={s.disputeList}>
        {group.disputes.map((d) => (
          <li key={d.id}>
            <a href={`/dashboard/disputes/${d.id}`} className={s.disputeRow}>
              <span className={`${s.statusDot} ${dotClass(d.status, d.outcome)}`} aria-hidden="true" />
              <span className={s.disputeReason}>{d.reason ?? 'Dispute'}</span>
              <span className={s.disputeDate}>{formatDate(d.created_at)}</span>
              <span className={s.disputeAmount}>
                {d.amount != null ? formatAmount(d.amount, d.currency) : '—'}
              </span>
              <span className={s.disputeStatus}>{statusLabel(d.status, d.outcome)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'gap' | 'neutral' }) {
  return (
    <div className={s.stat}>
      <span className={`${s.statValue} ${s[`tone_${tone}`]}`}>{value}</span>
      <span className={s.statLabel}>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={s.empty}>
      <p className={s.emptyTitle}>No customers with disputes yet.</p>
      <p className={s.emptyText}>
        When a dispute arrives, Verdact will group it here by the customer it came from, so repeat
        disputes from the same customer share one evidence record.
      </p>
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function currencyOf(group: CustomerGroup): string | null {
  return group.disputes.find((d) => d.currency)?.currency ?? null;
}

function dotClass(status: string, outcome: string | null): string {
  if (status === 'needs_response') return s.statusDotAtRisk;
  if (outcome === 'won' || status === 'won') return s.statusDotHealthy;
  if (outcome === 'lost' || status === 'lost') return s.statusDotGap;
  return s.statusDotNeutral;
}

function statusLabel(status: string, outcome: string | null): string {
  if (outcome === 'won') return 'Won';
  if (outcome === 'lost') return 'Lost';
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
