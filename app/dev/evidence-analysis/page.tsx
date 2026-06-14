import { notFound } from 'next/navigation';
import { AppShell } from '../../_components/app-chrome';
import { EvidenceAnalysisPanels } from '../../dashboard/disputes/[id]/evidence-analysis-panels';
import { analyzeEvidence } from '@/lib/evidence';
import type { EvidenceSignals, SessionSignal } from '@/lib/evidence';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the per-dispute evidence-analysis panels (Revano-adopted
// features). The real workbench is auth-gated + DB-backed and needs real
// disputes. This route 404s in production.
//   ?case=strong   → clean, consistent, policy-bound case (no blockers)
//   ?case=mismatch → geography conflict + activity gap (filing blocked)
//   ?case=thin     → little data connected (honest degraded states)
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Evidence analysis preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function sessions(n: number, country: string, ip: string, startIso: string): SessionSignal[] {
  const out: SessionSignal[] = [];
  const start = new Date(startIso).getTime();
  for (let i = 0; i < n; i++) {
    out.push({
      at: new Date(start + i * 86400000).toISOString(),
      ip,
      country,
      action: 'Logged in',
    });
  }
  return out;
}

const STRONG: EvidenceSignals = {
  purchaseAt: '2026-01-01',
  // Sessions run from Jan 1 for 115 days, reaching ~Apr 25, right up to the
  // dispute date so there is no activity gap — a genuinely clean case.
  disputeCreatedAt: '2026-04-27',
  billingCountry: 'US',
  sessions: sessions(115, 'US', '203.0.113.7', '2026-01-01'),
  policy: {
    kind: 'refund',
    text: '30-day refund policy',
    url: null,
    effectiveAt: '2025-12-01',
    boundToPurchaseAt: '2026-01-01',
  },
  proof: { delivery: true, usage: true, comms: true },
};

const MISMATCH: EvidenceSignals = {
  purchaseAt: '2026-01-01',
  disputeCreatedAt: '2026-06-01',
  billingCountry: 'US',
  sessions: sessions(20, 'PH', '198.51.100.4', '2026-01-01'),
  policy: null,
  proof: { delivery: false, usage: true, comms: false },
};

const THIN: EvidenceSignals = {
  purchaseAt: null,
  disputeCreatedAt: '2026-05-10',
  billingCountry: null,
  sessions: [],
  policy: null,
  proof: { delivery: false, usage: false, comms: false },
};

export default async function EvidenceAnalysisPreview({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { case: which } = await searchParams;
  const signals = which === 'mismatch' ? MISMATCH : which === 'thin' ? THIN : STRONG;
  const analysis = analyzeEvidence({
    reasonCode: 'product_not_received',
    signals,
    hasChargeAttached: which !== 'thin',
    approved: which === 'strong' || which === undefined,
  });

  return (
    <AppShell email="founder@acmesoftware.com" businessName="Acme Software" active="disputes">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-6 py-8 md:px-10">
        <p className="label-mono">
          Preview case: <strong>{which ?? 'strong'}</strong> · filing blocked:{' '}
          <strong>{String(analysis.filingBlocked)}</strong>
        </p>
        <EvidenceAnalysisPanels analysis={analysis} />
      </div>
    </AppShell>
  );
}
