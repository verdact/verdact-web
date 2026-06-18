import { notFound } from 'next/navigation';
import { AppShell } from '../../../_components/app-chrome';
import { getLatestVampSnapshot, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoCircleIcon,
  LockIcon,
  ShieldIcon,
} from '../../dash-icons';
import { NoProfileFirstOpen } from './no-profile-first-open';
import { EvidenceAnalysisPanels, QaPanel } from './evidence-analysis-panels';
import { EvidenceUploader } from './evidence-uploader';
import { SlackImportPicker } from './slack-import-picker';
import { NarrativeEditor } from './narrative-editor';
import { RemoveFileButton } from './evidence-file-actions';
import { AcceptanceUnavailable } from './acceptance-unavailable';
import { ResolveMissingProof } from './resolve-missing-proof';
import { PacketView } from './packet-view';
import { analyzeEvidence, buildChainOfIntent } from '@/lib/evidence';
import { ChainOfIntentTimeline } from './chain-of-intent-timeline';
import { buildEvidenceSignals } from '@/lib/evidence/build-signals';
import { enrichDisputeCharge } from '@/lib/evidence/charge-enrichment';
import { buildEvidencePacket, serializePacketText } from '@/lib/evidence/packet';
import {
  buildResolutionPlan,
  strengthFromPercent,
  type EvidenceStrength,
  type ResolutionPlan,
} from '@/lib/evidence/resolution';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import { can } from '@/lib/entitlements';
import { PaidGate } from '../../../_components/ui/paid-gate';
import { parseEvidenceDraft } from '@/lib/evidence/draft';
import styles from './workbench.module.css';

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
  source_kind: string | null;
  source_thread_id: string | null;
  created_at: string;
};

// C-E3: merchants and banks distinguish "proof of work" from "proof the client
// accepted / received it". The acceptance group is weighted higher, so a missing
// acknowledgment surfaces as a vermilion gap. C-E4 prior-relationship rows are
// supporting (neutral when absent, never vermilion).
type EvidenceGroup = 'work' | 'acceptance' | 'supporting';

