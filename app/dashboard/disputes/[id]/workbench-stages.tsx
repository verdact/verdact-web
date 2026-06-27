import type { ChainNode, EvidenceAnalysis } from '@/lib/evidence';
import type { EvidencePacket, PacketReadinessCheck, ReadinessKey } from '@/lib/evidence/packet';
import type { EvidenceStrength, ResolutionPlan, ResolveRoute } from '@/lib/evidence/resolution';
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  DocIcon,
  DownloadIcon,
  EyeIcon,
  GavelIcon,
  InfoCircleIcon,
  ListIcon,
  LockIcon,
  PlusIcon,
  RouteIcon,
  SaveIcon,
  ShieldIcon,
  UploadIcon,
  UserCheckIcon,
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
import { PaidGate } from '../../../_components/ui/paid-gate';
import styles from './workbench.module.css';
import ui from './workbench-shell.module.css';

/**
 * Presentational layer of the Stage-Panels workbench (Redesign v2, 2026-06-27).
 *
 * page.tsx loads + computes once into a WorkbenchData object, then renders the
 * case header, three stage bodies, and the reassurance footer as server
 * subtrees and hands them to <WorkbenchShell> (the client accordion). The dev
 * preview (/dev/workbench) builds a mock WorkbenchData and renders the SAME
 * components, so the preview can never drift from production.
 *
 * Nothing here fetches or mutates. The look ports `wb-final.html` onto the app's
 * real tokens (the `ui` module). Two-color law, icon+text status, no em dashes.
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

// C-E3 evidence groups for the detailed Review record.
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

// Everything the header + three stages + reassurance need, computed in page.tsx.
export interface WorkbenchData {
  record: WorkbenchDispute;
  files: EvidenceFile[];
  customerName: string | null;
  customerEmail: string | null;
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

// ── Case-home header (rendered at the top of the shell's centered column) ─────
export function CaseHomeHeader({ data }: { data: WorkbenchData }) {
  const { record, customerName, customerEmail, reasonProfile, pastDeadline } = data;
  const title = customerName ? (
    <>
      Build your proof for <span className={ui.accent}>{customerName}</span>
    </>
  ) : (
    'Build your evidence record'
  );
  const days = daysUntil(record.due_by);
  return (
    <header>
      <a className={ui.caseBack} href="/dashboard">
        <ArrowLeftIcon /> Back to overview
      </a>
      <div className={ui.caseHead}>
        <div>
          <p className={ui.caseKicker}>Evidence workbench</p>
          <h1 className={ui.caseTitle}>{title}</h1>
          <div className={ui.caseFacts}>
            <span className={ui.fact}>
              <strong>{formatAmount(record.amount, record.currency)}</strong> disputed
            </span>
            <span className={ui.fact}>
              {reasonProfile.networkLabel} · {reasonProfile.shortReason}
            </span>
            {customerEmail ? <span className={ui.fact}>{customerEmail}</span> : null}
            <span className={`${ui.fact} ${pastDeadline ? ui.warn : ''}`}>
              <ClockIcon />
              {record.due_by
                ? pastDeadline
                  ? `Past due ${formatDate(record.due_by)}`
                  : `Due ${formatDate(record.due_by)}`
                : 'No deadline'}
            </span>
          </div>
        </div>
        <DeadlineTile dueBy={record.due_by} days={days} pastDeadline={pastDeadline} />
      </div>
      <p className={ui.headerAssure}>
        <ShieldIcon />
        <span>
          <b>Verdact advises. You decide.</b> Nothing is sent to the bank until you approve. One
          dispute will not suspend your Stripe account, so take the time you need.
        </span>
      </p>
    </header>
  );
}

function DeadlineTile({
  dueBy,
  days,
  pastDeadline,
}: {
  dueBy: string | null;
  days: number | null;
  pastDeadline: boolean;
}) {
  if (!dueBy) {
    return (
      <div className={ui.deadlineTile} style={{ '--urgency': '0.5' } as React.CSSProperties}>
        <p className={ui.dlLbl}>Respond by</p>
        <p className={ui.dlDays}>
          <span style={{ fontSize: '1.4rem' }}>No deadline set</span>
        </p>
      </div>
    );
  }
  const urgency = pastDeadline
    ? 0.08
    : Math.max(0.12, Math.min(1, (days ?? 0) / 21));
  return (
    <div
      className={`${ui.deadlineTile} ${pastDeadline ? ui.warn : ''}`}
      style={{ '--urgency': String(urgency) } as React.CSSProperties}
    >
      <p className={ui.dlLbl}>{pastDeadline ? 'Deadline passed' : 'Respond within'}</p>
      <p className={ui.dlDays}>
        {pastDeadline ? (
          <span style={{ fontSize: '1.6rem' }}>Past due</span>
        ) : (
          <>
            {days} <small>{days === 1 ? 'day' : 'days'}</small>
          </>
        )}
      </p>
      <p className={ui.dlDate}>by {formatDate(dueBy)}</p>
    </div>
  );
}

// ── Reassurance footer (rendered below the stages) ────────────────────────────
export function WorkbenchReassurance({ data }: { data: WorkbenchData }) {
  const days = daysUntil(data.record.due_by);
  const rateLine =
    data.vampRatio == null
      ? 'Account health is tracked separately, and a single dispute is normal.'
      : `Dispute rate ${formatVampRatio(data.vampRatio)}. One dispute will not suspend your Stripe account.`;
  return (
    <>
      <div className={ui.reassure}>
        <div className={ui.reCard}>
          <span className={ui.reIcon} aria-hidden="true">
            <ShieldIcon />
          </span>
          <div>
            <p className={ui.reTitle}>Your account is safe</p>
            <p className={ui.reBody}>{rateLine}</p>
          </div>
        </div>
        <div className={ui.reCard}>
          <span className={ui.reIcon} aria-hidden="true">
            <UserCheckIcon />
          </span>
          <div>
            <p className={ui.reTitle}>Verdact advises. You decide.</p>
            <p className={ui.reBody}>
              Nothing is sent to the bank until <b>you approve</b>. You stay in control the whole
              way.
            </p>
          </div>
        </div>
      </div>
      <p className={ui.youDecide}>
        <LockIcon />
        <span>
          Take your time. Your work is saved automatically.
          {data.submitted
            ? ''
            : days != null && !data.pastDeadline
              ? ` You have ${days} ${days === 1 ? 'day' : 'days'}.`
              : ''}
        </span>
      </p>
    </>
  );
}

// ── Stage 1: Build the proof ──────────────────────────────────────────────────
export function BuildStage({ data }: { data: WorkbenchData }) {
  const { record, hasProfile, packet, confirmedCount, totalChecks, resolutionPlan } = data;
  const firstOpen = !hasProfile && !data.submitted && !data.approved && !data.isClosed;

  return (
    <>
      {/* Do this next */}
      <SectionBar
        first
        icon={<ArrowRightIcon />}
        title="Do this next"
        note={
          resolutionPlan
            ? 'One thing stands between you and a complete record'
            : 'Your record is complete. Continue when you are ready.'
        }
      />

      {firstOpen ? (
        <NoProfileFirstOpen reason={record.reason} />
      ) : resolutionPlan ? (
        <NextAction plan={resolutionPlan} />
      ) : (
        <div className={ui.checksRow}>
          <CheckIcon />
          Your evidence record is complete. Continue to Review when you are ready.
        </div>
      )}

      {/* Your evidence record */}
      <SectionBar
        icon={<DocIcon />}
        title="Your evidence record"
        note={`Everything we have gathered so far · ${confirmedCount} of ${totalChecks} confirmed`}
      />

      <ReadinessBand
        confirmedCount={confirmedCount}
        totalChecks={totalChecks}
        hasGap={Boolean(resolutionPlan)}
      />

      <EvidenceRows
        checks={packet.readiness.checks}
        primaryGapKey={resolutionPlan?.key ?? null}
      />

      {/* Add evidence (deep-link + flag target) */}
      <SectionBar
        icon={<UploadIcon />}
        title="Add evidence"
        note="Upload, paste, or import the proof you have"
      />
      <div id="add-evidence" className="scroll-mt-24">
        <EvidenceUploader disputeId={record.id} tone={resolutionPlan ? 'tool' : 'lead'} />
        <details id="import-slack" className={`${styles.card} mt-4 scroll-mt-24 px-5 py-4`}>
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

      <StepNav
        note={{ icon: <SaveIcon />, text: 'Your work is saved automatically. You can come back any time.' }}
        forward={{ href: '#stage-review', label: 'Continue to Review' }}
      />
    </>
  );
}

