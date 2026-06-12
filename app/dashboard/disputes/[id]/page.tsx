import { notFound } from 'next/navigation';
import { AppShell } from '../../../_components/app-chrome';
import { getLatestVampSnapshot, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DocIcon,
  LockIcon,
  ShieldIcon,
} from '../../dash-icons';

export const metadata = {
  title: 'Evidence record · Verdact',
  description: 'Review a source-linked Verdact evidence record.',
};

export const dynamic = 'force-dynamic';

type WorkbenchPageProps = {
  params: Promise<{ id: string }>;
};

type WorkbenchDispute = {
  id: string;
  merchant_id: string;
  processor_dispute_id: string;
  processor_charge_id: string | null;
  amount: number | null;
  currency: string | null;
  reason: string | null;
  network: string | null;
  status: string;
  due_by: string | null;
  ce3_eligible: boolean | null;
  evidence_draft: unknown;
  evidence_approved_at: string | null;
  submitted_at: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceFile = {
  id: string;
  purpose: string;
  upload_status: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  processor_file_id: string | null;
  processor_uploaded_at: string | null;
  supabase_path: string | null;
  created_at: string;
};

type EvidenceItem = {
  source: 'stripe' | 'gmail' | 'slack' | 'policy' | 'file' | 'missing';
  label: string;
  title: string;
  detail: string;
  relevance: string;
  status: 'confirmed' | 'missing' | 'draft';
  when?: string;
};

export default async function EvidenceRecordWorkbench({ params }: WorkbenchPageProps) {
  const { id } = await params;
  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: dispute }, { data: evidenceFiles }, vampSnapshot] = await Promise.all([
    supabase
      .from('disputes')
      .select(
        [
          'id',
          'merchant_id',
          'processor_dispute_id',
          'processor_charge_id',
          'amount',
          'currency',
          'reason',
          'network',
          'status',
          'due_by',
          'ce3_eligible',
          'evidence_draft',
          'evidence_approved_at',
          'submitted_at',
          'outcome',
          'created_at',
          'updated_at',
        ].join(', '),
      )
      .eq('id', id)
      .eq('merchant_id', membership.merchant.id)
      .maybeSingle(),
    supabase
      .from('evidence_files')
      .select(
        'id, purpose, upload_status, mime_type, content_size_bytes, processor_file_id, processor_uploaded_at, supabase_path, created_at',
      )
      .eq('dispute_id', id)
      .eq('merchant_id', membership.merchant.id)
      .order('created_at', { ascending: false }),
    getLatestVampSnapshot(),
  ]);

  if (!dispute) {
    notFound();
  }

  const record = dispute as unknown as WorkbenchDispute;
  const files = (evidenceFiles ?? []) as unknown as EvidenceFile[];
  const approved = Boolean(record.evidence_approved_at);
  const submitted = Boolean(record.submitted_at);
  const hasFiles = files.length > 0;
  const readiness = submitted ? 100 : approved ? 92 : hasFiles ? 78 : 58;
  const missingCount = approved ? 0 : 1;
  const evidenceItems = buildEvidenceItems(record, files, approved);
  const businessName = membership.merchant.business_name?.trim() || null;

  return (
    <AppShell email={user.email} businessName={businessName} active="disputes">
      <div className="border-b border-rule-strong bg-surface-2 px-6 py-6 md:px-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-6">
          <div className="min-w-[280px] flex-1">
            <a
              className="label-mono rounded-sm text-action underline underline-offset-4 hover:text-action-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
              href="/dashboard"
            >
              Back to overview
            </a>
            <p className="label-mono mt-5">
              Dispute <span className="chip-rc mx-1">{record.processor_dispute_id}</span>{' '}
              {formatReason(record.reason)}
            </p>
            <h1 className="font-display mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
              Evidence record workbench
            </h1>
          </div>
          <StatusPill status={record.status} />
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-[1280px] flex-wrap overflow-hidden rounded-md border border-rule bg-surface">
          <Fact label="Amount" value={formatAmount(record.amount, record.currency)} strong />
          <Fact label="Network" value={formatNetwork(record.network)} />
          <Fact label="Charge" value={record.processor_charge_id ?? 'Not attached'} mono />
          <Fact label="Due" value={record.due_by ? formatDate(record.due_by) : 'No deadline'} warning />
        </div>
      </div>

      <section className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <ReadinessCard
            readiness={readiness}
            missingCount={missingCount}
            approved={approved}
            submitted={submitted}
            dueBy={record.due_by}
          />

          <ResolveMissingProof open={!approved} />

          <EvidenceRecord items={evidenceItems} missingCount={missingCount} />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <QaPanel approved={approved} hasFiles={hasFiles} record={record} />
          <AccountRiskPanel ratio={vampSnapshot?.estimated_vamp_ratio ?? null} />
        </aside>
      </section>

      <BottomActionBar approved={approved} submitted={submitted} />
    </AppShell>
  );
}

