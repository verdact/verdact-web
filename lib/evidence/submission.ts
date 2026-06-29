import type { EvidencePacket, PacketExhibit } from './packet';
import { fitTextFields } from './text-autofit';

export type StripeEvidencePayload = Record<string, string>;

export interface PreparedStripeEvidence {
  evidence: StripeEvidencePayload;
  textCharacterCount: number;
  missingStripeUploads: PacketExhibit[];
  duplicateFieldExhibits: PacketExhibit[];
  blockedReasons: string[];
}

const TEXT_LIMIT = 150_000;

/**
 * Pure mapping from Verdact's packet model to Stripe's dispute.evidence shape.
 *
 * This intentionally does not call Stripe. It lets the filing workflow preview
 * exactly what would be staged/submitted, and it reports the file-upload work
 * that must happen first.
 */
export function prepareStripeEvidence(packet: EvidencePacket): PreparedStripeEvidence {
  const evidence: StripeEvidencePayload = {};
  const blockedReasons: string[] = [];

  // Auto-fit: intelligently trim analyzer narratives → merchant narrative →
  // policy disclosures → product description before hitting Stripe's hard 150k
  // char limit. The hard reject below remains the final backstop for the rare
  // case where the untrimmable short fields alone still exceed the limit.
  const fittedFields = fitTextFields(packet.fields, TEXT_LIMIT);

  // Text evidence fields. Their lengths are the ONLY thing that counts toward
  // Stripe's evidence text limit. The file-upload fields added below carry Stripe
  // file ids (fil_...), which must NOT be counted as evidence text — counting them
  // both inflated the total and risked falsely blocking a valid packet.
  let textCharacterCount = 0;
  for (const field of fittedFields) {
    if (field.present && field.value.trim()) {
      const value = field.value.trim();
      evidence[field.key] = value;
      textCharacterCount += value.length;
    }
  }

  const missingStripeUploads: PacketExhibit[] = [];
  const duplicateFieldExhibits: PacketExhibit[] = [];
  const usedFileFields = new Set<string>();

  for (const exhibit of packet.exhibits) {
    if (!exhibit.processorFileId) {
      missingStripeUploads.push(exhibit);
      continue;
    }

    if (usedFileFields.has(exhibit.stripeField)) {
      duplicateFieldExhibits.push(exhibit);
      continue;
    }

    evidence[exhibit.stripeField] = exhibit.processorFileId;
    usedFileFields.add(exhibit.stripeField);
  }

  if (packet.filingBlocked) blockedReasons.push('pre_submission_qa_blocked');
  if (!packet.limits.withinSizeLimit) blockedReasons.push('evidence_file_size_limit_exceeded');
  if (missingStripeUploads.length > 0) blockedReasons.push('stripe_file_uploads_missing');
  if (duplicateFieldExhibits.length > 0) blockedReasons.push('multiple_files_for_single_stripe_field');

  if (textCharacterCount > TEXT_LIMIT) blockedReasons.push('stripe_text_character_limit_exceeded');

  return {
    evidence,
    textCharacterCount,
    missingStripeUploads,
    duplicateFieldExhibits,
    blockedReasons,
  };
}