// ── Stage 2: Review the record ────────────────────────────────────────────────
export function ReviewStage({ data }: { data: WorkbenchData }) {
  const { record, packet } = data;
  const narrativeField = packet.fields.find((f) => f.key === 'uncategorized_text');
  const items = buildEvidenceItems(record, data.files, data.approved).filter(
    (item) => !item.acceptanceGap,
  );

  return (
    <>
      <SectionBar
        first
        icon={<DocIcon />}
        title="The bank-ready packet"
        note="A preview of what we will file. You read it in full right here."
      />
      <div className={ui.packetGrid}>
        <PacketCell label="Reason answered" value={data.reasonLabel} />
        <PacketCell label="Disputed amount" value={formatAmount(record.amount, record.currency)} />
        <PacketCell
          label="Compelling-evidence narrative"
          value={narrativeField?.present ? 'Drafted from your record' : 'Not written yet'}
        />
        <PacketCell
          label="Submission format"
          value={
            packet.limits.withinSizeLimit
              ? 'Within Stripe / Visa exhibit limits'
              : 'Over size limit, trim a file'
          }
        />
      </div>

      <SectionBar
        icon={<ListIcon />}
        title="Mapped exhibits · in order"
        note="Each item attaches to the field the bank looks for"
      />
      <ExhibitStrip packet={packet} />

      {/* Your account of what happened (deep-link target) */}
      <SectionBar
        icon={<PencilGlyph />}
        title="Your account of what happened"
        note="A short, plain account. Verdact restates it in bank language."
      />
      <div id="your-account" className="scroll-mt-24">
        <NarrativeEditor disputeId={record.id} initialNarrative={data.narrative} />
      </div>

      {/* Full packet preview + gated download */}
      <SectionBar
        icon={<EyeIcon />}
        title="Read the full packet"
        note="Every field and exhibit, exactly as the bank receives it"
      />
      <PacketView
        packet={data.packet}
        canDownload={data.canDownload}
        packetText={data.packetText}
        downloadFilename={data.downloadFilename}
        pdfHref={data.pdfHref}
        reasonLabel={data.reasonLabel}
      />

      <details className={`${styles.card} mt-4 px-6 py-4`}>
        <summary className={`${styles.labelMono} cursor-pointer text-action`}>
          Show every item in the record
        </summary>
        <div className="mt-4">
          <EvidenceRecord items={items} disputeId={record.id} />
          <div className="mt-4">
            <ChainOfIntentTimeline nodes={data.chainNodes} />
          </div>
        </div>
      </details>

      <details className={`${styles.card} px-6 py-4`}>
        <summary className={`${styles.labelMono} cursor-pointer text-action`}>
          Show analysis and translation
        </summary>
        <div className="mt-4">
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

      <StepNav
        note={{ icon: <EyeIcon />, text: 'This is a preview. You read every word before anything is filed.' }}
        back={{ href: '#stage-build', label: 'Back to Build' }}
        forward={{ href: '#stage-file', label: 'Continue to Approve and file' }}
      />
    </>
  );
}