function ReadinessCard({
  readiness,
  missingCount,
  approved,
  submitted,
  dueBy,
}: {
  readiness: number;
  missingCount: number;
  approved: boolean;
  submitted: boolean;
  dueBy: string | null;
}) {
  const title = submitted
    ? 'Submitted record.'
    : approved
      ? 'Filing-ready record.'
      : 'Draft record. One issue blocks filing readiness.';
  const badge = submitted ? 'Submitted' : approved ? 'Ready' : 'Needs evidence';

  return (
    <section className="surface-card overflow-hidden border-t-[3px] border-t-action">
      <div className="grid gap-6 border-b border-rule px-6 py-6 sm:grid-cols-[108px_1fr]">
        <ReadinessDial value={readiness} />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`pill-${approved || submitted ? 'trust' : 'warning'} w-fit`}
            >
              {approved || submitted ? (
                <CheckIcon className="h-3 w-3" />
              ) : (
                <AlertIcon className="h-3 w-3" />
              )}
              {badge}
            </span>
            <span className="label-mono">
              RC 13.1 service-delivery record
            </span>
          </div>
          <h2 className="font-display mt-4 text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Verdact keeps this screen decision-first: readiness, missing proof,
            source-linked evidence, QA, and filing controls are visible before any
            action can happen.
          </p>
        </div>
      </div>

      <div className="grid border-t border-rule sm:grid-cols-3">
        <ReadinessFact
          icon={<AlertIcon className="h-3.5 w-3.5" />}
          label="Blocker"
          value={missingCount > 0 ? 'Missing acceptance proof' : 'None open'}
          tone={missingCount > 0 ? 'warn' : 'ok'}
        />
        <ReadinessFact
          icon={<ChevronRightIcon className="h-3.5 w-3.5" />}
          label="Next action"
          value={missingCount > 0 ? 'Resolve missing item' : 'Review controls'}
        />
        <ReadinessFact
          icon={<ClockIcon className="h-3.5 w-3.5" />}
          label="Deadline"
          value={dueBy ? formatDate(dueBy) : 'Not provided'}
          note={dueBy ? daysUntil(dueBy) : undefined}
        />
      </div>
    </section>
  );
}

function ReadinessDial({ value }: { value: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative h-[108px] w-[108px]">
      <svg className="-rotate-90" viewBox="0 0 108 108" aria-hidden="true">
        <circle
          cx="54"
          cy="54"
          r={radius}
          stroke="var(--rule)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="54"
          cy="54"
          r={radius}
          stroke="var(--action)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[2rem] font-semibold leading-none text-ink">
          {value}%
        </span>
        <span className="label-mono mt-1 text-[0.62rem]">Ready</span>
      </div>
    </div>
  );
}

