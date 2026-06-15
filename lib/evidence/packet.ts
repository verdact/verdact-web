/**
 * Generated evidence packet (R2 sub-stage 1) — PURE assembly, DB/SDK-free.
 *
 * Takes the dispute, the attached evidence files, the merchant's narrative, the
 * analyzer output (geo/activity/policy narratives + QA), and the business
 * profile, and produces a structured packet mapped to STRIPE NATIVE evidence
 * field names (NOT a third-party signed PDF — that is the locked submission
 * channel). The packet view renders this; the gated download serializes it.
 *
 * Honesty locks: every text field is `present: false` unless it has a real
 * value; the argument text is assembled only from narratives the analyzer marked
 * `include: true`. Nothing is invented to fill a gap.
 */

import { formatBytes, isEvidencePurpose, PURPOSE_LABELS, type EvidencePurpose } from './intake';
import type { EvidenceAnalysis } from './analyze';

// Stripe dispute.evidence file fields we map merchant uploads to. (Physical-goods
// shipping fields are intentionally omitted — this packet is for SaaS / service
// delivery.)
type StripeFileField =
  | 'service_documentation'
  | 'customer_communication'
  | 'refund_policy'
  | 'cancellation_policy'
  | 'uncategorized_file';

const PURPOSE_TO_STRIPE_FIELD: Record<EvidencePurpose, StripeFileField> = {
  service_documentation: 'service_documentation',
  communication: 'customer_communication',
  refund_policy: 'refund_policy',
  cancellation_policy: 'cancellation_policy',
  uncategorized: 'uncategorized_file',
};

// 4.5 MB combined packet ceiling (Visa/Mastercard).
const MAX_PACKET_BYTES = 4_500_000;

export interface PacketFileInput {
  id: string;
  purpose: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  created_at: string;
}

export interface PacketInput {
  dispute: {
    processorDisputeId: string;
    processorChargeId: string | null;
    amount: number | null;
    currency: string | null;
    reasonLabel: string;
    network: string | null;
    serviceDate: string | null; // purchase / delivery date
    hasChargeAttached: boolean;
  };
  customer: {
    name: string | null;
    email: string | null;
    billingCountry: string | null;
  };
  profile: {
    productDescription: string | null;
    refundPolicyText: string | null;
    refundPolicyUrl: string | null;
    cancellationPolicyText: string | null;
    cancellationPolicyUrl: string | null;
  } | null;
  files: PacketFileInput[];
  narrative: string;
  analysis: EvidenceAnalysis;
}

export interface PacketField {
  // Stripe evidence field name (what this maps to on submission).
  key: string;
  // Merchant-facing label.
  label: string;
  value: string;
  // Where the value came from (e.g. "Business profile", "Your account").
  source: string;
  present: boolean;
}

export interface PacketExhibit {
  id: string;
  name: string;
  stripeField: StripeFileField;
  purposeLabel: string;
  sizeBytes: number | null;
  mime: string | null;
}

export interface PacketReadinessCheck {
  label: string;
  done: boolean;
}