// ── Stage 3: Approve and file ─────────────────────────────────────────────────
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
    packet,
  } = data;

  const qa = evidenceAnalysis.qaSummary;
  const filingBlocked = evidenceAnalysis.filingBlocked;
  // Genuinely not ready to file: an open evidence gap, or QA is blocking. Once
  // the record is approved/submitted/closed we always show the file state.
  const notReady = !submitted && !isClosed && (Boolean(resolutionPlan) || filingBlocked);

  if (notReady) {
    const blockers: Blocker[] = [];
    if (resolutionPlan) {
      const primaryRoute = resolutionPlan.routes.find((r) => r.primary) ?? resolutionPlan.routes[0];
      blockers.push({
        kind: 'missing',
        href: primaryRoute?.href ?? '#add-evidence',
        name: resolutionPlan.title,
        detail: resolutionPlan.why,
        where: routeWhere(primaryRoute),
      });
    }
    if (filingBlocked) {
      blockers.push({
        kind: 'todo',
        href: '#stage-build',
        name: `Resolve ${qa.blocks} ${qa.blocks === 1 ? 'check' : 'checks'} before filing`,
        detail: 'Automated pre-flight found something that would get the packet rejected.',
        where: 'In Build',
      });
    }
    const reason = resolutionPlan
      ? `Add the open item first${filingBlocked ? ', and clear the automated checks' : ''}.`
      : 'Clear the automated checks first.';

    return (
      <>
        <div className={ui.notreadyLead}>
          <p className={ui.nrEyebrow}>
            <RouteIcon /> Almost there
          </p>
          <h3 className={ui.nrHead}>You are almost there. A couple of things first.</h3>
          <p className={ui.nrSub}>
            Your record is not complete yet. A couple of things stand between it and being ready to
            approve. Here is exactly what, and where each one lives.
          </p>
        </div>

        <SectionBar
          icon={<ListIcon />}
          title="What stands between you and filing"
          note="Tap either to go straight to it"
        />
        <div className={ui.blockerList}>
          {blockers.map((b, i) => (
            <a key={i} className={`${ui.blockerItem} ${b.kind === 'missing' ? ui.isMissing : ui.isTodo}`} href={b.href}>
              <span className={ui.blockerIcon} aria-hidden="true">
                {b.kind === 'missing' ? <AlertIcon /> : <EyeIcon />}
              </span>
              <span className={ui.blockerMain}>
                <span className={ui.blockerName}>{b.name}</span>
                <span className={ui.blockerFor}>{b.detail}</span>
              </span>
              <span className={ui.blockerStep}>
                <ArrowRightIcon /> {b.where}
              </span>
            </a>
          ))}
        </div>

        <div className={ui.nrActions}>
          <a className={ui.btnTofix} href={blockers[0]?.href ?? '#add-evidence'}>
            <ArrowLeftIcon /> Take me to what is missing
          </a>
          <span className={ui.nrOr}>It opens the right step and points you at it.</span>
        </div>

        <div className={ui.approveLocked}>
          <span className={ui.alIcon} aria-hidden="true">
            <LockIcon />
          </span>
          <span className={ui.alText}>
            <button
              className={ui.btnApproveLocked}
              type="button"
              aria-disabled="true"
              aria-describedby="wb-approve-locked-reason"
            >
              <GavelIcon /> Approve and file
            </button>
            <p className={ui.alReason} id="wb-approve-locked-reason">
              <InfoCircleIcon /> {reason}
            </p>
          </span>
        </div>

        <StepNav
          note={{
            icon: <UserCheckIcon />,
            text: 'Verdact advises. You decide. Nothing files until your record is complete and you approve.',
          }}
          back={{ href: '#stage-review', label: 'Back to Review' }}
        />
      </>
    );
  }

  // Ready / approved / submitted state.
  const fileStatusLine = submitted
    ? 'This record has been filed. We will watch for the bank response.'
    : !approved
      ? 'Your evidence is ready. Approve it when you are.'
      : !submissionEnabled
        ? 'Approved and saved. Filing to Stripe opens after beta.'
        : !optedIn
          ? 'Approved. Turn on filing in Settings when you are ready to send.'
          : 'Approved and ready to send to Stripe.';

  const qaLine = filingBlocked
    ? `Automated checks: ${qa.blocks} to resolve before filing.`
    : qa.warns > 0
      ? `Automated checks: ${qa.warns} to review.`
      : 'Automated checks: all clear.';

  return (
    <>
      <SectionBar
        first
        icon={<ShieldIcon />}
        title="Pre-flight checks"
        note="We validate the packet before you ever approve it"
      />
      <div className={`${ui.checksRow} ${filingBlocked ? ui.blocked : ''}`}>
        {filingBlocked ? <AlertIcon /> : <CheckIcon />}
        {qaLine}
      </div>
      <div className={ui.checkList}>
        <div className={ui.checkItem}>
          <CheckIcon /> Formatting valid for Stripe submission
        </div>
        {record.due_by && !pastDeadline ? (
          <div className={ui.checkItem}>
            <CheckIcon /> Within the {formatDate(record.due_by)} response deadline
          </div>
        ) : null}
        <div className={`${ui.checkItem} ${packet.limits.withinSizeLimit ? '' : ui.warn}`}>
          {packet.limits.withinSizeLimit ? <CheckIcon /> : <AlertIcon />}
          {packet.limits.withinSizeLimit
            ? `Exhibits within size limits (${packet.limits.totalLabel})`
            : 'Combined exhibits over the size limit, trim a file'}
        </div>
      </div>

      <SectionBar
        icon={<GavelIcon />}
        title="You approve · filing stays in your hands"
        note="Nothing is sent to the bank until you say so"
      />
      <div className={ui.approveSeal}>
        <span className={ui.asIcon} aria-hidden="true">
          <GavelIcon />
        </span>
        <span className={ui.asText}>
          <span className={ui.asTitle}>{fileStatusLine}</span>
          <span className={ui.asBody}>
            <b>Nothing is sent until you approve.</b> Verdact advises. You decide, right here.
          </span>
        </span>
      </div>

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
            className="inline-flex items-center gap-2 text-sm font-semibold text-action underline underline-offset-4 hover:text-action-deep"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Export the full draft packet
          </a>
        </PaidGate>
      </div>

      <StepNav
        note={{ icon: <DownloadIcon />, text: 'Prefer to file it yourself? Export the full draft packet any time.' }}
        back={{ href: '#stage-review', label: 'Back to Review' }}
      />
    </>
  );
}