function ResolveMissingProof({ open }: { open: boolean }) {
  return (
    <details
      className="overflow-hidden rounded-md border border-accent-rule border-l-[4px] border-l-accent bg-surface-2"
      open={open}
    >
      <summary className="flex cursor-pointer items-center gap-4 bg-accent-soft px-5 py-4">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent text-white">
          <AlertIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-mono-strong text-accent">Resolve to unlock filing</span>
          <span className="font-display mt-1 block text-[1.05rem] font-semibold leading-tight text-ink">
            Add the missing milestone sign-off
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5 pt-3">
        <p className="border-b border-dashed border-rule-strong pb-4 text-sm leading-6 text-ink-soft">
          For a services-not-rendered dispute, an informal message helps, but a dated
          acceptance record is the strongest proof. This is a guided design scaffold:
          uploads and source search are intentionally not wired in this pass.
        </p>
        <div className="mt-4 grid gap-2.5">
          {RESOLVE_OPTIONS.map((option, index) => (
            <button
              key={option.title}
              className={`flex cursor-not-allowed items-center gap-3 rounded-md border px-4 py-3 text-left ${
                index === 0
                  ? 'border-action-rule bg-action-soft'
                  : 'border-rule-strong bg-surface-2'
              }`}
              type="button"
              disabled
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-rule-strong bg-surface text-action">
                <DocIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-ink">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-mute">
                  {option.body}
                </span>
              </span>
              {index === 0 ? <span className="pill-action">Fastest</span> : null}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function EvidenceRecord({
  items,
  missingCount,
}: {
  items: EvidenceItem[];
  missingCount: number;
}) {
  const confirmed = items.filter((item) => item.status === 'confirmed').length;
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Evidence Record</p>
          <p className="label-mono mt-1.5">Source-linked · Nothing submitted until you approve</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill-trust">
            <CheckIcon className="h-3 w-3" />
            {confirmed} confirmed
          </span>
          <span className={missingCount > 0 ? 'pill-accent' : 'pill-neutral'}>
            {missingCount} missing
          </span>
        </div>
      </header>
      <div className="px-6 py-2">
        {items.map((item) => (
          <EvidenceItemRow key={`${item.source}-${item.title}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function EvidenceItemRow({ item }: { item: EvidenceItem }) {
  const isMissing = item.status === 'missing';
  const dotClass = isMissing ? 'miss' : 'ok';
  const tagClass = item.source === 'file' ? 'policy' : item.source;
  return (
    <details
      className={`border-b border-rule last:border-b-0 ${isMissing ? 'surface-missing -mx-6 my-2 px-6' : ''}`}
      open={isMissing}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[1.5rem_1fr_auto] items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className={`status-dot h-5 w-5 ${dotClass}`} aria-hidden="true">
          {isMissing ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`src-tag ${tagClass}`}>{item.label}</span>
            {item.when ? <span className="meta-mono text-ink-faint">{item.when}</span> : null}
          </span>
          <span
            className={`mt-1.5 block text-sm font-semibold leading-snug ${
              isMissing ? 'font-display text-[1rem] text-accent' : 'text-ink'
            }`}
          >
            {item.title}
          </span>
        </span>
        <span className={isMissing ? 'pill-accent' : 'pill-trust'}>
          {isMissing ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
          {isMissing ? 'Action needed' : 'Confirmed'}
        </span>
      </summary>
      <div className="pb-5 pl-10">
        <p className="border-l-2 border-rule-strong pl-3 text-sm leading-6 text-ink-soft">
          {item.detail}
        </p>
        <p className="mt-3 flex gap-2 text-xs leading-5 text-ink-mute">
          <span className="label-mono flex-none">Relevance</span>
          <span>{item.relevance}</span>
        </p>
      </div>
    </details>
  );
}

function QaPanel({
  approved,
  hasFiles,
  record,
}: {
  approved: boolean;
  hasFiles: boolean;
  record: WorkbenchDispute;
}) {
  const rows = [
    {
      ok: Boolean(record.reason),
      title: 'Reason code matched',
      body: record.reason
        ? `Evidence is mapped to ${formatReason(record.reason)}.`
        : 'Reason code has not been normalized yet.',
    },
    {
      ok: Boolean(record.processor_charge_id),
      title: 'Stripe charge attached',
      body: record.processor_charge_id
        ? 'Charge context is available for source traceability.'
        : 'Charge ID is not attached yet.',
    },
    {
      ok: hasFiles,
      title: 'File evidence present',
      body: hasFiles
        ? 'At least one evidence file is attached to this dispute.'
        : 'No uploaded files are attached yet.',
    },
    {
      ok: approved,
      title: 'Merchant approval',
      body: approved
        ? 'The record has been approved for filing workflow use.'
        : 'Approval is still locked until the missing item is resolved.',
    },
    {
      ok: record.ce3_eligible !== true || record.reason?.includes('10.4') === true,
      title: 'CE 3.0 scope',
      body: 'CE 3.0 should surface only for Visa card-absent fraud, never RC 13.1 services.',
    },
  ];

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <p className="label-mono-strong">Pre-submission QA</p>
        <span className={approved ? 'pill-trust' : 'pill-warning'}>
          {approved ? <CheckIcon className="h-3 w-3" /> : <AlertIcon className="h-3 w-3" />}
          {approved ? 'Ready' : '1 to resolve'}
        </span>
      </header>
      <ul className="px-5 py-1">
        {rows.map((row) => (
          <li className="flex gap-3 border-b border-rule py-3 last:border-b-0" key={row.title}>
            <span
              className={`mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-[4px] text-white ${
                row.ok ? 'bg-trust' : 'bg-warning'
              }`}
            >
              {row.ok ? <CheckIcon className="h-3 w-3" /> : <AlertIcon className="h-3 w-3" />}
            </span>
            <span>
              <span className="block text-sm font-semibold leading-snug text-ink">
                {row.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-ink-mute">{row.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccountRiskPanel({ ratio }: { ratio: number | null }) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <p className="label-mono-strong">Account risk</p>
        <span className="pill-trust">
          <ShieldIcon className="h-3 w-3" />
          Monitor
        </span>
      </header>
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-trust-rule bg-trust-soft text-trust">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-snug text-ink">
              VAMP ratio {ratio == null ? 'not calculated yet' : formatVampRatio(ratio)}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              Account-level monitoring stays separate from this case evidence.
            </p>
          </div>
        </div>
        <details className="mt-4 border-t border-rule pt-3">
          <summary className="label-mono cursor-pointer text-action">VAMP detail</summary>
          <div className="mt-3 rounded-md border border-rule bg-surface px-3 py-2 text-center font-mono text-[0.72rem] text-ink-mute">
            (Fraud TC40 + Disputes TC15) / Settled TC05
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-soft">
            Non-fraud service disputes remain outside Compelling Evidence 3.0. CE 3.0 applies
            only to Visa card-absent fraud, reason code 10.4.
          </p>
        </details>
      </div>
    </section>
  );
}

function BottomActionBar({
  approved,
  submitted,
}: {
  approved: boolean;
  submitted: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-[#1e293b] bg-[#0f172a] text-[#cbd5e1]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-4 px-6 py-4 md:px-10">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-[#334155] bg-[#1e293b] text-[#60a5fa]">
          <LockIcon className="h-4 w-4" />
        </span>
        <p className="min-w-[240px] flex-1 text-sm leading-6">
          <span className="font-semibold text-[#e7edf4]">
            {submitted
              ? 'This record has already been submitted.'
              : approved
                ? 'Record approved. Filing workflow controls stay gated.'
                : 'Nothing is sent to the bank yet.'}
          </span>{' '}
          {approved
            ? 'Submission actions will be wired in the filing workflow stage.'
            : 'Submit unlocks only after the missing item is resolved and the merchant approves.'}
        </p>
        <button className="rounded-md border border-[#3a4b60] px-4 py-2 text-sm font-semibold text-[#e7edf4]" type="button">
          Export draft
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={!approved || submitted}
        >
          Review and submit
          <span className="rounded-sm bg-white/20 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em]">
            Locked
          </span>
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ');
  if (status === 'needs_response') {
    return (
      <span className="pill-warning">
        <AlertIcon className="h-3 w-3" />
        Needs response
      </span>
    );
  }
  if (status === 'won' || status === 'submitted') {
    return (
      <span className="pill-trust">
        <CheckIcon className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return <span className="pill-neutral capitalize">{label}</span>;
}

function Fact({
  label,
  value,
  mono = false,
  strong = false,
  warning = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="border-b border-rule px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="label-mono block">{label}</span>
      <span
        className={`mt-1 block text-sm ${mono ? 'font-mono' : ''} ${
          strong ? 'font-display text-lg font-semibold' : 'font-semibold'
        } ${warning ? 'text-warning' : 'text-ink'}`}
      >
        {value}
      </span>
    </div>
  );
}

function ReadinessFact({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div className="border-b border-rule px-6 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="label-mono flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-semibold leading-5 ${
          tone === 'warn' ? 'text-accent' : tone === 'ok' ? 'text-trust' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {note ? <p className="meta-mono mt-1 text-ink-mute">{note}</p> : null}
    </div>
  );
}

function buildEvidenceItems(
  record: WorkbenchDispute,
  files: EvidenceFile[],
  approved: boolean,
): EvidenceItem[] {
  const fileItems = files.map((file) => ({
    source: 'file' as const,
    label: formatPurpose(file.purpose),
    title: `${formatPurpose(file.purpose)} file`,
    detail: [
      file.mime_type ? `Type: ${file.mime_type}` : null,
      file.content_size_bytes ? `Size: ${formatFileSize(file.content_size_bytes)}` : null,
      file.upload_status ? `Status: ${file.upload_status.replaceAll('_', ' ')}` : null,
      file.processor_file_id ? `Processor file: ${file.processor_file_id}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    relevance: 'Attached evidence file available for the draft record.',
    status: 'confirmed' as const,
    when: formatDate(file.created_at),
  }));

  return [
    {
      source: 'stripe',
      label: 'STRIPE',
      title: record.processor_charge_id
        ? `Charge ${record.processor_charge_id}`
        : 'Stripe dispute record',
      detail: `${formatAmount(record.amount, record.currency)} dispute from Stripe. Processor dispute ${record.processor_dispute_id}.`,
      relevance: 'Establishes the payment, charge, dispute amount, network, and deadline context.',
      status: 'confirmed',
      when: formatDate(record.created_at),
    },
    ...fileItems,
    {
      source: 'policy',
      label: 'POLICY',
      title: 'Terms, refund, and cancellation policy',
      detail:
        'Policy evidence is part of the record scaffold. The actual captured policy artifact is not attached in this UI pass.',
      relevance: 'Shows what the customer agreed to before the disputed engagement.',
      status: 'draft',
    },
    {
      source: 'missing',
      label: approved ? 'RESOLVED' : 'MISSING · REQUIRED',
      title: 'Milestone sign-off document',
      detail: approved
        ? 'Merchant approval is recorded for this evidence workflow.'
        : 'A dated, signed milestone sign-off is not present in connected or uploaded sources yet.',
      relevance: approved
        ? 'This record can move to the filing workflow.'
        : 'For services-not-rendered disputes, this is the strongest acceptance proof and blocks filing readiness.',
      status: approved ? 'confirmed' : 'missing',
    },
  ];
}

const RESOLVE_OPTIONS = [
  {
    title: 'Upload a signed document',
    body: 'PDF or image of a signed acceptance, SOW completion, or milestone sign-off.',
  },
  {
    title: 'Request sign-off from the customer',
    body: 'Future flow: send a one-click acceptance link and file the reply as proof.',
  },
  {
    title: 'Search Gmail or Slack again',
    body: 'Future flow: rescan connected sources for a stronger acceptance artifact.',
  },
  {
    title: 'Mark unavailable, with a reason',
    body: 'Future flow: record why the proof does not exist and file the remaining case.',
  },
] as const;

function formatReason(reason: string | null) {
  if (!reason) return 'Reason pending';
  return reason.replaceAll('_', ' ');
}

function formatPurpose(purpose: string) {
  return purpose
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatNetwork(network: string | null) {
  if (!network) return 'Unknown';
  return network.charAt(0).toUpperCase() + network.slice(1);
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

function formatVampRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function daysUntil(value: string) {
  const now = Date.now();
  const due = new Date(value).getTime();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Past due';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `${diff} days left`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
