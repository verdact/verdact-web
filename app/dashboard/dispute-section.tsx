import type { Dispute, EfwAlert, VampSnapshot } from '@/lib/dal';

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
    <div className="reveal reveal-3 mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">Disputes</p>
          <h2 className="font-display mt-1 text-2xl text-ink">Evidence records</h2>
        </div>
        {hasData && (
          <p className="meta-mono text-ink-mute">
            {disputes.length} {disputes.length === 1 ? 'record' : 'records'}
          </p>
        )}
      </div>

      {/* VAMP exposure tiles — render only when there is something to show. */}
      {(hasData || vampSnapshot) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ExposureTile label="Open disputes" value={String(openDisputes.length)} />
          <ExposureTile label="Open exposure" value={formatExposure(openExposureByCurrency)} />
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
            />
          )}
        </div>
      )}

      <div className="surface-card mt-5 overflow-hidden">
        {hasData ? (
          <ul className="divide-y divide-rule">
            {disputes.map((dispute) => (
              <DisputeRow key={dispute.id} dispute={dispute} />
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </div>

      {efwAlerts.length > 0 && (
        <div className="surface-card-flat mt-6 overflow-hidden">
          <header className="border-b border-rule-strong px-6 py-4">
            <p className="label-mono">Early fraud warnings</p>
            <p className="font-display mt-1 text-lg text-ink">
              {efwAlerts.length} {efwAlerts.length === 1 ? 'alert' : 'alerts'}
            </p>
          </header>
          <ul className="divide-y divide-rule">
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
  const isOverdue =
    dispute.due_by != null &&
    OPEN_STATUSES.has(dispute.status) &&
    new Date(dispute.due_by).getTime() < Date.now();

  return (
    <li className="grid gap-3 px-6 py-5 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono-strong">{dispute.reason || 'Reason pending'}</span>
          {dispute.network && (
            <span className="meta-mono capitalize text-ink-mute">{dispute.network}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <DisputeStatusBadge status={dispute.status} />
          {showCe3 && (
            <span className="pill-trust w-fit" title="Visa Compelling Evidence 3.0 eligible">
              CE 3.0 eligible
            </span>
          )}
          {dispute.processor_charge_id && (
            <span className="meta-mono break-all text-ink-faint">
              {dispute.processor_charge_id}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-1 md:items-end">
        <span className="text-base font-medium text-ink">
          {formatAmount(dispute.amount, dispute.currency)}
        </span>
        {dueLabel ? (
          <span className={`meta-mono ${isOverdue ? 'text-accent' : 'text-ink-mute'}`}>
            {isOverdue ? 'Past due' : 'Due'} {dueLabel}
          </span>
        ) : (
          <span className="meta-mono text-ink-faint">No deadline</span>
        )}
      </div>
    </li>
  );
}

function EfwRow({ alert }: { alert: EfwAlert }) {
  return (
    <li className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <span className="label-mono-strong">{alert.fraud_type || 'Fraud warning'}</span>
        {alert.processor_charge_id && (
          <span className="meta-mono mt-1 block break-all text-ink-faint">
            {alert.processor_charge_id}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {alert.actionable === false && <span className="pill-neutral w-fit">Not actionable</span>}
        <EfwDecisionBadge decision={alert.merchant_decision} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg text-ink">No disputes yet.</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-mute">
        When a dispute arrives on your connected Stripe account, it will appear here as an evidence
        record.
      </p>
    </div>
  );
}

function ExposureTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="surface-card-flat p-4">
      <p className="label-mono text-ink-mute">{label}</p>
      <p className="mt-2 text-base font-medium leading-snug text-ink">{value}</p>
      {note && <p className="mt-2 text-xs leading-5 text-ink-faint">{note}</p>}
    </div>
  );
}

function DisputeStatusBadge({ status }: { status: Dispute['status'] }) {
  const map: Record<Dispute['status'], { label: string; className: string }> = {
    needs_response: { label: 'Needs response', className: 'pill-accent' },
    under_review: { label: 'Under review', className: 'pill-neutral' },
    submitted: { label: 'Submitted', className: 'pill-ink' },
    won: { label: 'Won', className: 'pill-trust' },
    lost: { label: 'Lost', className: 'pill-neutral' },
    warning_closed: { label: 'Warning closed', className: 'pill-neutral' },
  };
  const entry = map[status];
  return <span className={`${entry.className} w-fit`}>{entry.label}</span>;
}

function EfwDecisionBadge({ decision }: { decision: EfwAlert['merchant_decision'] }) {
  const map: Record<EfwAlert['merchant_decision'], { label: string; className: string }> = {
    pending: { label: 'Decision pending', className: 'pill-accent' },
    refund: { label: 'Refund', className: 'pill-neutral' },
    fight: { label: 'Fight', className: 'pill-ink' },
  };
  const entry = map[decision];
  return <span className={`${entry.className} w-fit`}>{entry.label}</span>;
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