// ── The one next action (deep-field CTA) ──────────────────────────────────────
function NextAction({ plan }: { plan: ResolutionPlan }) {
  const primary = plan.routes.find((r) => r.primary) ?? plan.routes[0];
  const secondary = plan.allowUnavailable ? plan.routes.find((r) => !r.primary) : null;
  return (
    <div className={ui.nextAction}>
      <span className={ui.naSeal} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="var(--gap)"
            strokeWidth="2.2"
            strokeDasharray="2 3"
          />
          <path d="M12 7 L12 13" stroke="var(--gap)" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="16.4" r="1.2" fill="var(--gap)" />
        </svg>
      </span>
      <div className={ui.naText}>
        <p className={ui.naEyebrow}>
          <AlertIcon /> {plan.eyebrow}
        </p>
        <h3 className={ui.naHead}>{plan.title}</h3>
        <p className={ui.naSub}>{plan.why}</p>
        {secondary ? (
          <p className={ui.naSecondary}>
            <InfoCircleIcon />
            <span>{secondary.detail}</span>
            <a href="#acceptance-gap">Record it instead</a>
          </p>
        ) : null}
      </div>
      <a className={ui.naCta} href={primary?.href ?? '#add-evidence'}>
        <UploadIcon /> {primary?.label ?? 'Add evidence'}
      </a>
    </div>
  );
}