type EvidenceItem = {
  source: 'stripe' | 'gmail' | 'slack' | 'policy' | 'file' | 'missing' | 'relationship';
  label: string;
  title: string;
  detail: string;
  relevance: string;
  status: 'confirmed' | 'missing' | 'draft';
  // Which checklist group this row belongs to (C-E3). Defaults to 'work'.
  group?: EvidenceGroup;
  when?: string;
  // Present for uploaded files — enables the inline Remove control.
  fileId?: string;
  // The delivery/acceptance gap — rendered as a first-class, actionable row that
  // hosts the "mark unavailable, with a reason" control.
  acceptanceGap?: boolean;
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
          'id, product_description, delivery_method, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, logs_user_activity',
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
  // dispute for this merchant" still falls through to notFound() below. This is
  // the observability gap that made the dispute_pii grant bug present as a
  // silent 404.
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
  // Falls back to the stored billing-address country; degrades to null silently
  // when charges are disabled / access is revoked (analyzers handle the gap).
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
  // Beta-unlocked by default, so these are true today; the gate flips here, with
  // zero changes at the call sites in BottomActionBar, once billing turns on.
  const [exportGate, submitGate, downloadGate] = await Promise.all([
    can(user, 'export_packet'),
    can(user, 'submit_to_stripe'),
    can(user, 'download_packet'),
  ]);
  const approved = Boolean(record.evidence_approved_at);
  const submitted = Boolean(record.submitted_at);
  const evidenceItems = buildEvidenceItems(record, files, approved);
  const businessName = membership.merchant.business_name?.trim() || null;
  const parsedDraft = parseEvidenceDraft(record.evidence_draft);
  const narrative = parsedDraft.narrative;

  // ── Per-dispute evidence analysis (Revano-adopted features) ────────────────
  // Proof is derived conservatively from attached evidence files until the
  // workbench's explicit proof checkboxes are wired. Session/geo data is not yet
  // sourced (DB-connect roadmap), so the consistency narratives degrade to their
  // honest "not yet connected" states rather than inventing a pattern.
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
    // Session/usage events still need a usage-events source (DB-connect roadmap);
    // until then this is honestly empty and the activity analyzer degrades. The
    // geo/network analyzer now runs on the real billing + issuing country above.
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
  // Pure assembly of dispute + real files + narrative + analyzer output into
  // Stripe-native evidence fields. Readiness now comes from REAL evidence, not a
  // fixed ladder.
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
    })),
    narrative,
    analysis: evidenceAnalysis,
  });
  const readiness = submitted ? 100 : packet.readiness.percent;
  const missingCount = packet.readiness.missing.length;
  const firstMissing = packet.readiness.missing[0];
  const packetText = serializePacketText(
    packet,
    `Verdact evidence packet: dispute ${record.processor_dispute_id} (${formatReason(record.reason)})`,
  );
  const downloadFilename = `verdact-packet-${record.processor_dispute_id}.txt`;

  // ── Stage 1E: guided resolution + honest strength + case context ────────────
  // The merchant may have recorded that no formal delivery/acceptance proof
  // exists; that notes the gap (it never inflates readiness). The resolution
  // plan then guides the next real gap, or is null when nothing is actionable.
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

  // ── C-E2 Chain of Intent ────────────────────────────────────────────────────
  // The chronological story a reviewer reads: authorization first, then
  // agreement, delivery, usage, acceptance. Derived from the SAME readiness
  // checks the packet already computed, so a node is never green unless the
  // underlying proof genuinely exists. A missing authorization or acceptance
  // signal renders as a vermilion gap the merchant can close.
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

  return (
    <AppShell email={user.email} businessName={businessName} active="disputes">
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
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Source-linked evidence record. Nothing is sent to the bank until you approve.
            </p>
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
          {!hasProfile && <NoProfileFirstOpen reason={record.reason} />}

          <ReadinessCard
            readiness={readiness}
            missingCount={missingCount}
            firstMissing={firstMissing}
            submitted={submitted}
            dueBy={record.due_by}
            strength={strength}
            confirmedCount={confirmedCount}
            totalChecks={totalChecks}
            networkLabel={reasonProfile.networkLabel}
          />

          {/* Inline-tip slot (spec 3.2-B): ONE honesty-gated, case-specific
              guidance tip near the readiness block. Grounded only in state the
              page already computed (readiness, the resolution plan, submitted),
              so it never invents a blocker. No percentages, no em dashes. */}
          <WorkbenchTip plan={resolutionPlan} submitted={submitted} />

          {resolutionPlan && <ResolveMissingProof plan={resolutionPlan} />}

          <div id="add-evidence" className="scroll-mt-24 space-y-5">
            <EvidenceUploader disputeId={record.id} tone={resolutionPlan ? 'tool' : 'lead'} />
            <div id="import-slack" className="scroll-mt-24">
              <SlackImportPicker disputeId={record.id} slackConnected={slackConnected} />
            </div>
          </div>

          <EvidenceRecord
            items={evidenceItems}
            disputeId={record.id}
            acceptanceNoted={acceptanceNoted}
            acceptanceReason={acceptance?.reason ?? null}
          />

          <ChainOfIntentTimeline nodes={chainNodes} />

          <div id="your-account" className="scroll-mt-24">
            <NarrativeEditor disputeId={record.id} initialNarrative={narrative} />
          </div>

          <EvidenceAnalysisPanels analysis={evidenceAnalysis} />

          <PacketView
            packet={packet}
            canDownload={downloadGate.allowed}
            packetText={packetText}
            downloadFilename={downloadFilename}
            reasonLabel={`${reasonProfile.networkLabel} ${reasonProfile.shortReason}`}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <QaPanel analysis={evidenceAnalysis} />
          <AccountRiskPanel ratio={vampSnapshot?.estimated_vamp_ratio ?? null} />
        </aside>
      </section>

      <BottomActionBar
        approved={approved}
        submitted={submitted}
        canExport={exportGate.allowed}
        canSubmit={submitGate.allowed}
        resolveCount={resolutionPlan?.actionableCount ?? 0}
      />
    </AppShell>
  );
}

