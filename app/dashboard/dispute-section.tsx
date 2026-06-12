import type { Dispute, EfwAlert, VampSnapshot } from '@/lib/dal';
import Link from 'next/link';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  InfoCircleIcon,
  ShieldIcon,
} from './dash-icons';

type DisputeSectionProps = {
  disputes: Dispute[];
  efwAlerts: EfwAlert[];
  vampSnapshot: VampSnapshot | null;
};

const OPEN_STATUSES = new Set(['needs_response', 'under_review', 'submitted']);

export function DisputeSection({ disputes, efwAlerts, vampSnapshot }: DisputeSectionProps) {
  const openDisputes = disputes.filter((d) => OPEN_STATUSES.has(d.status));
  const openExposureByCurrency = sumExposure(openDisputes);
  const hasData = disputes.length > 0;

  return (
    <div className="reveal reveal-3 mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Disputes</p>
          <h2 className="font-display mt-3 text-[1.9rem] leading-tight tracking-tight text-ink">
            Evidence records
          </h2>
          <p className="section-dek mt-2 max-w-xl text-[0.95rem]">
            Source-linked cases. Nothing is filed until you approve it.
          </p>
        </div>
        {hasData && (
          <span className="pill-neutral">
            {disputes.length} {disputes.length === 1 ? 'record' : 'records'}
          </span>
        )}
      </div>

      {/* VAMP exposure tiles — render only when there is something to show. */}
      {(hasData || vampSnapshot) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ExposureTile label="Open disputes" value={String(openDisputes.length)} />
          <ExposureTile label="Open exposure" value={formatExposure(openExposureByCurrency)} accent />
          {vampSnapshot ? (
            <ExposureTile
              label="VAMP ratio (est.)"
              value={formatVampRatio(vampSnapshot.estimated_vamp_ratio)}
              note={vampNote(vampSnapshot)}
            />
          ) : (
            <ExposureTile
              label="VAMP ratio (est.)"
              value="Not yet calculated"
              note="Visa VAMP exposure appears once enough settled activity is observed."
              muted
            />
          )}
        </div>
      )}

      <div className="surface-card mt-6 overflow-hidden">
        {hasData ? (
          <>
            <header className="flex items-center justify-between gap-4 border-b border-rule bg-surface-3/60 px-6 py-3.5">
              <p className="label-mono">Records</p>
              <span className="meta-mono text-ink-faint">Source-linked</span>
            </header>
            <ul>
              {disputes.map((dispute) => (
                <DisputeRow key={dispute.id} dispute={dispute} />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {efwAlerts.length > 0 && (
        <div className="surface-card-flat mt-6 overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-rule-strong bg-surface-3/60 px-6 py-4">
            <div>
              <p className="eyebrow">Early fraud warnings</p>
              <p className="font-display mt-1.5 text-lg text-ink">
                {efwAlerts.length} {efwAlerts.length === 1 ? 'alert' : 'alerts'}
              </p>
            </div>
            <span className="pill-warning">
              <AlertIcon className="h-3 w-3" />
              Review
            </span>
          </header>
          <ul>
            {efwAlerts.map((alert) => (
              <EfwRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DisputeRow({ dispute }: { dispute: Dispute }) {
  // CE 3.0 applies only to Visa 10.4 fraud, never 13.1 services. Trust the
  // stored flag and only surface it when the dispute is genuinely eligible.
  const showCe3 = dispute.ce3_eligible === true;
  const dueLabel = dispute.due_by ? formatDate(dispute.due_by) : null;
  const isOpen = OPEN_STATUSES.has(dispute.status);
  const isOverdue =
    dispute.due_by != null && isOpen && new Date(dispute.due_by).getTime() < Date.now();

  // The spine dot mirrors the workbench: an open/pressing case reads as a
  // gap (miss), a resolved one as confirmed (ok). Status is always paired
  // with a text badge below, so the dot never carries meaning alone.
  const needsAttention = dispute.status === 'needs_response' || isOverdue;

  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-4 border-b border-rule px-6 py-5 last:border-b-0 md:grid-cols-[1.75rem_1fr_auto] md:items-center">
      <span
        className={`status-dot mt-0.5 h-7 w-7 ${needsAttention ? 'miss' : 'ok'}`}
        aria-hidden="true"
      >
        {needsAttention ? (
          <InfoCircleIcon className="h-3.5 w-3.5" />
        ) : (
          <CheckIcon className="h-3.5 w-3.5" />
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="label-mono-strong">{dispute.reason || 'Reason pending'}</span>
          {dispute.network && (
            <span className="chip-rc capitalize">{dispute.network}</span>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <DisputeStatusBadge status={dispute.status} />
          {showCe3 && (
            <span className="pill-trust" title="Visa Compelling Evidence 3.0 eligible">
              <CheckIcon className="h-3 w-3" />
              CE 3.0 eligible
            </span>
          )}
          {dispute.processor_charge_id && (
            <span className="src-tag stripe">{dispute.processor_charge_id}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-1.5 pl-[2.25rem] md:items-end md:pl-0">
        <span className="font-display text-xl leading-none text-ink">
          {formatAmount(dispute.amount, dispute.currency)}
        </span>
        {dueLabel ? (
          <span
            className={`meta-mono inline-flex items-center gap-1.5 ${
              isOverdue ? 'text-accent' : 'text-ink-mute'
            }`}
          >
            <ClockIcon className="h-3 w-3" />
            {isOverdue ? 'Past due' : 'Due'} {dueLabel}
          </span>
        ) : (
          <span className="meta-mono text-ink-faint">No deadline</span>
        )}
        <Link
          className="label-mono mt-2 rounded-sm px-1 py-0.5 text-action underline underline-offset-4 transition-colors hover:text-action-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
          href={`/dashboard/disputes/${dispute.id}`}
        >
          Open record
        </Link>
      </div>
    </li>
  );
}

function EfwRow({ alert }: { alert: EfwAlert }) {
  return (
    <li className="grid gap-3 border-b border-rule px-6 py-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="src-tag stripe">STRIPE</span>
          <span className="label-mono-strong">{alert.fraud_type || 'Fraud warning'}</span>
        </div>
        {alert.processor_charge_id && (
          <span className="meta-mono mt-1.5 block break-all text-ink-faint">
            {alert.processor_charge_id}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {alert.actionable === false && <span className="pill-neutral">Not actionable</span>}
        <EfwDecisionBadge decision={alert.merchant_decision} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="record-field flex flex-col items-center px-6 py-16 text-center">
      <span className="status-dot h-12 w-12 ok mb-5" aria-hidden="true">
        <ShieldIcon className="h-6 w-6" />
      </span>
      <p className="font-display text-xl text-ink">No disputes yet.</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-mute">
        When a dispute arrives on your connected Stripe account, it will appear here as an evidence
        record, with source-linked proof organized for the reason code.
      </p>
    </div>
  );
}

function ExposureTile({
  label,
  value,
  note,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="surface-card-flat p-5">
      <p className="label-mono text-ink-mute">{label}</p>
      <p
        className={`font-display mt-3 text-2xl leading-none ${
          muted ? 'text-base font-normal text-ink-mute' : accent ? 'text-accent' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {note && <p className="meta-mono mt-3 leading-5 text-ink-faint">{note}</p>}
    </div>
  );
}

function DisputeStatusBadge({ status }: { status: Dispute['status'] }) {
  // Each badge carries an icon plus text, so meaning never rests on color
  // alone. Live-deadline cases use the amber pill-warning treatment.
  const map: Record<
    Dispute['status'],
    { label: string; className: string; icon: 'alert' | 'info' | 'check' | 'dot' }
  > = {
    needs_response: { label: 'Needs response', className: 'pill-warning', icon: 'alert' },
    under_review: { label: 'Under review', className: 'pill-neutral', icon: 'dot' },
    submitted: { label: 'Submitted', className: 'pill-ink', icon: 'check' },
    won: { label: 'Won', className: 'pill-trust', icon: 'check' },
    lost: { label: 'Lost', className: 'pill-neutral', icon: 'info' },
    warning_closed: { label: 'Warning closed', className: 'pill-neutral', icon: 'info' },
  };
  const entry = map[status];
  return (
    <span className={entry.className}>
      <StatusIcon kind={entry.icon} />
      {entry.label}
    </span>
  );
}

function EfwDecisionBadge({ decision }: { decision: EfwAlert['merchant_decision'] }) {
  const map: Record<
    EfwAlert['merchant_decision'],
    { label: string; className: string; icon: 'alert' | 'check' | 'dot' }
  > = {
    pending: { label: 'Decision pending', className: 'pill-warning', icon: 'alert' },
    refund: { label: 'Refund', className: 'pill-neutral', icon: 'dot' },
    fight: { label: 'Fight', className: 'pill-ink', icon: 'check' },
  };
  const entry = map[decision];
  return (
    <span className={entry.className}>
      <StatusIcon kind={entry.icon} />
      {entry.label}
    </span>
  );
}

function StatusIcon({ kind }: { kind: 'alert' | 'info' | 'check' | 'dot' }) {
  if (kind === 'alert') return <AlertIcon className="h-3 w-3" />;
  if (kind === 'info') return <InfoCircleIcon className="h-3 w-3" />;
  if (kind === 'check') return <CheckIcon className="h-3 w-3" />;
  return null; // 'dot' uses the pill's built-in ::before marker
}

function sumExposure(disputes: Dispute[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const dispute of disputes) {
    if (dispute.amount == null) continue;
    const currency = (dispute.currency || 'usd').toLowerCase();
    totals.set(currency, (totals.get(currency) ?? 0) + dispute.amount);
  }
  return totals;
}

function formatExposure(totals: Map<string, number>): string {
  if (totals.size === 0) return formatAmount(0, 'usd');
  return Array.from(totals.entries())
    .map(([currency, cents]) => formatAmount(cents, currency))
    .join(' · ');
}

function formatAmount(amountInCents: number | null, currency: string | null): string {
  const cents = amountInCents ?? 0;
  const code = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

function formatVampRatio(ratio: number | null): string {
  if (ratio == null) return 'Not yet calculated';
  return `${(ratio * 100).toFixed(2)}%`;
}

function vampNote(snapshot: VampSnapshot): string {
  const confidence = snapshot.confidence_level ? `${snapshot.confidence_level} confidence` : null;
  const asOf = `as of ${formatDate(snapshot.calculated_at)}`;
  return [confidence, asOf].filter(Boolean).join(', ');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
