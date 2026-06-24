import { NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { analyzeEvidence } from '@/lib/evidence';
import { buildEvidenceSignals } from '@/lib/evidence/build-signals';
import { enrichDisputeCharge } from '@/lib/evidence/charge-enrichment';
import { parseEvidenceDraft } from '@/lib/evidence/draft';
import { buildEvidencePacket } from '@/lib/evidence/packet';
import { renderEvidencePacketPdf } from '@/lib/evidence/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DisputeRow = {
  id: string;
  merchant_id: string;
  processor_dispute_id: string;
  processor_charge_id: string | null;
  amount: number | null;
  currency: string | null;
  reason: string | null;
  network: string | null;
  status: string;
  evidence_draft: unknown;
  evidence_approved_at: string | null;
  created_at: string;
  dispute_pii?: DisputePiiRow | DisputePiiRow[] | null;
};

type DisputePiiRow = {
  billing_address: { country?: string | null } | null;
  customer_name: string | null;
  customer_email: string | null;
};

type EvidenceFileRow = {
  id: string;
  purpose: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  processor_file_id: string | null;
  supabase_path: string | null;
  source_kind: string | null;
  created_at: string;
};

type ProfileRow = {
  product_description: string | null;
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  logs_user_activity: string | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: dispute, error: disputeError }, { data: evidenceFiles }, { data: profile }, { data: connection }] =
    await Promise.all([
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
            'evidence_draft',
            'evidence_approved_at',
            'created_at',
            'dispute_pii ( billing_address, customer_name, customer_email )',
          ].join(', '),
        )
        .eq('id', id)
        .eq('merchant_id', membership.merchant.id)
        .maybeSingle(),
      supabase
        .from('evidence_files')
        .select(
          'id, purpose, mime_type, content_size_bytes, processor_file_id, supabase_path, source_kind, created_at',
        )
        .eq('dispute_id', id)
        .eq('merchant_id', membership.merchant.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('merchant_profiles')
        .select(
          'product_description, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, logs_user_activity',
        )
        .eq('merchant_id', membership.merchant.id)
        .maybeSingle(),
      supabase
        .from('processor_connections')
        .select('processor_account_id')
        .eq('merchant_id', membership.merchant.id)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle(),
    ]);

  if (disputeError) {
    return NextResponse.json({ error: 'Could not load this dispute.' }, { status: 500 });
  }
  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  }

  const record = dispute as unknown as DisputeRow;
  const files = ((evidenceFiles ?? []) as unknown as EvidenceFileRow[]);
  const profileRow = (profile as ProfileRow | null) ?? null;
  const piiRaw = record.dispute_pii;
  const pii = (Array.isArray(piiRaw) ? piiRaw[0] : piiRaw) ?? null;
  const stripeAccountId = (connection as { processor_account_id: string } | null)?.processor_account_id ?? null;
  const enrichment = await enrichDisputeCharge({
    chargeId: record.processor_charge_id,
    stripeAccountId,
  });
  const billingCountry = enrichment.billingCountry ?? pii?.billing_address?.country ?? null;
  const draft = parseEvidenceDraft(record.evidence_draft);
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
    profile: profileRow,
    sessions: [],
    proof,
  });
  const analysis = analyzeEvidence({
    reasonCode,
    signals,
    hasChargeAttached: Boolean(record.processor_charge_id),
    approved: Boolean(record.evidence_approved_at),
  });
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
    profile: profileRow
      ? {
          productDescription: profileRow.product_description,
          refundPolicyText: profileRow.refund_policy_text,
          refundPolicyUrl: profileRow.refund_policy_url,
          cancellationPolicyText: profileRow.cancellation_policy_text,
          cancellationPolicyUrl: profileRow.cancellation_policy_url,
        }
      : null,
    files: files.map((file) => ({
      id: file.id,
      purpose: file.purpose,
      mime_type: file.mime_type,
      content_size_bytes: file.content_size_bytes,
      created_at: file.created_at,
      processor_file_id: file.processor_file_id,
      supabase_path: file.supabase_path,
    })),
    narrative: draft.narrative,
    analysis,
  });

  const pdf = renderEvidencePacketPdf({
    packet,
    title: `Verdact evidence packet: dispute ${record.processor_dispute_id} (${formatReason(record.reason)})`,
  });
  const filename = `verdact-packet-${safeFilename(record.processor_dispute_id)}.pdf`;
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

function deriveProofFromFiles(files: EvidenceFileRow[]): {
  delivery: boolean;
  usage: boolean;
  comms: boolean;
} {
  let delivery = false;
  let comms = false;

  for (const file of files) {
    if (file.purpose === 'service_documentation') delivery = true;
    if (file.purpose === 'communication' || file.source_kind === 'slack') {
      comms = true;
      delivery = true;
    }
  }

  return { delivery, usage: false, comms };
}

function formatReason(reason: string | null): string {
  if (!reason) return 'Unknown reason';
  return reason.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'dispute';
}
