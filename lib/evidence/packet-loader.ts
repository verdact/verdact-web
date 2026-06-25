import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeEvidence } from '@/lib/evidence';
import { buildEvidenceSignals } from '@/lib/evidence/build-signals';
import { enrichDisputeCharge } from '@/lib/evidence/charge-enrichment';
import { parseEvidenceDraft } from '@/lib/evidence/draft';
import { buildEvidencePacket, type EvidencePacket } from '@/lib/evidence/packet';

/**
 * Single source of truth for assembling a dispute's evidence packet.
 *
 * The PDF download route, the workbench preview, and the Stripe submit path ALL
 * build the packet from here. That is a correctness requirement, not a tidiness
 * one: the bytes filed to Stripe must be provably identical to the packet the
 * merchant previewed and approved. Re-implementing the query+assembly in the
 * submit path would let the two drift (file A, approve B).
 *
 * Pass the caller's Supabase client: the route/workbench use the RLS user client;
 * the submit path uses the service-role client. Either way the explicit
 * merchant_id filter is kept as defense in depth (the service client bypasses RLS).
 */

export interface PacketDisputeRecord {
  id: string;
  merchant_id: string;
  processor_dispute_id: string;
  processor_charge_id: string | null;
  // The Stripe account the dispute was INGESTED under (acct_...). Used by the
  // submit path to refuse filing against a different currently-connected account.
  processor_account_id: string | null;
  amount: number | null;
  currency: string | null;
  reason: string | null;
  network: string | null;
  status: string;
  due_by: string | null;
  submitted_at: string | null;
  evidence_draft: unknown;
  evidence_approved_at: string | null;
  evidence_approved_by: string | null;
  sign_off_at: string | null;
  sign_off_text_version: string | null;
  created_at: string;
}

export interface PacketEvidenceFile {
  id: string;
  purpose: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  processor_file_id: string | null;
  supabase_path: string | null;
  source_kind: string | null;
  created_at: string;
}

export interface PacketPii {
  billing_address: { country?: string | null } | null;
  customer_name: string | null;
  customer_email: string | null;
}

interface ProfileRow {
  product_description: string | null;
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  logs_user_activity: string | null;
}

export interface LoadedPacket {
  status: 'ok' | 'not_found' | 'error';
  record: PacketDisputeRecord | null;
  files: PacketEvidenceFile[];
  packet: EvidencePacket | null;
  // The merchant's currently-connected Stripe account (acct_...), or null.
  stripeAccountId: string | null;
  pii: PacketPii | null;
}

const DISPUTE_COLUMNS = [
  'id',
  'merchant_id',
  'processor_dispute_id',
  'processor_charge_id',
  'processor_account_id',
  'amount',
  'currency',
  'reason',
  'network',
  'status',
  'due_by',
  'submitted_at',
  'evidence_draft',
  'evidence_approved_at',
  'evidence_approved_by',
  'sign_off_at',
  'sign_off_text_version',
  'created_at',
  'dispute_pii ( billing_address, customer_name, customer_email )',
].join(', ');

const EMPTY: LoadedPacket = {
  status: 'not_found',
  record: null,
  files: [],
  packet: null,
  stripeAccountId: null,
  pii: null,
};

export async function loadAndBuildPacket(
  supabase: SupabaseClient,
  disputeId: string,
  merchantId: string,
): Promise<LoadedPacket> {
  const [{ data: dispute, error: disputeError }, { data: evidenceFiles }, { data: profile }, { data: connection }] =
    await Promise.all([
      supabase
        .from('disputes')
        .select(DISPUTE_COLUMNS)
        .eq('id', disputeId)
        .eq('merchant_id', merchantId)
        .maybeSingle(),
      supabase
        .from('evidence_files')
        .select(
          'id, purpose, mime_type, content_size_bytes, processor_file_id, supabase_path, source_kind, created_at',
        )
        .eq('dispute_id', disputeId)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false }),
      supabase
        .from('merchant_profiles')
        .select(
          'product_description, refund_policy_text, refund_policy_url, cancellation_policy_text, cancellation_policy_url, logs_user_activity',
        )
        .eq('merchant_id', merchantId)
        .maybeSingle(),
      supabase
        .from('processor_connections')
        .select('processor_account_id')
        .eq('merchant_id', merchantId)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle(),
    ]);

  if (disputeError) return { ...EMPTY, status: 'error' };
  if (!dispute) return { ...EMPTY, status: 'not_found' };

  const record = dispute as unknown as PacketDisputeRecord & {
    dispute_pii?: PacketPii | PacketPii[] | null;
  };
  const files = (evidenceFiles ?? []) as unknown as PacketEvidenceFile[];
  const profileRow = (profile as ProfileRow | null) ?? null;
  const piiRaw = record.dispute_pii;
  const pii = (Array.isArray(piiRaw) ? piiRaw[0] : piiRaw) ?? null;
  const stripeAccountId =
    (connection as { processor_account_id: string } | null)?.processor_account_id ?? null;

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

  return { status: 'ok', record, files, packet, stripeAccountId, pii };
}

function deriveProofFromFiles(files: PacketEvidenceFile[]): {
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

export function formatReason(reason: string | null): string {
  if (!reason) return 'Unknown reason';
  return reason.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
