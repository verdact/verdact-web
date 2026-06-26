import type { ChainNode, EvidenceAnalysis } from '@/lib/evidence';
import type { EvidencePacket } from '@/lib/evidence/packet';
import type { EvidenceStrength, ResolutionPlan } from '@/lib/evidence/resolution';
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  InfoCircleIcon,
  ShieldIcon,
} from '../../dash-icons';
import { NoProfileFirstOpen } from './no-profile-first-open';
import { EvidenceAnalysisPanels, QaPanel } from './evidence-analysis-panels';
import { EvidenceUploader } from './evidence-uploader';
import { SlackImportPicker } from './slack-import-picker';
import { NarrativeEditor } from './narrative-editor';
import { RemoveFileButton } from './evidence-file-actions';
import { AcceptanceUnavailable } from './acceptance-unavailable';
import { PacketView } from './packet-view';
import { ChainOfIntentTimeline } from './chain-of-intent-timeline';
import { SubmitToStripeButton } from './submit-to-stripe-button';
import { NextStepCard } from './next-step-card';
import { ReadinessChecklist } from './readiness-checklist';
import { PaidGate } from '../../../_components/ui/paid-gate';
import styles from './workbench.module.css';

/**
 * Presentational layer of the guided 3-stage workbench (Redesign 2026-06-26).
 *
 * `page.tsx` does the auth + DB loading + compute, packs it into one
 * `WorkbenchData` object, and renders <CaseHomeHeader> + the three stage
 * subtrees. The dev preview (`/dev/workbench`) builds a mock `WorkbenchData` and
 * renders the SAME components, so the preview can never drift from production.
 *
 * Nothing here fetches or mutates. The calm/two-color/icon+text/no-em-dash laws
 * from the blueprint are enforced in these components.
 */