// ── Readiness band + meter ────────────────────────────────────────────────────
function ReadinessBand({
  confirmedCount,
  totalChecks,
  hasGap,
}: {
  confirmedCount: number;
  totalChecks: number;
  hasGap: boolean;
}) {
  const fillPct = totalChecks > 0 ? Math.round((confirmedCount / totalChecks) * 100) : 0;
  const gapPct = hasGap ? Math.round((1 / Math.max(totalChecks, 1)) * 100) : 0;
  const label = hasGap
    ? `${confirmedCount} confirmed. ${totalChecks - confirmedCount} left to strengthen the record.`
    : 'Every required item is confirmed.';
  return (
    <div className={ui.readiness}>
      <span className={ui.rcount}>
        {confirmedCount}
        <small> / {totalChecks}</small>
      </span>
      <span className={ui.rmid}>
        <span className={ui.rlabel}>{label}</span>
        <span
          className={ui.meter}
          role="img"
          aria-label={`${confirmedCount} of ${totalChecks} evidence items confirmed`}
        >
          <span className={ui.meterFill} style={{ width: `${fillPct}%` }} />
          <span className={ui.meterGap} style={{ width: `${gapPct}%` }} />
        </span>
      </span>
    </div>
  );
}

// ── Evidence rows derived from the readiness checks ───────────────────────────
const EV_ROW_META: Record<Exclude<ReadinessKey, 'qa_clear'>, { name: string; meta: string }> = {
  charge_attached: { name: 'Stripe charge record', meta: 'The payment under dispute' },
  delivery_proof: {
    name: 'Delivery or acceptance proof',
    meta: 'Shows the work was delivered or received',
  },
  policy: { name: 'Refund and cancellation policy', meta: 'What the customer agreed to' },
  product_description: { name: 'Product description', meta: 'What was sold' },
  narrative: { name: 'Your account of what happened', meta: 'Restated in bank language' },
};
const EV_ANCHOR: Partial<Record<ReadinessKey, string>> = {
  delivery_proof: '#add-evidence',
  policy: '/settings',
  product_description: '/settings',
  narrative: '#your-account',
};