function ReadinessCard({
  readiness,
  missingCount,
  firstMissing,
  submitted,
  dueBy,
  strength,
  confirmedCount,
  totalChecks,
  networkLabel,
}: {
  readiness: number;
  missingCount: number;
  firstMissing?: string;
  submitted: boolean;
  dueBy: string | null;
  strength: EvidenceStrength;
  confirmedCount: number;
  totalChecks: number;
  networkLabel: string;
}) {
  const ready = submitted || missingCount === 0;
  const title = submitted
    ? 'This record has been submitted.'
    : ready
      ? 'Filing-ready record.'
      : `${confirmedCount} of ${totalChecks} expected items confirmed.`;
  const sub = submitted
    ? 'The evidence below is the record that was submitted to the processor.'
    : ready
      ? 'All expected items are confirmed and source-linked. Review the controls below before you file.'
      : 'Resolve the open items below to strengthen this record. Each item is source-linked, and nothing is sent until you approve.';

  return (
    <section className={`${styles.card} ${styles.cardLead} overflow-hidden`}>
      <div className="grid gap-6 border-b border-rule px-6 py-6 sm:grid-cols-[108px_1fr]">
        <ReadinessDial value={readiness} />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            {submitted ? (
              <span className={`${styles.pillVerdict} w-fit`}>
                <CheckIcon className="h-3 w-3" />
                Submitted
              </span>
            ) : (
              <span className={`${strengthPillClass(strength.tone)} w-fit`}>
                {strength.tone === 'trust' ? (
                  <CheckIcon className="h-3 w-3" />
                ) : (
                  <AlertIcon className="h-3 w-3" />
                )}
                {strength.label}
              </span>
            )}
            <span className={styles.labelMono}>
              Evidence completeness for {networkLabel}. Not a win prediction.
            </span>
          </div>
          <h2 className={`${styles.fontDisplay} mt-4 text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{sub}</p>
        </div>
      </div>

      <div className="grid border-t border-rule sm:grid-cols-3">
        <ReadinessFact
          icon={<AlertIcon className="h-3.5 w-3.5" />}
          label="Blocker"
          value={missingCount > 0 ? (firstMissing ?? 'Open item') : 'None open'}
          tone={missingCount > 0 ? 'warn' : 'ok'}
        />
        <ReadinessFact
          icon={<ChevronRightIcon className="h-3.5 w-3.5" />}
          label="Next action"
          value={missingCount > 0 ? 'Add the missing item' : 'Review controls'}
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

// Inline workbench tip (spec 3.2-B): at most ONE case-specific guidance line near
// the readiness block. When a real closeable gap exists, name the single
// highest-priority blocker (the SAME one the resolution plan is guiding, so it is
// always traced to this case) in vermilion and link to #resolve. When the record
// is filing-ready or submitted, show the calm verdict-green note instead. No
// percentages or numbers; no em dashes.
function WorkbenchTip({
  plan,
  submitted,
}: {
  plan: ResolutionPlan | null;
  submitted: boolean;
}) {
  if (submitted || !plan) {
    return (
      <div className={`${styles.card} flex items-start gap-3 px-5 py-4`}>
        <span className={`${styles.statusDotOk} mt-0.5 h-5 w-5`} aria-hidden="true">
          <CheckIcon className="h-3 w-3" />
        </span>
        <p className="text-sm leading-6 text-ink-soft">
          <span className="font-semibold text-trust">Filing-ready.</span> Nothing is filed without
          you.
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.surfaceGap} flex items-start gap-3 px-5 py-4`}>
      <span className={`${styles.statusDotGap} mt-0.5 h-5 w-5`} aria-hidden="true">
        <AlertIcon className="h-3 w-3" />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-6 text-ink-soft">
        <span className="font-semibold text-accent-deep">{plan.title}.</span> Adding it lifts this
        record toward filing-ready. Verdact advises, you decide, and nothing is filed without you.{' '}
        <a
          href="#resolve"
          className="font-semibold text-action underline underline-offset-4 hover:text-action-deep"
        >
          Resolve this item
        </a>
      </p>
    </div>
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
        <span className={`${styles.fontDisplay} text-[2rem] font-semibold leading-none text-ink`}>
          {value}%
        </span>
        <span className={`${styles.labelMono} mt-1 text-[0.62rem]`}>Ready</span>
      </div>
    </div>
  );
}

