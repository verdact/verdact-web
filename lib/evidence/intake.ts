/**
 * Evidence intake — shared, PURE constants and validators (R2 sub-stage 1).
 *
 * No `server-only` here: the upload route handler AND the client uploader both
 * import this, so the MIME allowlist, size cap, and purpose enum are defined
 * exactly once. Keep it side-effect-free.
 *
 * Honesty / network locks honored: audio, video, and clickable-link formats are
 * forbidden evidence per network rules, so the allowlist is POSITIVE — only
 * documents, images, and plain text pass; everything else (executables, scripts,
 * media, unknown types) falls through and is rejected.
 */

// Mirrors the evidence_files.purpose CHECK constraint (migration 20260527091200).
export const EVIDENCE_PURPOSES = [
  'service_documentation',
  'communication',
  'refund_policy',
  'cancellation_policy',
  'uncategorized',
] as const;

export type EvidencePurpose = (typeof EVIDENCE_PURPOSES)[number];

// Merchant-facing labels for the purpose selector. Plain language, no jargon.
export const PURPOSE_LABELS: Record<EvidencePurpose, string> = {
  service_documentation: 'Proof of delivery or acceptance',
  communication: 'Customer message',
  refund_policy: 'Refund policy',
  cancellation_policy: 'Cancellation policy',
  uncategorized: 'Other evidence',
};

// One-line guidance shown under each purpose so the merchant tags correctly.
export const PURPOSE_HINTS: Record<EvidencePurpose, string> = {
  service_documentation:
    'Signed acceptance, SOW completion, delivery confirmation, or a milestone sign-off.',
  communication:
    'An email or message where the customer agreed, accepted, or used the work.',
  refund_policy: 'The refund terms the customer agreed to at purchase.',
  cancellation_policy: 'The cancellation terms the customer agreed to at purchase.',
  uncategorized: 'Anything else that supports the case.',
};

// 4.5 MB is the Visa/Mastercard COMBINED packet limit. Cap each file at the same
// hard ceiling here and let the packet module flag combined overflow.
export const MAX_EVIDENCE_FILE_BYTES = 4_500_000;

// Positive MIME allowlist → canonical file extension. Anything not present is
// rejected by the route handler.
export const ALLOWED_EVIDENCE_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'text/plain': 'txt',
};

// `accept` attribute for the file picker (extensions + MIME, for broad browser
// coverage).
export const EVIDENCE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain';

export function isAllowedEvidenceMime(mime: string | null | undefined): boolean {
  return Boolean(mime && mime in ALLOWED_EVIDENCE_MIME);
}

export function evidenceExtForMime(mime: string): string {
  return ALLOWED_EVIDENCE_MIME[mime] ?? 'bin';
}

export function isEvidencePurpose(value: string): value is EvidencePurpose {
  return (EVIDENCE_PURPOSES as readonly string[]).includes(value);
}

// Human-readable byte size (shared so the route, uploader, and packet view agree).
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Shape returned by the upload route for a persisted/deduped evidence file.
export interface UploadedEvidenceFile {
  id: string;
  purpose: string;
  upload_status: string;
  mime_type: string | null;
  content_size_bytes: number | null;
  supabase_path: string | null;
  created_at: string;
}