export interface EvidencePacket {
  fields: PacketField[];
  exhibits: PacketExhibit[];
  limits: {
    totalBytes: number;
    totalLabel: string;
    maxBytes: number;
    withinSizeLimit: boolean;
    fileCount: number;
  };
  readiness: {
    percent: number;
    checks: PacketReadinessCheck[];
    missing: string[];
  };
  filingBlocked: boolean;
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

// The structured argument paragraph (Stripe `uncategorized_text`): the merchant's
// account first, then each analyzer narrative the engine cleared as truthful.
function buildArgumentText(input: PacketInput): string {
  const parts: string[] = [];
  if (hasText(input.narrative)) {
    parts.push(input.narrative.trim());
  }
  for (const n of input.analysis.narratives) {
    if (n.include && hasText(n.body)) {
      parts.push(`${n.heading}: ${n.body}`);
    }
  }
  return parts.join('\n\n');
}

function policyDisclosure(text: string | null, url: string | null): string {
  if (hasText(text)) return text.trim();
  // Strip newlines / control chars so a URL cannot inject a fake section heading
  // into the serialized packet text.
  if (hasText(url)) return `Policy published at ${url.trim().replace(/[\r\n\t]/g, '')}`;
  return '';
}

export function buildEvidencePacket(input: PacketInput): EvidencePacket {
  const profile = input.profile;

  const productDescription = profile?.productDescription ?? '';
  const refundDisclosure = policyDisclosure(
    profile?.refundPolicyText ?? null,
    profile?.refundPolicyUrl ?? null,
  );
  const cancellationDisclosure = policyDisclosure(
    profile?.cancellationPolicyText ?? null,
    profile?.cancellationPolicyUrl ?? null,
  );
  const argument = buildArgumentText(input);

  const fields: PacketField[] = [
    {
      key: 'product_description',
      label: 'Product description',
      value: productDescription,
      source: 'Business profile',
      present: hasText(productDescription),
    },
    {
      key: 'customer_name',
      label: 'Customer name',
      value: input.customer.name ?? '',
      source: 'Dispute record',
      present: hasText(input.customer.name),
    },
    {
      key: 'customer_email_address',
      label: 'Customer email',
      value: input.customer.email ?? '',
      source: 'Dispute record',
      present: hasText(input.customer.email),
    },
    {
      key: 'service_date',
      label: 'Service or delivery date',
      value: input.dispute.serviceDate ?? '',
      source: 'Charge',
      present: hasText(input.dispute.serviceDate),
    },
    {
      key: 'refund_policy_disclosure',
      label: 'Refund policy disclosure',
      value: refundDisclosure,
      source: 'Business profile',
      present: hasText(refundDisclosure),
    },
    {
      key: 'cancellation_policy_disclosure',
      label: 'Cancellation policy disclosure',
      value: cancellationDisclosure,
      source: 'Business profile',
      present: hasText(cancellationDisclosure),
    },
    {
      key: 'uncategorized_text',
      label: 'The argument',
      value: argument,
      source: 'Your account + analysis',
      present: hasText(argument),
    },
  ];

  const exhibits: PacketExhibit[] = input.files.map((f) => {
    const purpose: EvidencePurpose = isEvidencePurpose(f.purpose) ? f.purpose : 'uncategorized';
    const meta = [shortMime(f.mime_type), f.content_size_bytes ? formatBytes(f.content_size_bytes) : '']
      .filter(Boolean)
      .join(', ');
    return {
      id: f.id,
      name: meta ? `${PURPOSE_LABELS[purpose]} (${meta})` : PURPOSE_LABELS[purpose],
      stripeField: PURPOSE_TO_STRIPE_FIELD[purpose],
      purposeLabel: PURPOSE_LABELS[purpose],
      sizeBytes: f.content_size_bytes,
      mime: f.mime_type,
    };
  });

  const totalBytes = input.files.reduce((sum, f) => sum + (f.content_size_bytes ?? 0), 0);

  // Readiness is computed from REAL evidence, never a fixed ladder.
  const hasDeliveryProof = input.files.some(
    (f) => f.purpose === 'service_documentation' || f.purpose === 'communication',
  );
  const hasPolicy =
    input.files.some(
      (f) => f.purpose === 'refund_policy' || f.purpose === 'cancellation_policy',
    ) ||
    hasText(refundDisclosure) ||
    hasText(cancellationDisclosure);

  const checks: PacketReadinessCheck[] = [
    { label: 'Charge attached', done: input.dispute.hasChargeAttached },
    { label: 'Delivery or acceptance proof attached', done: hasDeliveryProof },
    { label: 'Policy on file', done: hasPolicy },
    { label: 'Product description set', done: hasText(productDescription) },
    { label: 'Your account written', done: hasText(input.narrative) },
    { label: 'QA clear', done: !input.analysis.filingBlocked },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);

  return {
    fields,
    exhibits,
    limits: {
      totalBytes,
      totalLabel: formatBytes(totalBytes),
      maxBytes: MAX_PACKET_BYTES,
      withinSizeLimit: totalBytes <= MAX_PACKET_BYTES,
      fileCount: input.files.length,
    },
    readiness: {
      percent,
      checks,
      missing: checks.filter((c) => !c.done).map((c) => c.label),
    },
    filingBlocked: input.analysis.filingBlocked,
  };
}

/**
 * Plain-text serialization of the packet for the gated download. Honest, no
 * third-party PDF — just the structured fields and the exhibit manifest.
 */
export function serializePacketText(packet: EvidencePacket, header: string): string {
  const lines: string[] = [header, ''];

  for (const f of packet.fields) {
    lines.push(`## ${f.label} (${f.key})`);
    lines.push(f.present ? f.value : '[not provided yet]');
    lines.push('');
  }

  lines.push('## Exhibits');
  if (packet.exhibits.length === 0) {
    lines.push('[no files attached yet]');
  } else {
    packet.exhibits.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.name} → ${e.stripeField}`);
    });
  }
  lines.push('');
  lines.push(
    `Combined size: ${packet.limits.totalLabel} of ${formatBytes(packet.limits.maxBytes)} (${
      packet.limits.withinSizeLimit ? 'within limit' : 'over limit'
    }).`,
  );

  return lines.join('\n');
}

function shortMime(mime: string | null): string {
  if (!mime) return '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime.replace('image/', '').toUpperCase();
  if (mime === 'text/plain') return 'TXT';
  return mime;
}