function strengthPillClass(tone: EvidenceStrength['tone']): string {
  if (tone === 'trust') return styles.pillVerdict;
  if (tone === 'warning') return styles.pillWarning;
  return styles.pillNeutral;
}

// C-E3: the checklist is split into the two groups merchants and banks
// distinguish. "Client accepted or received" is weighted higher (banks reject
// activity-only proof), so it renders second and carries the acceptance gap.
const GROUP_META: Record<EvidenceGroup, { title: string; note: string }> = {
  work: {
    title: 'Work happened',
    note: 'Proof the service was delivered or the work was done.',
  },
  acceptance: {
    title: 'Client accepted or received it',
    note: 'Proof the customer acknowledged or received the delivery. Banks weigh this most.',
  },
  supporting: {
    title: 'Supporting',
    note: 'Extra context that backs up the record without being required.',
  },
};

const GROUP_ORDER: EvidenceGroup[] = ['work', 'acceptance', 'supporting'];

function EvidenceRecord({
  items,
  disputeId,
  acceptanceNoted,
  acceptanceReason,
}: {
  items: EvidenceItem[];
  disputeId: string;
  acceptanceNoted: boolean;
  acceptanceReason: string | null;
}) {
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
          <p className={`${styles.labelMono} mt-1.5`}>
            Source-linked. Nothing submitted until you approve.
          </p>
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
          const weighted = group === 'acceptance';
          return (
            <div key={group} className="border-b border-rule py-2 last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-2 pb-1 pt-3">
                <p className="text-sm font-semibold text-ink">{meta.title}</p>
                {weighted ? (
                  <span className={styles.labelMono}>Weighted highest</span>
                ) : null}
              </div>
              <p className={`${styles.labelMono} pb-1`}>{meta.note}</p>
              {rows.map((item) =>
                item.acceptanceGap ? (
                  <AcceptanceGapRow
                    key="acceptance-gap"
                    item={item}
                    disputeId={disputeId}
                    noted={acceptanceNoted}
                    reason={acceptanceReason}
                  />
                ) : (
                  <EvidenceItemRow
                    key={item.fileId ? `file-${item.fileId}` : `${item.source}-${item.title}`}
                    item={item}
                    disputeId={disputeId}
                  />
                ),
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AcceptanceGapRow({
  item,
  disputeId,
  noted,
  reason,
}: {
  item: EvidenceItem;
  disputeId: string;
  noted: boolean;
  reason: string | null;
}) {
  return (
    <details
      id="acceptance-gap"
      className={`scroll-mt-24 border-b border-rule last:border-b-0 ${
        noted ? '' : `${styles.surfaceGap} -mx-6 my-2 px-6`
      }`}
      open
    >
      <summary className="grid cursor-pointer list-none grid-cols-[1.5rem_1fr_auto] items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
        {noted ? (
          <span
            className={`${styles.statusDotNeutral} h-5 w-5`}
            aria-hidden="true"
          >
            <InfoCircleIcon className="h-3 w-3" />
          </span>
        ) : (
          <span className={`${styles.statusDotGap} h-5 w-5`} aria-hidden="true">
            <AlertIcon className="h-3 w-3" />
          </span>
        )}
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={noted ? styles.srcTag : styles.srcTagGap}>
              {noted ? 'NOTED · UNAVAILABLE' : item.label}
            </span>
          </span>
          <span
            className={`mt-1.5 block text-sm font-semibold leading-snug ${
              noted ? 'text-ink' : `${styles.fontDisplay} text-[1rem] text-accent-deep`
            }`}
          >
            {item.title}
          </span>
        </span>
        <span className={noted ? styles.pillNeutral : styles.pillGap}>
          {noted ? <InfoCircleIcon className="h-3 w-3" /> : <AlertIcon className="h-3 w-3" />}
          {noted ? 'Noted' : 'Action needed'}
        </span>
      </summary>
      <div className="pb-5 pl-10">
        <p className="border-l-2 border-rule-strong pl-3 text-sm leading-6 text-ink-soft">
          {item.detail}
        </p>
        {!noted ? (
          <>
            {/* C-E3 (spec 5.3): the acceptance group is what the bank weighs most,
                so prompt manual-first for the exact confirmation message rather
                than a lone generic CTA. Grounded in the same open acceptance-gap
                state already computed for this row; nothing fabricated. */}
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Paste or upload the exact email or message where the customer confirmed they received
              or accepted it. This is the item the bank weighs most.
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <a
                href="#add-evidence"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
                Paste or upload the confirmation
              </a>
              <a
                href="#resolve"
                className="inline-flex items-center gap-2 rounded-md border border-rule-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-action hover:bg-action-soft"
              >
                See guided steps
              </a>
            </div>
          </>
        ) : null}
        <AcceptanceUnavailable disputeId={disputeId} noted={noted} reason={reason} />
      </div>
    </details>
  );
}

function EvidenceItemRow({ item, disputeId }: { item: EvidenceItem; disputeId: string }) {
  const isMissing = item.status === 'missing';
  // A "draft" (not-yet-supplied supporting/policy row) is neutral, not a gap:
  // only a genuinely missing required item is vermilion.
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
        <p className={styles.labelMonoStrong}>Account risk</p>
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
              VAMP ratio {ratio == null ? 'not calculated yet' : formatVampRatio(ratio)}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-mute">
              Account-level monitoring stays separate from this case evidence.
            </p>
          </div>
        </div>
        <details className="mt-4 border-t border-rule pt-3">
          <summary className={`${styles.labelMono} cursor-pointer text-action`}>VAMP detail</summary>
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
  canExport,
  canSubmit,
  resolveCount,
}: {
  approved: boolean;
  submitted: boolean;
  canExport: boolean;
  canSubmit: boolean;
  resolveCount: number;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-rule-strong bg-surface-2 text-ink-soft">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-4 px-6 py-4 md:px-10">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-action-rule bg-action-soft text-action">
          <LockIcon className="h-4 w-4" />
        </span>
        <p className="min-w-[240px] flex-1 text-sm leading-6">
          <span className="font-semibold text-ink">
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
        {resolveCount > 0 && !submitted ? (
          <a
            href="#resolve"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
            Resolve {resolveCount} {resolveCount === 1 ? 'issue' : 'issues'}
          </a>
        ) : null}
        {/* Free→Paid gate routes through `can()`; beta-unlocked today so the real
            buttons render unchanged, gated affordance appears once billing lands.
            During beta these controls are view-only — the labels say so and the
            real submission path stays unwired. */}
        <PaidGate action="export_packet" allowed={canExport}>
          <button
            className="rounded-md border border-rule-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled
            title="Use the packet view above to copy or download the draft during beta."
          >
            Export draft (view-only)
          </button>
        </PaidGate>
        <PaidGate action="submit_to_stripe" allowed={canSubmit} previewAvailable={false}>
          {/* Submission is intentionally inert during beta — the real Stripe
              filing channel is not wired. Disabled so it never reads as a live
              action; the Locked badge makes the gated state explicit. */}
          <button
            className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled
            title={
              submitted
                ? 'This record has already been submitted.'
                : 'Submission is wired in a later stage. Nothing is sent to the bank during beta.'
            }
          >
            Review and submit
            <span className="rounded-sm bg-white/20 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em]">
              Locked
            </span>
          </button>
        </PaidGate>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ');
  if (status === 'needs_response') {
    // A live respond-by deadline is a genuine merchant-closable gap: vermilion.
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
      <p className={`${styles.labelMono} flex items-center gap-2`}>
        {icon}
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-semibold leading-5 ${
          tone === 'warn' ? 'text-accent-deep' : tone === 'ok' ? 'text-trust' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {note ? <p className={`${styles.metaMono} mt-1`}>{note}</p> : null}
    </div>
  );
}

// Mirrors the merchant_profiles columns this workbench selects. Widened from the
// earlier 5-field shape so buildEvidenceSignals (which reads cancellation policy
// + activity logging) consumes it directly, with no inline cast at the call site.
type ProfileRow = {
  id: string;
  product_description: string | null;
  delivery_method: string | null;
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  logs_user_activity: string | null;
} | null;

// Nested customer PII selected via the disputes.pii_id relationship. billing_address
// is jsonb; the country feeds the geo/network analyzer, name + email the packet.
type DisputePiiRow = {
  billing_address: { country?: string | null } | null;
  customer_name: string | null;
  customer_email: string | null;
};

// A profile "exists" for first-open purposes only if it carries the context the
// evidence record actually leans on. An empty row created by some other flow
// should still trigger the guided state.
function profileHasContent(profile: ProfileRow): boolean {
  if (!profile) return false;
  return Boolean(
    profile.product_description?.trim() ||
      profile.delivery_method?.trim() ||
      profile.refund_policy_text?.trim() ||
      profile.refund_policy_url?.trim(),
  );
}

// The Evidence Record is driven by REAL attached files: every uploaded file is a
// confirmed, source-linked, removable row; the policy + acceptance lines reflect
// what is actually on file, and the acceptance gap only shows when it is real.
function buildEvidenceItems(
  record: WorkbenchDispute,
  files: EvidenceFile[],
  approved: boolean,
): EvidenceItem[] {
  const fileItems: EvidenceItem[] = files.map((file) => {
    const isSlack = file.source_kind === 'slack';
    // Communication / Slack proof is the customer accepting or acknowledging;
    // service docs and policies are proof the work happened (C-E3 grouping).
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

  // Mirror buildEvidencePacket's delivery_proof check (packet.ts): a
  // communication file (an imported Slack thread or a pasted message) satisfies
  // acceptance proof too, so the acceptance-gap row clears in lockstep with the
  // readiness dial. Keeping these in sync avoids a "dial up but still missing"
  // contradiction.
  const hasAcceptance = files.some(
    (f) => f.purpose === 'service_documentation' || f.purpose === 'communication',
  );
  const hasPolicyFile = files.some(
    (f) => f.purpose === 'refund_policy' || f.purpose === 'cancellation_policy',
  );
  const acceptanceConfirmed = hasAcceptance || approved;

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

  // C-E4 Prior relationship — concrete compelling evidence merchants already
  // cite. Supporting, not required: present reads verdict-green, absent stays
  // neutral (never vermilion, since its absence is not a closable gap).
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

  // Only surface the acceptance gap when it is genuinely missing. Rendered as a
  // first-class, actionable row (AcceptanceGapRow) that can be resolved above or
  // marked unavailable with a reason.
  if (!acceptanceConfirmed) {
    items.push({
      source: 'missing',
      label: 'MISSING · RECOMMENDED',
      group: 'acceptance',
      title: 'Delivery or acceptance proof',
      detail:
        'A dated delivery confirmation or signed acceptance is the strongest proof for a services dispute. Resolve it above, or record why it is unavailable.',
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

// Conservative proof read from attached evidence files, until the workbench's
// explicit proof checkboxes are wired. A communication file → comms; a service
// documentation / policy file → delivery. Absent files → all false (honest).
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
