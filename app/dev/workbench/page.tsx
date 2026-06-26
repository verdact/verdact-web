import { notFound } from 'next/navigation';
import { AppShell } from '../../_components/app-chrome';
import { analyzeEvidence, buildChainOfIntent } from '@/lib/evidence';
import { buildEvidenceSignals } from '@/lib/evidence/build-signals';
import { buildEvidencePacket, serializePacketText, type PacketFileInput } from '@/lib/evidence/packet';
import { prepareStripeEvidence } from '@/lib/evidence/submission';
import { buildResolutionPlan, strengthFromPercent } from '@/lib/evidence/resolution';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import { WorkbenchShell, type Stage } from '../../dashboard/disputes/[id]/workbench-shell';
import {
  CaseHomeHeader,
  BuildStage,
  ReviewStage,
  FileStage,
  WorkbenchFocusCard,
  type WorkbenchData,
  type WorkbenchDispute,
  type EvidenceFile,
} from '../../dashboard/disputes/[id]/workbench-stages';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the guided 3-stage Evidence workbench (Redesign 2026-06-26).
// The real workbench is auth-gated + DB-backed; here WorkbenchData is mocked so
// the exact production components render without a session. 404s in prod.
//   default / ?state=build  → an open gap (lands in Build, focus card guides)
//   ?state=review           → evidence ready, no gap (lands in Review)
//   ?state=file             → already filed (lands in Approve and file)
// Interactions (upload / autosave / submit) need a real session and no-op here.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Workbench preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const POPULATED_FILES: PacketFileInput[] = [
  { id: 'f1', purpose: 'service_documentation', mime_type: 'application/pdf', content_size_bytes: 240_000, created_at: '2026-04-10' },
  { id: 'f2', purpose: 'communication', mime_type: 'image/png', content_size_bytes: 88_000, created_at: '2026-04-12' },
  { id: 'f3', purpose: 'refund_policy', mime_type: 'application/pdf', content_size_bytes: 52_000, created_at: '2026-04-12' },
];

const POPULATED_EVIDENCE_FILES: EvidenceFile[] = POPULATED_FILES.map((f) => ({
  id: f.id,
  purpose: f.purpose,
  upload_status: 'stored',
  mime_type: f.mime_type,
  content_size_bytes: f.content_size_bytes,
  processor_file_id: null,
  processor_uploaded_at: null,
  supabase_path: `evidence/${f.id}`,
  source_kind: f.purpose === 'communication' ? 'slack' : 'upload',
  source_thread_id: null,
  created_at: f.created_at,
}));

const NARRATIVE =
  'We delivered the onboarding over four weeks. The client logged in more than 30 times and signed off on the final milestone on April 10. The refund window had closed before the dispute.';

