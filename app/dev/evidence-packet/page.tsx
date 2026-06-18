import { notFound } from 'next/navigation';
import { AppShell } from '../../_components/app-chrome';
import { EvidenceUploader } from '../../dashboard/disputes/[id]/evidence-uploader';
import { NarrativeEditor } from '../../dashboard/disputes/[id]/narrative-editor';
import { PacketView } from '../../dashboard/disputes/[id]/packet-view';
import { ResolveMissingProof } from '../../dashboard/disputes/[id]/resolve-missing-proof';
import { AcceptanceUnavailable } from '../../dashboard/disputes/[id]/acceptance-unavailable';
import { EvidenceAnalysisPanels, QaPanel } from '../../dashboard/disputes/[id]/evidence-analysis-panels';
import { analyzeEvidence } from '@/lib/evidence';
import type { EvidenceSignals, SessionSignal } from '@/lib/evidence';
import {
  buildEvidencePacket,
  serializePacketText,
  type PacketFileInput,
} from '@/lib/evidence/packet';
import { buildResolutionPlan, strengthFromPercent } from '@/lib/evidence/resolution';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the R2 S1 evidence-intake surfaces (uploader, narrative
// editor, generated packet view). The real workbench is auth-gated + DB-backed;
// here the data is mocked so the UI renders without a session. 404s in prod.
//   default     → a populated packet (files + narrative + profile), download open
//   ?gated=1    → the Paid-gated download state (watermarked-preview copy)
//   ?empty=1    → no files / no narrative (honest "not provided yet" + blocked)
// Interactions (upload / autosave) need a real session and will no-op here.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Evidence packet preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DISPUTE_ID = 'dp_test_packet';

function sessions(n: number, country: string, startIso: string): SessionSignal[] {
  const out: SessionSignal[] = [];
  const start = new Date(startIso).getTime();
  for (let i = 0; i < n; i++) {
    out.push({ at: new Date(start + i * 86400000).toISOString(), country, action: 'Logged in' });
  }
  return out;
}

const POPULATED_FILES: PacketFileInput[] = [
  {
    id: 'f1',
    purpose: 'service_documentation',
    mime_type: 'application/pdf',
    content_size_bytes: 240_000,
    created_at: '2026-04-10',
  },
  {
    id: 'f2',
    purpose: 'communication',
    mime_type: 'image/png',
    content_size_bytes: 88_000,
    created_at: '2026-04-12',
  },
  {
    id: 'f3',
    purpose: 'refund_policy',
    mime_type: 'application/pdf',
    content_size_bytes: 52_000,
    created_at: '2026-04-12',
  },
];

const SIGNALS_STRONG: EvidenceSignals = {
  purchaseAt: '2026-04-01',
  disputeCreatedAt: '2026-04-28',
  billingCountry: 'US',
  issuingCountry: 'US',
  sessions: sessions(26, 'US', '2026-04-01'),
  policy: {
    kind: 'refund',
    text: '14-day refund window from kickoff.',
    url: null,
    effectiveAt: '2026-03-01',
    boundToPurchaseAt: '2026-04-01',
  },
  proof: { delivery: true, usage: true, comms: true },
};

const SIGNALS_THIN: EvidenceSignals = {
  purchaseAt: null,
  disputeCreatedAt: '2026-05-10',
  billingCountry: null,
  issuingCountry: null,
  sessions: [],
  policy: null,
  proof: { delivery: false, usage: false, comms: false },
};

const NARRATIVE_POPULATED =
  'We delivered the onboarding over four weeks. The client logged in more than 30 times and signed off on the final milestone on April 10. The refund window had closed before the dispute.';

export default async function EvidencePacketPreview({
  searchParams,
}: {
  searchParams: Promise<{ gated?: string; empty?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { gated, empty } = await searchParams;
  const isEmpty = empty === '1';
  const canDownload = gated !== '1';

  const analysis = analyzeEvidence({
    reasonCode: 'product_not_received',
    signals: isEmpty ? SIGNALS_THIN : SIGNALS_STRONG,
    hasChargeAttached: !isEmpty,
    approved: !isEmpty,
  });

  const packet = buildEvidencePacket({
    dispute: {
      processorDisputeId: 'dp_test_packet',
      processorChargeId: isEmpty ? null : 'ch_test_packet',
      amount: 48_000,
      currency: 'usd',
      reasonLabel: 'product not received',
      network: 'visa',
      serviceDate: isEmpty ? null : '2026-04-01',
      hasChargeAttached: !isEmpty,
    },
    customer: {
      name: isEmpty ? null : 'Jordan Lee',
      email: isEmpty ? null : 'jordan@northwind.example',
      billingCountry: isEmpty ? null : 'US',
    },
    profile: isEmpty
      ? null
      : {
          productDescription: 'Done-for-you onboarding implementation for B2B SaaS teams.',
          refundPolicyText: '14-day refund window from kickoff.',
          refundPolicyUrl: null,
          cancellationPolicyText: null,
          cancellationPolicyUrl: null,
        },
    files: isEmpty ? [] : POPULATED_FILES,
    narrative: isEmpty ? '' : NARRATIVE_POPULATED,
    analysis,
  });

  const packetText = serializePacketText(packet, 'Verdact evidence packet — dispute dp_test_packet');

  // Stage 1E derived values (mirrors the real workbench).
  const plan = buildResolutionPlan({
    missingKeys: packet.readiness.missingKeys,
    reasonCode: 'product_not_received',
    acceptanceNoted: false,
  });
  const strength = strengthFromPercent(packet.readiness.percent);

  return (
    <AppShell email="founder@acmesoftware.com" businessName="Acme Software" active="disputes">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
        <p className="label-mono mb-5">
          Preview: <strong>{isEmpty ? 'empty' : 'populated'}</strong> · download gate:{' '}
          <strong>{canDownload ? 'open' : 'gated'}</strong> · filing blocked:{' '}
          <strong>{String(packet.filingBlocked)}</strong> · strength:{' '}
          <strong>{strength.label}</strong> · resolve plan:{' '}
          <strong>{plan ? `${plan.key} (${plan.actionableCount})` : 'none'}</strong>
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {plan && <ResolveMissingProof plan={plan} />}
            <EvidenceUploader disputeId={DISPUTE_ID} tone={plan ? 'tool' : 'lead'} />
            <NarrativeEditor
              disputeId={DISPUTE_ID}
              initialNarrative={isEmpty ? '' : NARRATIVE_POPULATED}
            />
            <EvidenceAnalysisPanels analysis={analysis} />
            <PacketView
              packet={packet}
              canDownload={canDownload}
              packetText={packetText}
              downloadFilename="verdact-packet-dp_test_packet.txt"
              reasonLabel="Visa product not received"
            />
            <section className="surface-card overflow-hidden">
              <header className="border-b border-rule px-5 py-4">
                <p className="label-mono-strong">Acceptance control · both states (dev)</p>
              </header>
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-ink">Not noted</p>
                <AcceptanceUnavailable disputeId={DISPUTE_ID} noted={false} reason={null} />
                <p className="mt-5 text-sm font-semibold text-ink">Noted</p>
                <AcceptanceUnavailable
                  disputeId={DISPUTE_ID}
                  noted
                  reason="Approved verbally on a call; no signed document was ever produced."
                />
              </div>
            </section>
          </div>
          <aside className="space-y-5 lg:sticky lg:top-6">
            <QaPanel analysis={analysis} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
