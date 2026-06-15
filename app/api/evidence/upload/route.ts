import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import {
  MAX_EVIDENCE_FILE_BYTES,
  evidenceExtForMime,
  isAllowedEvidenceMime,
  isEvidencePurpose,
} from '@/lib/evidence/intake';

// Node runtime: uses node:crypto for the content hash and reads the file bytes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'evidence-files';
// Allow the 4.5 MB file plus multipart envelope overhead.
const MAX_BODY_BYTES = MAX_EVIDENCE_FILE_BYTES + 500_000;

/**
 * Authenticated evidence-upload endpoint (R2 sub-stage 1).
 *
 * Flow:
 *  1. Auth (session + merchant membership).
 *  2. Size guard from content-length before reading the body.
 *  3. Parse multipart form; validate file (type allowlist + magic bytes, size)
 *     + purpose.
 *  4. Confirm the dispute belongs to the merchant.
 *  5. Hash bytes (sha256) for integrity + dedupe.
 *  6. Dedupe: identical content already on this dispute → return it, no re-upload.
 *  7. Upload to the PRIVATE bucket at {merchant_id}/{dispute_id}/{sha}.{ext}
 *     (first path segment = merchant_id satisfies the storage RLS path policy).
 *  8. Insert the evidence_files row; clean up the blob if the insert fails.
 *
 * Every DB / storage call runs through the user's RLS-scoped client — a merchant
 * can only ever write to its own dispute. No service-role in this path.
 */
export async function POST(request: Request) {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });
  }
  const merchantId = membership.merchant.id;

  // Advisory fast-reject when the client declares an oversized body. It is NOT
  // the authoritative cap (a missing / chunked Content-Length skips it) — the
  // per-file size check below is authoritative, and the serverless platform
  // bounds the request body Verdact will buffer. Keep both.
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'File is too large. The limit is 4.5 MB.' }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 });
  }

  const file = form.get('file');
  const disputeId = String(form.get('disputeId') ?? '').trim();
  const purposeRaw = String(form.get('purpose') ?? 'uncategorized').trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
  }
  if (!disputeId) {
    return NextResponse.json({ error: 'Missing dispute reference.' }, { status: 400 });
  }
  const purpose = isEvidencePurpose(purposeRaw) ? purposeRaw : 'uncategorized';

  if (!isAllowedEvidenceMime(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a PDF, image (PNG, JPG, or WebP), or text file.' },
      { status: 415 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  }
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return NextResponse.json({ error: 'File is too large. The limit is 4.5 MB.' }, { status: 413 });
  }

  const supabase = await createClient();

  // Confirm ownership up front for a clean 404 (RLS also enforces this).
  const { data: dispute } = await supabase
    .from('disputes')
    .select('id')
    .eq('id', disputeId)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Defense in depth: the declared MIME passed the allowlist, but verify the
  // file actually starts with the matching magic signature so a renamed
  // executable cannot masquerade as an allowed type.
  if (!hasMatchingMagicBytes(bytes, file.type)) {
    return NextResponse.json(
      { error: 'That file does not look like a valid PDF, image, or text file.' },
      { status: 415 },
    );
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const { data: existing } = await supabase
    .from('evidence_files')
    .select('id, purpose, upload_status, mime_type, content_size_bytes, created_at')
    .eq('merchant_id', merchantId)
    .eq('dispute_id', disputeId)
    .eq('content_sha256', sha256)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, deduped: true, file: existing });
  }

  const ext = evidenceExtForMime(file.type);
  const path = `${merchantId}/${disputeId}/${sha256}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('evidence_files')
    .insert({
      merchant_id: merchantId,
      dispute_id: disputeId,
      purpose,
      supabase_path: path,
      content_sha256: sha256,
      content_size_bytes: file.size,
      mime_type: file.type,
      source_kind: 'upload',
      upload_status: 'uploaded_local',
    })
    .select('id, purpose, upload_status, mime_type, content_size_bytes, created_at')
    .single();

  if (insertError || !inserted) {
    // Never leave an orphaned blob behind a failed metadata write.
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: 'Could not save the evidence record.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, file: inserted });
}

// Validates the leading bytes against the declared MIME. text/plain has no
// reliable signature, so it relies on the MIME allowlist alone.
function hasMatchingMagicBytes(bytes: Buffer, mime: string): boolean {
  if (bytes.length < 4) return false;
  switch (mime) {
    case 'application/pdf':
      return bytes.subarray(0, 4).toString('latin1') === '%PDF';
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/webp':
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
        bytes.subarray(8, 12).toString('latin1') === 'WEBP'
      );
    case 'text/plain':
      return true;
    default:
      return false;
  }
}