export default async function WorkbenchPreview({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { state } = await searchParams;
  const stage: Stage = state === 'review' ? 'review' : state === 'file' ? 'file' : 'build';
  const populated = stage !== 'build';
  const approved = stage === 'review' || stage === 'file';
  const submitted = stage === 'file';

  const files: EvidenceFile[] = populated ? POPULATED_EVIDENCE_FILES : [];
  const narrative = populated ? NARRATIVE : '';

  const profile = populated
    ? {
        id: 'prof_dev',
        product_description: 'Done-for-you onboarding implementation for B2B SaaS teams.',
        delivery_method: 'service',
        refund_policy_text: '14-day refund window from kickoff.',
        refund_policy_url: null,
        cancellation_policy_text: null,
        cancellation_policy_url: null,
        logs_user_activity: 'yes',
        submission_opt_in: false,
      }
    : null;

  const record: WorkbenchDispute = {
    id: 'dp_dev_workbench',
    merchant_id: 'm_dev',
    processor_dispute_id: 'dp_dev_workbench',
    processor_charge_id: 'ch_dev_workbench',
    amount: 4900,
    currency: 'usd',
    reason: 'product_not_received',
    network: 'visa',
    status: submitted ? 'submitted' : 'needs_response',
    due_by: '2026-07-09',
    ce3_eligible: false,
    evidence_draft: null,
    evidence_approved_at: approved ? '2026-06-26T00:00:00Z' : null,
    submitted_at: submitted ? '2026-06-26T00:00:00Z' : null,
    outcome: null,
    created_at: '2026-06-20',
    updated_at: '2026-06-26',
  };

  const { reasonCode, signals } = buildEvidenceSignals({
    dispute: {
      reason: record.reason,
      processor_charge_id: record.processor_charge_id,
      created_at: record.created_at,
      purchase_at: populated ? '2026-04-01' : null,
      billing_country: populated ? 'US' : null,
      issuing_country: populated ? 'US' : null,
    },
    profile,
    sessions: [],
    proof: {
      delivery: populated,
      usage: populated,
      comms: populated,
    },
  });

  const evidenceAnalysis = analyzeEvidence({
    reasonCode,
    signals,
    hasChargeAttached: true,
    approved,
  });

  const packet = buildEvidencePacket({
    dispute: {
      processorDisputeId: record.processor_dispute_id,
      processorChargeId: record.processor_charge_id,
      amount: record.amount,
      currency: record.currency,
      reasonLabel: 'product not received',
      network: record.network,
      serviceDate: populated ? '2026-04-01' : null,
      hasChargeAttached: true,
    },
    customer: { name: 'Jordan Lee', email: 'jordan@northwind.example', billingCountry: populated ? 'US' : null },
    profile: profile
      ? {
          productDescription: profile.product_description,
          refundPolicyText: profile.refund_policy_text,
          refundPolicyUrl: profile.refund_policy_url,
          cancellationPolicyText: profile.cancellation_policy_text,
          cancellationPolicyUrl: profile.cancellation_policy_url,
        }
      : null,
    files: populated ? POPULATED_FILES : [],
    narrative,
    analysis: evidenceAnalysis,
  });

  const readiness = submitted ? 100 : packet.readiness.percent;
  const reasonProfile = getReasonProfile(reasonCode);
  const strength = strengthFromPercent(readiness);
  const confirmedCount = packet.readiness.checks.filter((c) => c.done).length;
  const totalChecks = packet.readiness.checks.length;
  const resolutionPlan = submitted
    ? null
    : buildResolutionPlan({ missingKeys: packet.readiness.missingKeys, reasonCode, acceptanceNoted: false });
  const preparedSubmission = prepareStripeEvidence(packet);
  const stripeUploadReadyCount = packet.exhibits.length - preparedSubmission.missingStripeUploads.length;
  const acceptanceConfirmed = populated;

  const data: WorkbenchData = {
    record,
    files,
    customerName: 'Jordan Lee',
    reasonProfile: { networkLabel: reasonProfile.networkLabel, shortReason: reasonProfile.shortReason },
    pastDeadline: false,
    filingScope: `${packet.exhibits.length} ${packet.exhibits.length === 1 ? 'item' : 'items'} will be filed to Stripe`,
    hasProfile: populated,
    slackConnected: false,
    packet,
    readiness,
    confirmedCount,
    totalChecks,
    strength,
    resolutionPlan,
    showAcceptanceCard: !acceptanceConfirmed,
    acceptanceNoted: false,
    acceptanceReason: null,
    chainNodes: buildChainOfIntent({
      reasonCode,
      signals,
      hasChargeAttached: true,
      hasDeliveryProof: populated,
      hasPolicy: populated,
      acceptanceNoted: false,
      purchaseAt: populated ? '2026-04-01' : null,
    }),
    narrative,
    evidenceAnalysis,
    packetText: serializePacketText(packet, 'Verdact evidence packet: dispute dp_dev_workbench'),
    downloadFilename: 'verdact-packet-dp_dev_workbench.txt',
    pdfHref: '#',
    canDownload: true,
    reasonLabel: `${reasonProfile.networkLabel} ${reasonProfile.shortReason}`,
    vampRatio: 0.0061,
    approved,
    submitted,
    isClosed: false,
    submittable: !submitted,
    submissionEnabled: false,
    optedIn: false,
    canExport: true,
    canSubmit: true,
    stripeFieldCount: Object.keys(preparedSubmission.evidence).length,
    stripeUploadReadyCount,
    stripeUploadMissingCount: preparedSubmission.missingStripeUploads.length,
  };

  const defaultStage: Stage = submitted ? 'file' : resolutionPlan === null ? 'review' : 'build';
  const doneState = { build: resolutionPlan === null, review: approved, file: submitted };
  const stageSummaries: Record<Stage, string> = {
    build: resolutionPlan ? resolutionPlan.title : 'Your evidence is ready to review',
    review: 'The full record, exactly as the bank will read it',
    file: submitted
      ? 'This record has been filed'
      : approved
        ? 'Approved. Take the final step when you are ready'
        : 'Approve and file when you are ready',
  };

  return (
    <AppShell email="founder@acmesoftware.com" businessName="Acme Software" active="disputes">
      <CaseHomeHeader data={data} />
      <WorkbenchShell
        defaultStage={defaultStage}
        doneState={doneState}
        requireReviewBeforeFile={!submitted}
        readinessSummary={`${confirmedCount} of ${totalChecks} items confirmed`}
        stageSummaries={stageSummaries}
        focusCard={<WorkbenchFocusCard data={data} />}
        buildStage={<BuildStage data={data} />}
        reviewStage={<ReviewStage data={data} />}
        fileStage={<FileStage data={data} />}
      />
    </AppShell>
  );
}