function EvidenceRows({
  checks,
  primaryGapKey,
}: {
  checks: PacketReadinessCheck[];
  primaryGapKey: ReadinessKey | null;
}) {
  const rows = checks.filter((c) => c.key !== 'qa_clear');
  return (
    <div className={ui.evList}>
      {rows.map((c) => {
        const meta = EV_ROW_META[c.key as Exclude<ReadinessKey, 'qa_clear'>];
        if (c.done) {
          return (
            <div key={c.key} className={`${ui.evRow} ${ui.verified}`}>
              <span className={ui.evSeal} aria-hidden="true">
                <VerifiedSeal />
              </span>
              <span className={ui.evMain}>
                <span className={ui.evName}>{meta.name}</span>
                <span className={ui.evMeta}>{meta.meta}</span>
              </span>
              <span className={`${ui.evStatus} ${ui.sVerified}`}>
                <CheckIcon /> Confirmed
              </span>
            </div>
          );
        }
        const isPrimary = c.key === primaryGapKey;
        const anchor = EV_ANCHOR[c.key] ?? '#add-evidence';
        return (
          <div key={c.key} className={`${ui.evRow} ${ui.missing}`}>
            <span className={ui.evSeal} aria-hidden="true">
              <MissingSeal />
            </span>
            <span className={ui.evMain}>
              <span className={ui.evName}>{meta.name}</span>
              <span className={ui.evMeta}>
                {isPrimary ? 'The one key item left to add' : 'Not added yet'}
              </span>
            </span>
            <a className={ui.evAddBtn} href={anchor}>
              <PlusIcon /> Add
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ── Review: packet grid + exhibit strip ───────────────────────────────────────
function PacketCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={ui.packetCell}>
      <div className={ui.pkLbl}>{label}</div>
      <div className={ui.pkVal}>{value}</div>
    </div>
  );
}

function ExhibitStrip({ packet }: { packet: EvidencePacket }) {
  if (packet.exhibits.length === 0) {
    return (
      <div className={ui.exhibitStrip}>
        <span className={`${ui.exhibitChip} ${ui.pending}`}>
          <span className={ui.exNo}>0</span> No files attached yet
        </span>
      </div>
    );
  }
  return (
    <div className={ui.exhibitStrip}>
      {packet.exhibits.map((ex, i) => (
        <span key={ex.id} className={ui.exhibitChip}>
          <span className={ui.exNo}>{i + 1}</span> {ex.purposeLabel}
        </span>
      ))}
    </div>
  );
}

// ── Section caption divider ───────────────────────────────────────────────────
function SectionBar({
  icon,
  title,
  note,
  first = false,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  first?: boolean;
}) {
  return (
    <div className={`${ui.sectionBar} ${first ? ui.first : ''}`}>
      <span className={ui.sbIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={ui.sbText}>
        <span className={ui.sbTitle}>{title}</span>
        <span className={ui.sbFor}>{note}</span>
      </span>
    </div>
  );
}

// ── Step navigation footer ────────────────────────────────────────────────────
type NavLink = { href: string; label: string };
function StepNav({
  note,
  back,
  forward,
}: {
  note: { icon: React.ReactNode; text: string };
  back?: NavLink;
  forward?: NavLink;
}) {
  return (
    <div className={ui.stepNav}>
      <span className={ui.navNote}>
        {note.icon} {note.text}
      </span>
      <span className={ui.navBtns}>
        {back ? (
          <a className={ui.btnBack} href={back.href}>
            <ArrowLeftIcon /> {back.label}
          </a>
        ) : null}
        {forward ? (
          <a className={ui.btnForward} href={forward.href}>
            {forward.label} <ArrowRightIcon />
          </a>
        ) : null}
      </span>
    </div>
  );
}

// ── Seals (decorative) ────────────────────────────────────────────────────────
function VerifiedSeal() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--verdict)" strokeWidth="2.2" />
      <path
        d="M5.5 11.5 L9.5 15.5 L16.5 8.5"
        fill="none"
        stroke="var(--verdict)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MissingSeal() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="var(--gap)"
        strokeWidth="2.2"
        strokeDasharray="2 3"
      />
      <path d="M12 7 L12 13" stroke="var(--gap)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.2" fill="var(--gap)" />
    </svg>
  );
}
function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  );
}

type Blocker = { kind: 'missing' | 'todo'; href: string; name: string; detail: string; where: string };
function routeWhere(route: ResolveRoute | undefined): string {
  if (!route) return 'In Build';
  if (route.href.startsWith('/')) return 'In Settings';
  if (route.href === '#your-account') return 'In Review';
  return 'In Build';
}

// ── Detailed Review record (folded into a disclosure) ─────────────────────────
const GROUP_META: Record<EvidenceGroup, { title: string; note: string; weightedNote?: string }> = {
  work: { title: 'Work happened', note: 'Proof the service was delivered or the work was done.' },
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
          <p className="text-lg font-semibold text-ink">Evidence Record</p>
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
          <span className="mt-1 block text-[1.05rem] font-semibold leading-tight text-ink">
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
              <ArrowRightIcon className="h-3.5 w-3.5" />
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
              isMissing ? 'text-accent-deep' : 'text-ink'
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

function formatAmount(amountInCents: number | null, currency: string | null): string {
  const cents = amountInCents ?? 0;
  const code = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(cents / 100);
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

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const due = Date.parse(value);
  if (Number.isNaN(due)) return null;
  return Math.max(0, Math.ceil((due - Date.now()) / 86_400_000));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