export type WorkbenchDispute = {
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

export type EvidenceFile = {
  id: string;
  purpose: string;
  upload_status: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  processor_file_id: string | null;
  processor_uploaded_at: string | null;
  supabase_path: string | null;
  source_kind: string | null;
  source_thread_id: string | null;
  created_at: string;
};

// C-E3 evidence groups: "work happened" vs "client accepted / received it" (the
// bank-weighted group) vs supporting context.
type EvidenceGroup = 'work' | 'acceptance' | 'supporting';

type EvidenceItem = {
  source: 'stripe' | 'gmail' | 'slack' | 'policy' | 'file' | 'missing' | 'relationship';
  label: string;
  title: string;
  detail: string;
  relevance: string;
  status: 'confirmed' | 'missing' | 'draft';
  group?: EvidenceGroup;
  when?: string;
  fileId?: string;
  acceptanceGap?: boolean;
};

// Everything the header + three stages need, computed once in page.tsx.
export interface WorkbenchData {
  record: WorkbenchDispute;
  files: EvidenceFile[];
  customerName: string | null;
  reasonProfile: { networkLabel: string; shortReason: string };
  pastDeadline: boolean;
  filingScope: string;
  hasProfile: boolean;
  slackConnected: boolean;
  packet: EvidencePacket;
  readiness: number;
  confirmedCount: number;
  totalChecks: number;
  strength: EvidenceStrength;
  resolutionPlan: ResolutionPlan | null;
  showAcceptanceCard: boolean;
  acceptanceNoted: boolean;
  acceptanceReason: string | null;
  chainNodes: ChainNode[];
  narrative: string;
  evidenceAnalysis: EvidenceAnalysis;
  packetText: string;
  downloadFilename: string;
  pdfHref: string;
  canDownload: boolean;
  reasonLabel: string;
  vampRatio: number | null;
  approved: boolean;
  submitted: boolean;
  isClosed: boolean;
  submittable: boolean;
  submissionEnabled: boolean;
  optedIn: boolean;
  canExport: boolean;
  canSubmit: boolean;
  stripeFieldCount: number;
  stripeUploadReadyCount: number;
  stripeUploadMissingCount: number;
}

const primaryNav =
  'inline-flex items-center gap-2 rounded-md bg-action px-4 py-2.5 text-sm font-semibold text-white';
const secondaryNav =
  'inline-flex items-center gap-2 rounded-md border border-rule-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-action hover:bg-action-soft';

// ── Case-home header: identity + the single reassurance anchor ───────────────
export function CaseHomeHeader({ data }: { data: WorkbenchData }) {
  const { record, customerName, reasonProfile, pastDeadline, filingScope } = data;
  return (
    <div className="border-b border-rule-strong bg-surface-2 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-6">
        <div className="min-w-[280px] flex-1">
          <a
            className={`${styles.labelMono} rounded-sm text-action underline underline-offset-4 hover:text-action-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40`}
            href="/dashboard"
          >
            Back to overview
          </a>
          <p className={`${styles.labelMono} mt-5`}>
            Dispute <span className={`${styles.chipRc} mx-1`}>{record.processor_dispute_id}</span>{' '}
            {reasonProfile.networkLabel} · {reasonProfile.shortReason}
          </p>
          <h1 className={`${styles.fontDisplay} mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink`}>
            {customerName ?? 'Evidence record'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            <span className="font-semibold text-ink">
              Verdact advises. You decide. Nothing is sent to the bank until you approve.
            </span>{' '}
            One dispute will not suspend your Stripe account. Take the time you need. Account health
            is tracked separately, and a single dispute is normal.
          </p>
        </div>
        <StatusPill status={record.status} />
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-[1280px] flex-wrap overflow-hidden rounded-md border border-rule bg-surface">
        <Fact label="Amount" value={formatAmount(record.amount, record.currency)} strong />
        <Fact label="Network" value={formatNetwork(record.network)} />
        <Fact label="Charge" value={record.processor_charge_id ?? 'Not attached'} mono />
        <Fact
          label="Due"
          value={record.due_by ? formatDate(record.due_by) : 'No deadline'}
          warning={pastDeadline}
        />
      </div>
      <p className="mx-auto mt-2 flex w-full max-w-[1280px] items-center gap-1.5 text-xs leading-5 text-ink-mute">
        <ShieldIcon className="h-3.5 w-3.5" />
        {filingScope}. Nothing leaves Verdact until you approve.
      </p>
    </div>
  );
}

// ── Stage 1: Build evidence ──────────────────────────────────────────────────
export function BuildStage({ data }: { data: WorkbenchData }) {
  const { record, hasProfile, packet, confirmedCount, totalChecks, strength, resolutionPlan } = data;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className={`${styles.fontDisplay} text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
          Let&rsquo;s build your evidence, one step at a time.
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Add what you have. Verdact links each item to where it came from.
        </p>
      </div>

      {!hasProfile && <NoProfileFirstOpen reason={record.reason} />}

      <ReadinessChecklist
        checks={packet.readiness.checks}
        confirmedCount={confirmedCount}
        totalChecks={totalChecks}
        strength={strength}
      />

      <div id="add-evidence" className="scroll-mt-24 space-y-5">
        <EvidenceUploader disputeId={record.id} tone={resolutionPlan ? 'tool' : 'lead'} />
        <details id="import-slack" className={`${styles.card} scroll-mt-24 px-5 py-4`}>
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>
            Import from Slack instead
          </summary>
          <div className="mt-4">
            <SlackImportPicker disputeId={record.id} slackConnected={data.slackConnected} />
          </div>
        </details>
      </div>

      {data.showAcceptanceCard && (
        <AcceptanceGapCard
          disputeId={record.id}
          noted={data.acceptanceNoted}
          reason={data.acceptanceReason}
        />
      )}

      <details className={`${styles.card} px-6 py-4`}>
        <summary className={`${styles.labelMono} cursor-pointer text-action`}>
          Show readiness detail
        </summary>
        <div className="mt-4 flex items-center gap-5">
          <ReadinessDial value={data.readiness} />
          <p className="text-sm leading-6 text-ink-soft">
            Readiness is the share of expected items that are confirmed. It measures how complete
            your evidence is, not your odds of winning.
          </p>
        </div>
      </details>

      <StageFooter>
        <a href="#stage-review" className={primaryNav}>
          Continue to Review
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </a>
      </StageFooter>
    </div>
  );
}

// ── Stage 2: Review ──────────────────────────────────────────────────────────
export function ReviewStage({ data }: { data: WorkbenchData }) {
  const { record } = data;
  const items = buildEvidenceItems(record, data.files, data.approved).filter(
    (item) => !item.acceptanceGap,
  );
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className={`${styles.fontDisplay} text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
          Here is the full record, exactly as it will read to the bank.
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Nothing here is sent until you approve it in the next step.
        </p>
      </div>

      <EvidenceRecord items={items} disputeId={record.id} />

      <ChainOfIntentTimeline nodes={data.chainNodes} />

      <div id="your-account" className="scroll-mt-24">
        <NarrativeEditor disputeId={record.id} initialNarrative={data.narrative} />
      </div>

      <PacketView
        packet={data.packet}
        canDownload={data.canDownload}
        packetText={data.packetText}
        downloadFilename={data.downloadFilename}
        pdfHref={data.pdfHref}
        reasonLabel={data.reasonLabel}
      />

      <details className={`${styles.card} px-6 py-4`}>
        <summary className={`${styles.labelMono} cursor-pointer text-action`}>
          Show analysis and translation
        </summary>
        <div className="mt-4 space-y-5">
          <EvidenceAnalysisPanels analysis={data.evidenceAnalysis} />
        </div>
      </details>

      <details className={`${styles.card} px-6 py-4`}>
        <summary className={`${styles.labelMono} cursor-pointer text-action`}>
          Account health, separate from this case
        </summary>
        <div className="mt-4">
          <AccountRiskPanel ratio={data.vampRatio} />
        </div>
      </details>

      <StageFooter>
        <a href="#stage-build" className={secondaryNav}>
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Back to Build
        </a>
        <span className="flex-1" aria-hidden="true" />
        <a href="#stage-file" className={primaryNav}>
          Continue to Approve and file
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </a>
      </StageFooter>
    </div>
  );
}

// ── Stage 3: Approve and file ────────────────────────────────────────────────
export function FileStage({ data }: { data: WorkbenchData }) {
  const {
    record,
    submitted,
    approved,
    resolutionPlan,
    submissionEnabled,
    optedIn,
    isClosed,
    submittable,
    pastDeadline,
    evidenceAnalysis,
    stripeFieldCount,
    stripeUploadReadyCount,
    stripeUploadMissingCount,
  } = data;

  const fileStatusLine = submitted
    ? 'This record has been filed. We will watch for the bank’s response.'
    : !approved
      ? resolutionPlan
        ? 'Add the open item in Build, then approve and file.'
        : 'Your evidence is ready. Approve it when you are.'
      : !submissionEnabled
        ? 'Approved and saved. Filing to Stripe opens after beta.'
        : !optedIn
          ? 'Approved. Turn on filing in Settings when you are ready to send.'
          : 'Approved and ready to send to Stripe.';

  const fileDetailLine = `This packet maps to ${stripeFieldCount} Stripe evidence ${
    stripeFieldCount === 1 ? 'field' : 'fields'
  }. ${
    stripeUploadMissingCount > 0
      ? `${stripeUploadMissingCount} attached ${
          stripeUploadMissingCount === 1 ? 'file still needs' : 'files still need'
        } a Stripe upload ID.`
      : `${stripeUploadReadyCount} attached ${stripeUploadReadyCount === 1 ? 'file has' : 'files have'} a Stripe upload ID.`
  } Submission re-checks everything before anything is sent.`;

  const qa = evidenceAnalysis.qaSummary;
  const qaLine = evidenceAnalysis.filingBlocked
    ? `Automated checks: ${qa.blocks} to resolve before filing.`
    : qa.warns > 0
      ? `Automated checks: ${qa.warns} to review.`
      : 'Automated checks: all clear.';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className={`${styles.fontDisplay} text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
          {fileStatusLine}
        </h2>
        <details className="mt-2">
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>
            Show submission details
          </summary>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{fileDetailLine}</p>
        </details>
      </div>

      <section className={`${styles.card} px-6 py-5`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span
            className={`${evidenceAnalysis.filingBlocked ? styles.statusDotGap : styles.statusDotOk} h-5 w-5`}
            aria-hidden="true"
          >
            {evidenceAnalysis.filingBlocked ? (
              <AlertIcon className="h-3 w-3" />
            ) : (
              <CheckIcon className="h-3 w-3" />
            )}
          </span>
          {qaLine}
        </p>
        <details className="mt-3 border-t border-rule pt-3">
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>Show the checks</summary>
          <div className="mt-3">
            <QaPanel analysis={evidenceAnalysis} />
          </div>
        </details>
      </section>

      <section className={`${styles.card} px-6 py-5`}>
        <p className="text-sm leading-6 text-ink-soft">
          <span className="font-semibold text-ink">Verdact advises. You decide.</span> Nothing is
          sent to the bank until you approve, right here.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PaidGate action="submit_to_stripe" allowed={data.canSubmit} previewAvailable={false}>
            <SubmitToStripeButton
              disputeId={record.id}
              approved={approved}
              submitted={submitted}
              isClosed={isClosed}
              pastDeadline={pastDeadline}
              submittable={submittable}
              submissionEnabled={submissionEnabled}
              optedIn={optedIn}
            />
          </PaidGate>
          <PaidGate action="export_packet" allowed={data.canExport}>
            <a
              href="#stage-review"
              className="text-sm font-semibold text-action underline underline-offset-4 hover:text-action-deep"
            >
              Copy or download the draft
            </a>
          </PaidGate>
        </div>
      </section>

      <StageFooter>
        <a href="#stage-review" className={secondaryNav}>
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Back to Review
        </a>
      </StageFooter>
    </div>
  );
}

// Convenience: the focus card slot, so page.tsx and the dev harness build it the
// same way.
export function WorkbenchFocusCard({ data }: { data: WorkbenchData }) {
  return (
    <NextStepCard
      plan={data.resolutionPlan}
      submitted={data.submitted}
      approved={data.approved}
      isClosed={data.isClosed}
    />
  );
}

// ── Shared presentational pieces ─────────────────────────────────────────────

function StageFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">{children}</div>
  );
}

function ReadinessDial({ value }: { value: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative h-[108px] w-[108px] flex-none">
      <svg className="-rotate-90" viewBox="0 0 108 108" aria-hidden="true">
        <circle cx="54" cy="54" r={radius} stroke="var(--rule)" strokeWidth="8" fill="none" />
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
        <span className={`${styles.fontDisplay} text-[2rem] font-semibold leading-none text-ink`}>
          {value}%
        </span>
        <span className={`${styles.labelMono} mt-1 text-[0.62rem]`}>Ready</span>
      </div>
    </div>
  );
}

const GROUP_META: Record<EvidenceGroup, { title: string; note: string; weightedNote?: string }> = {
  work: {
    title: 'Work happened',
    note: 'Proof the service was delivered or the work was done.',
  },
  acceptance: {
    title: 'Client accepted or received it',
    note: 'Proof the customer acknowledged or received the delivery.',
    weightedNote: 'What the bank looks at most',
  },
  supporting: {
    title: 'Supporting',
    note: 'Extra context that backs up the record without being required.',
  },
};

const GROUP_ORDER: EvidenceGroup[] = ['work', 'acceptance', 'supporting'];

function EvidenceRecord({ items, disputeId }: { items: EvidenceItem[]; disputeId: string }) {
  const confirmed = items.filter((item) => item.status === 'confirmed').length;
  const missing = items.filter((item) => item.status === 'missing').length;
  const groups = GROUP_ORDER.map((group) => ({
    group,
    rows: items.filter((item) => (item.group ?? 'work') === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>Evidence Record</p>
          <p className={`${styles.labelMono} mt-1.5`}>Each item is linked to where it came from.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={styles.pillVerdict}>
            <CheckIcon className="h-3 w-3" />
            {confirmed} confirmed
          </span>
          <span className={missing > 0 ? styles.pillGap : styles.pillNeutral}>
            {missing > 0 ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
            {missing} missing
          </span>
        </div>
      </header>
      <div className="px-6">
        {groups.map(({ group, rows }) => {
          const meta = GROUP_META[group];
          return (
            <div key={group} className="border-b border-rule py-2 last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-2 pb-1 pt-3">
                <p className="text-sm font-semibold text-ink">{meta.title}</p>
                {meta.weightedNote ? (
                  <span className={styles.labelMono}>{meta.weightedNote}</span>
                ) : null}
              </div>
              <p className={`${styles.labelMono} pb-1`}>{meta.note}</p>
              {rows.map((item) => (
                <EvidenceItemRow
                  key={item.fileId ? `file-${item.fileId}` : `${item.source}-${item.title}`}
                  item={item}
                  disputeId={disputeId}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AcceptanceGapCard({
  disputeId,
  noted,
  reason,
}: {
  disputeId: string;
  noted: boolean;
  reason: string | null;
}) {
  return (
    <section
      id="acceptance-gap"
      className={`${styles.card} scroll-mt-24 overflow-hidden`}
      aria-label="Strengthen your case"
    >
      <header className="flex items-center gap-3.5 border-b border-rule bg-surface-3/60 px-5 py-4">
        <span className={`${styles.statusDotNeutral} h-7 w-7`} aria-hidden="true">
          <InfoCircleIcon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={styles.srcTag}>{noted ? 'NOTED' : 'STRENGTHENS YOUR CASE'}</span>
          <span className={`${styles.fontDisplay} mt-1 block text-[1.05rem] font-semibold leading-tight text-ink`}>
            {noted
              ? 'Delivery or acceptance proof'
              : 'Add proof the customer received or accepted the work'}
          </span>
        </span>
      </header>
      <div className="px-5 pb-5 pt-3">
        <p className="text-sm leading-6 text-ink-soft">
          {noted
            ? 'You recorded that no formal sign-off exists. Verdact files the rest and notes this honestly.'
            : 'This is the single strongest thing you can add. You can still file without it.'}
        </p>
        {!noted ? (
          <div className="mt-3">
            <a
              href="#add-evidence"
              className="inline-flex items-center gap-2 rounded-md bg-action px-3.5 py-2 text-sm font-semibold text-white"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
              Paste or upload the confirmation
            </a>
          </div>
        ) : null}
        <AcceptanceUnavailable disputeId={disputeId} noted={noted} reason={reason} />
      </div>
    </section>
  );
}

function EvidenceItemRow({ item, disputeId }: { item: EvidenceItem; disputeId: string }) {
  const isMissing = item.status === 'missing';
  const isDraft = item.status === 'draft';
  const dotClass = isMissing ? styles.statusDotGap : isDraft ? styles.statusDotNeutral : styles.statusDotOk;
  return (
    <details
      className={`border-b border-rule last:border-b-0 ${isMissing ? `${styles.surfaceGap} -mx-6 my-2 px-6` : ''}`}
      open={isMissing}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[1.5rem_1fr_auto] items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className={`${dotClass} h-5 w-5`} aria-hidden="true">
          {isMissing ? (
            <AlertIcon className="h-3 w-3" />
          ) : isDraft ? (
            <InfoCircleIcon className="h-3 w-3" />
          ) : (
            <CheckIcon className="h-3 w-3" />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={isMissing ? styles.srcTagGap : styles.srcTag}>{item.label}</span>
            {item.when ? <span className={styles.metaMono}>{item.when}</span> : null}
          </span>
          <span
            className={`mt-1.5 block text-sm font-semibold leading-snug ${
              isMissing ? `${styles.fontDisplay} text-[1rem] text-accent-deep` : 'text-ink'
            }`}
          >
            {item.title}
          </span>
        </span>
        <span className={isMissing ? styles.pillGap : isDraft ? styles.pillNeutral : styles.pillVerdict}>
          {isMissing ? (
            <AlertIcon className="h-3 w-3" />
          ) : isDraft ? (
            <InfoCircleIcon className="h-3 w-3" />
          ) : (
            <CheckIcon className="h-3 w-3" />
          )}
          {isMissing ? 'Action needed' : isDraft ? 'Optional' : 'Confirmed'}
        </span>
      </summary>
      <div className="pb-5 pl-10">
        <p className="border-l-2 border-rule-strong pl-3 text-sm leading-6 text-ink-soft">
          {item.detail}
        </p>
        <p className="mt-3 flex gap-2 text-xs leading-5 text-ink-mute">
          <span className={`${styles.labelMono} flex-none`}>Relevance</span>
          <span>{item.relevance}</span>
        </p>
        {item.fileId ? (
          <div className="mt-3 flex justify-end">
            <RemoveFileButton fileId={item.fileId} disputeId={disputeId} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AccountRiskPanel({ ratio }: { ratio: number | null }) {
  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <p className={styles.labelMonoStrong}>Account health</p>
        <span className={styles.pillVerdict}>
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
              Dispute rate {ratio == null ? 'not calculated yet' : formatVampRatio(ratio)}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              Your account-level dispute rate stays separate from this case evidence.
            </p>
          </div>
        </div>
        <details className="mt-4 border-t border-rule pt-3">
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>
            What these terms mean
          </summary>
          <div className="mt-3 rounded-md border border-rule bg-surface px-3 py-2 text-center font-mono text-[0.72rem] text-ink-mute">
            (Fraud reports + Dispute reports) / Settled sales
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-soft">
            Account health is your dispute ratio, the share of sales that turn into disputes. The
            Visa fraud-evidence rule (CE 3.0) applies only to Visa card-absent fraud, reason code
            10.4, not to service disputes.
          </p>
        </details>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ');
  if (status === 'needs_response') {
    return (
      <span className={styles.pillGap}>
        <AlertIcon className="h-3 w-3" />
        Needs response
      </span>
    );
  }
  if (status === 'won' || status === 'submitted') {
    return (
      <span className={styles.pillVerdict}>
        <CheckIcon className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return <span className={`${styles.pillNeutral} capitalize`}>{label}</span>;
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
      <span className={`${styles.labelMono} block`}>{label}</span>
      <span
        className={`mt-1 block text-sm ${mono ? 'font-mono' : ''} ${
          strong ? `${styles.fontDisplay} text-lg font-semibold` : 'font-semibold'
        } ${warning ? 'text-accent-deep' : 'text-ink'}`}
      >
        {value}
      </span>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// ── Evidence-item model (shared with the Review record) ──────────────────────
export function buildEvidenceItems(
  record: WorkbenchDispute,
  files: EvidenceFile[],
  approved: boolean,
): EvidenceItem[] {
  const fileItems: EvidenceItem[] = files.map((file) => {
    const isSlack = file.source_kind === 'slack';
    const isAcceptance = isSlack || file.purpose === 'communication';
    return {
      source: isSlack ? 'slack' : 'file',
      label: isSlack ? 'SLACK' : formatPurpose(file.purpose),
      fileId: file.id,
      group: isAcceptance ? 'acceptance' : 'work',
      title: isSlack ? 'Slack messages' : `${formatPurpose(file.purpose)} file`,
      detail: [
        isSlack ? 'Imported from Slack' : file.mime_type ? `Type: ${file.mime_type}` : null,
        file.content_size_bytes ? `Size: ${formatFileSize(file.content_size_bytes)}` : null,
        file.upload_status ? `Status: ${file.upload_status.replaceAll('_', ' ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      relevance: isSlack
        ? 'Customer messages where they agreed, accepted, or used the work. Filed under customer communication.'
        : purposeRelevance(file.purpose),
      status: 'confirmed',
      when: formatDate(file.created_at),
    };
  });

  const hasPolicyFile = files.some(
    (f) => f.purpose === 'refund_policy' || f.purpose === 'cancellation_policy',
  );
  const acceptanceConfirmed =
    files.some((f) => f.purpose === 'service_documentation' || f.purpose === 'communication') ||
    approved;

  const items: EvidenceItem[] = [
    {
      source: 'stripe',
      label: 'STRIPE',
      group: 'work',
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
      group: 'work',
      title: hasPolicyFile
        ? 'Refund or cancellation policy'
        : 'Terms, refund, and cancellation policy',
      detail: hasPolicyFile
        ? 'A policy document is attached to this record.'
        : 'No policy document is attached yet. Add the refund or cancellation terms the customer agreed to.',
      relevance: 'Shows what the customer agreed to before the disputed engagement.',
      status: hasPolicyFile ? 'confirmed' : 'draft',
    },
  ];

  const hasPriorRelationship = files.some((f) => f.source_kind === 'slack');
  items.push({
    source: 'relationship',
    label: 'PRIOR RELATIONSHIP',
    group: 'supporting',
    title: hasPriorRelationship
      ? 'Prior undisputed activity by this customer'
      : 'Prior relationship with this customer',
    detail: hasPriorRelationship
      ? 'Earlier orders or continued use by the same customer corroborate a genuine, ongoing relationship, not a one-off fraudulent charge.'
      : 'Add any prior undisputed transactions, repeat orders, or continued usage by the same customer. It is supporting evidence, so it strengthens the record without being required.',
    relevance:
      'A repeat or continuing customer is hard to square with "I never authorized this", so it backs up the rest of the chain.',
    status: hasPriorRelationship ? 'confirmed' : 'draft',
  });

  if (!acceptanceConfirmed) {
    items.push({
      source: 'missing',
      label: 'MISSING · RECOMMENDED',
      group: 'acceptance',
      title: 'Delivery or acceptance proof',
      detail:
        'A dated delivery confirmation or signed acceptance is the strongest proof for a services dispute. Resolve it in Build, or record why it is unavailable.',
      relevance:
        'For services-not-rendered disputes, this is the strongest acceptance proof and lifts filing readiness.',
      status: 'missing',
      acceptanceGap: true,
    });
  }

  return items;
}

function purposeRelevance(purpose: string): string {
  switch (purpose) {
    case 'service_documentation':
      return 'Demonstrates the work was delivered or accepted.';
    case 'communication':
      return 'Shows the customer engaged, agreed, or accepted in writing.';
    case 'refund_policy':
    case 'cancellation_policy':
      return 'Shows the terms the customer agreed to before the engagement.';
    default:
      return 'Supporting evidence attached to the record.';
  }
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
