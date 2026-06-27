import { notFound } from 'next/navigation';
import { AppShell } from '../../../_components/app-chrome';
import { getLatestVampSnapshot, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { analyzeEvidence, buildChainOfIntent } from '@/lib/evidence';
import { buildEvidenceSignals } from '@/lib/evidence/build-signals';
import { enrichDisputeCharge } from '@/lib/evidence/charge-enrichment';
import { buildEvidencePacket, serializePacketText } from '@/lib/evidence/packet';
import { prepareStripeEvidence } from '@/lib/evidence/submission';
import { isSubmissionEnabled } from '@/lib/evidence/submission-flag';
import { buildResolutionPlan, strengthFromPercent } from '@/lib/evidence/resolution';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import { can } from '@/lib/entitlements';
import { parseEvidenceDraft } from '@/lib/evidence/draft';
import { WorkbenchShell, type Stage } from './workbench-shell';
import {
  CaseHomeHeader,
  WorkbenchReassurance,
  BuildStage,
  ReviewStage,
  FileStage,
  type WorkbenchData,
  type WorkbenchDispute,
  type EvidenceFile,
} from './workbench-stages';

export const metadata = {
  title: 'Evidence record · Verdact',
  description: 'Review a source-linked Verdact evidence record.',
};

export const dynamic = 'force-dynamic';

type WorkbenchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EvidenceRecordWorkbench({ params }: WorkbenchPageProps) {
  const { id } = await params;
  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    notFound();
  }

  const supabase = await createClient();
  const [
    { data: dispute, error: disputeError },
    { data: evidenceFiles },
    { data: profileRow },
    vampSnapshot,
    { data: connectionRow },
    { data: slackConnectionRow },
  ] = await Promise.all([
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
            // Nested customer PII (linked via disputes.pii_id) — billing country
            // feeds the geo/network consistency analyzer; name + email populate
            // the generated packet's Stripe customer fields.
            'dispute_pii ( billing_address, customer_name, customer_email )',
          ].join(', '),
        )
        .eq('id', id)
        .eq('merchant_id', membership.merchant.id)
        .maybeSingle(),
      supabase
        .from('evidence_files')
        .select(
          'id, purpose, upload_status, mime_type, content_size_bytes, processor_file_id, processor_uploaded_at, supabase_path, source_kind, source_thread_id, created_at',
        )
        .eq('dispute_id', id)
        .eq('merchant_id', membership.merchant.id)
        .order('created_at', { ascending: false }),
      // Does the merchant have a business profile yet? Drives the "no profile
      // yet" first-open guided state below.
      supabase
        .from('merchant_profiles')
        .select(
          'id, product_description, delivery_method, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, logs_user_activity, submission_opt_in',
        )
        .eq('merchant_id', membership.merchant.id)
        .maybeSingle(),
      getLatestVampSnapshot(),
      // Connected Stripe account — lets us best-effort enrich the charge for real
      // purchase-date / billing-country / issuing-country geo signals.
      supabase
        .from('processor_connections')
        .select('processor_account_id')
        .eq('merchant_id', membership.merchant.id)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle(),
      // Is a Slack workspace connected? Drives the in-dispute import picker's
      // connect-vs-browse state. No workspace read happens here.
      supabase
        .from('slack_connections')
        .select('id')
        .eq('merchant_id', membership.merchant.id)
        .eq('status', 'connected')
        .order('connected_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Surface a real query failure (e.g. a 403 from a missing grant / RLS) as a
  // visible, logged error instead of masking it as a 404. A genuine "no such
  // dispute for this merchant" still falls through to notFound() below.
  if (disputeError) {
    console.error('[workbench] dispute query failed:', disputeError.message);
    throw new Error(`Could not load this dispute: ${disputeError.message}`);
  }
  if (!dispute) {
    notFound();
  }

  const record = dispute as unknown as WorkbenchDispute;
  const files = (evidenceFiles ?? []) as unknown as EvidenceFile[];
  const profile = (profileRow as ProfileRow) ?? null;
  const hasProfile = profileHasContent(profile);
  const slackConnected = Boolean(slackConnectionRow);

  // ── Real geo signal: enrich from the underlying Stripe charge (best-effort) ──
  const piiRaw = (dispute as unknown as { dispute_pii?: DisputePiiRow | DisputePiiRow[] | null })
    .dispute_pii;
  const pii = (Array.isArray(piiRaw) ? piiRaw[0] : piiRaw) ?? null;
  const stripeAccountId =
    (connectionRow as { processor_account_id: string } | null)?.processor_account_id ?? null;
  const enrichment = await enrichDisputeCharge({
    chargeId: record.processor_charge_id,
    stripeAccountId,
  });
  const billingCountry = enrichment.billingCountry ?? pii?.billing_address?.country ?? null;

  // ── Entitlements seam (decision #3): resolve the Free→Paid gate per action.
  const [exportGate, submitGate, downloadGate] = await Promise.all([
    can(user, 'export_packet'),
    can(user, 'submit_to_stripe'),
    can(user, 'download_packet'),
  ]);
  const approved = Boolean(record.evidence_approved_at);
  const submitted = Boolean(record.submitted_at);
  const submissionEnabled = isSubmissionEnabled();
  const optedIn = profile?.submission_opt_in === true;
  const isClosed = ['won', 'lost', 'warning_closed'].includes(record.status);
  const submittable = record.status === 'needs_response';
  const pastDeadline = record.due_by ? Date.parse(record.due_by) < Date.now() : false;
  const businessName = membership.merchant.business_name?.trim() || null;
  const parsedDraft = parseEvidenceDraft(record.evidence_draft);
  const narrative = parsedDraft.narrative;

  // ── Per-dispute evidence analysis (Revano-adopted features) ────────────────
  const proof = deriveProofFromFiles(files);
  const { reasonCode, signals } = buildEvidenceSignals({
    dispute: {
      reason: record.reason,
      processor_charge_id: record.processor_charge_id,
      created_at: record.created_at,
      purchase_at: enrichment.purchaseAt,
      billing_country: billingCountry,
      issuing_country: enrichment.issuingCountry,
    },
    profile,
    sessions: [],
    proof,
  });
  const evidenceAnalysis = analyzeEvidence({
    reasonCode,
    signals,
    hasChargeAttached: Boolean(record.processor_charge_id),
    approved,
  });

  // ── Generated packet (free to build + view) ────────────────────────────────
  const packet = buildEvidencePacket({
    dispute: {
      processorDisputeId: record.processor_dispute_id,
      processorChargeId: record.processor_charge_id,
      amount: record.amount,
      currency: record.currency,
      reasonLabel: formatReason(record.reason),
      network: record.network,
      serviceDate: enrichment.purchaseAt ?? null,
      hasChargeAttached: Boolean(record.processor_charge_id),
    },
    customer: {
      name: pii?.customer_name ?? null,
      email: pii?.customer_email ?? null,
      billingCountry,
    },
    profile: profile
      ? {
          productDescription: profile.product_description,
          refundPolicyText: profile.refund_policy_text,
          refundPolicyUrl: profile.refund_policy_url,
          cancellationPolicyText: profile.cancellation_policy_text,
          cancellationPolicyUrl: profile.cancellation_policy_url,
        }
      : null,
    files: files.map((f) => ({
      id: f.id,
      purpose: f.purpose,
      mime_type: f.mime_type,
      content_size_bytes: f.content_size_bytes,
      created_at: f.created_at,
      processor_file_id: f.processor_file_id,
      supabase_path: f.supabase_path,
    })),
    narrative,
    analysis: evidenceAnalysis,
  });
  const readiness = submitted ? 100 : packet.readiness.percent;
  const packetText = serializePacketText(
    packet,
    `Verdact evidence packet: dispute ${record.processor_dispute_id} (${formatReason(record.reason)})`,
  );
  const downloadFilename = `verdact-packet-${record.processor_dispute_id}.txt`;
  const preparedSubmission = prepareStripeEvidence(packet);
  const stripeUploadReadyCount = packet.exhibits.length - preparedSubmission.missingStripeUploads.length;
  const stripeFieldCount = Object.keys(preparedSubmission.evidence).length;

  // ── Stage 1E: guided resolution + honest strength + case context ────────────
  const acceptance = parsedDraft.acceptanceUnavailable ?? null;
  const acceptanceNoted = Boolean(acceptance);
  const reasonProfile = getReasonProfile(reasonCode);
  const strength = strengthFromPercent(readiness);
  const confirmedCount = packet.readiness.checks.filter((c) => c.done).length;
  const totalChecks = packet.readiness.checks.length;
  const resolutionPlan = submitted
    ? null
    : buildResolutionPlan({
        missingKeys: packet.readiness.missingKeys,
        reasonCode,
        acceptanceNoted,
      });
  const customerName = pii?.customer_name?.trim() || null;
  const acceptanceConfirmed =
    files.some((f) => f.purpose === 'service_documentation' || f.purpose === 'communication') ||
    approved;

  // ── C-E2 Chain of Intent ────────────────────────────────────────────────────
  const hasDeliveryProofCheck = packet.readiness.checks.find((c) => c.key === 'delivery_proof');
  const hasPolicyCheck = packet.readiness.checks.find((c) => c.key === 'policy');
  const chainNodes = buildChainOfIntent({
    reasonCode,
    signals,
    hasChargeAttached: Boolean(record.processor_charge_id),
    hasDeliveryProof: Boolean(hasDeliveryProofCheck?.done),
    hasPolicy: Boolean(hasPolicyCheck?.done),
    acceptanceNoted,
    purchaseAt: enrichment.purchaseAt ?? null,
  });

  // ── Guided 3-stage model (Redesign 2026-06-26) ──────────────────────────────
  const defaultStage: Stage =
    submitted || isClosed ? 'file' : resolutionPlan === null ? 'review' : 'build';
  const doneState = { build: resolutionPlan === null, review: approved, file: submitted };
  const requireReviewBeforeFile = !submitted && !isClosed;
  const filingScope = `${packet.exhibits.length} ${packet.exhibits.length === 1 ? 'item' : 'items'} will be filed to Stripe`;
  // Genuinely-missing items left to add, for the honest "N to add" spine state.
  const missingCount = resolutionPlan?.actionableCount ?? 0;

  const data: WorkbenchData = {
    record,
    files,
    customerName,
    customerEmail: pii?.customer_email?.trim() || null,
    reasonProfile: { networkLabel: reasonProfile.networkLabel, shortReason: reasonProfile.shortReason },
    pastDeadline,
    filingScope,
    hasProfile,
    slackConnected,
    packet,
    readiness,
    confirmedCount,
    totalChecks,
    strength,
    resolutionPlan,
    // Keep the card mounted whenever the "I do not have this. Record why." link
    // can render (resolutionPlan.allowUnavailable), so that deep link is never a
    // dead anchor, even once the record is approved with the delivery gap open.
    showAcceptanceCard: resolutionPlan?.allowUnavailable === true || !acceptanceConfirmed,
    acceptanceNoted,
    acceptanceReason: acceptance?.reason ?? null,
    chainNodes,
    narrative,
    evidenceAnalysis,
    packetText,
    downloadFilename,
    pdfHref: `/dashboard/disputes/${record.id}/packet-pdf`,
    canDownload: downloadGate.allowed,
    reasonLabel: `${reasonProfile.networkLabel} ${reasonProfile.shortReason}`,
    vampRatio: vampSnapshot?.estimated_vamp_ratio ?? null,
    approved,
    submitted,
    isClosed,
    submittable,
    submissionEnabled,
    optedIn,
    canExport: exportGate.allowed,
    canSubmit: submitGate.allowed,
    stripeFieldCount,
    stripeUploadReadyCount,
    stripeUploadMissingCount: preparedSubmission.missingStripeUploads.length,
  };

  return (
    <AppShell email={user.email} businessName={businessName} active="disputes">
      <WorkbenchShell
        defaultStage={defaultStage}
        doneState={doneState}
        requireReviewBeforeFile={requireReviewBeforeFile}
        missingCount={missingCount}
        fileReady={resolutionPlan === null}
        header={<CaseHomeHeader data={data} />}
        reassurance={<WorkbenchReassurance data={data} />}
        buildStage={<BuildStage data={data} />}
        reviewStage={<ReviewStage data={data} />}
        fileStage={<FileStage data={data} />}
      />
    </AppShell>
  );
}

// Mirrors the merchant_profiles columns this workbench selects.
type ProfileRow = {
  id: string;
  product_description: string | null;
  delivery_method: string | null;
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  logs_user_activity: string | null;
  submission_opt_in: boolean | null;
} | null;

type DisputePiiRow = {
  billing_address: { country?: string | null } | null;
  customer_name: string | null;
  customer_email: string | null;
};

function profileHasContent(profile: ProfileRow): boolean {
  if (!profile) return false;
  return Boolean(
    profile.product_description?.trim() ||
      profile.delivery_method?.trim() ||
      profile.refund_policy_text?.trim() ||
      profile.refund_policy_url?.trim(),
  );
}

function deriveProofFromFiles(files: EvidenceFile[]): {
  delivery: boolean;
  usage: boolean;
  comms: boolean;
} {
  let delivery = false;
  let usage = false;
  let comms = false;
  for (const f of files) {
    if (f.purpose === 'communication') comms = true;
    if (f.purpose === 'service_documentation') delivery = true;
  }
  return { delivery, usage, comms };
}

function formatReason(reason: string | null) {
  if (!reason) return 'Reason pending';
  return reason.replaceAll('_', ' ');
}
