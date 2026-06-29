import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createStripeClient } from '@/lib/stripe';

/**
 * Stripe File Upload handoff (POST /v1/files) for a dispute's evidence files.
 *
 * For each evidence_files row that has bytes in Storage but no Stripe file id yet,
 * download the bytes and upload them to Stripe with purpose 'dispute_evidence' ON
 * THE CONNECTED ACCOUNT, then persist the returned file id. This runs under the
 * SERVICE-ROLE client (it updates evidence_files, which only the service role can
 * write on the backend path — see migration 20260625000000).
 *
 * Idempotency comes free from the `processor_file_id is null` filter: a re-run
 * skips rows already uploaded. A per-file failure is isolated (marked 'failed',
 * left for retry) and never aborts the others.
 */

const EVIDENCE_BUCKET = 'evidence-files';

export interface StripeFileUploadResult {
  attempted: number;
  uploaded: number;
  failed: number;
  // Rows that still have bytes but no Stripe file id after this run. The submit
  // path treats >0 as "evidence incomplete" and refuses to file.
  remainingMissing: number;
}

interface EvidenceFileUploadRow {
  id: string;
  supabase_path: string | null;
  mime_type: string | null;
  purpose: string | null;
  processor_file_id: string | null;
}

export async function uploadDisputeFilesToStripe(args: {
  supabase: SupabaseClient;
  disputeId: string;
  merchantId: string;
  stripeAccountId: string;
}): Promise<StripeFileUploadResult> {
  const { supabase, disputeId, merchantId, stripeAccountId } = args;
  const stripe = createStripeClient();

  const { data, error } = await supabase
    .from('evidence_files')
    .select('id, supabase_path, mime_type, purpose, processor_file_id')
    .eq('dispute_id', disputeId)
    .eq('merchant_id', merchantId)
    .is('processor_file_id', null)
    .not('supabase_path', 'is', null);

  if (error) {
    throw new Error(`Could not list evidence files for upload: ${error.message}`);
  }

  const rows = (data ?? []) as EvidenceFileUploadRow[];
  let uploaded = 0;
  let failed = 0;

  for (const row of rows) {
    const path = row.supabase_path;
    if (!path) continue;
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(EVIDENCE_BUCKET).download(path);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message ?? 'storage download returned no data');
      }
      const bytes = Buffer.from(await blob.arrayBuffer());

      const file = await stripe.files.create(
        {
          purpose: 'dispute_evidence',
          file: {
            data: bytes,
            name: fileNameFor(row),
            type: row.mime_type ?? 'application/octet-stream',
          },
        },
        { stripeAccount: stripeAccountId },
      );

      const { error: updErr } = await supabase
        .from('evidence_files')
        .update({
          processor_file_id: file.id,
          processor: 'stripe',
          processor_uploaded_at: new Date().toISOString(),
          upload_status: 'uploaded_to_processor',
        })
        .eq('id', row.id)
        .eq('merchant_id', merchantId);

      if (updErr) {
        // The file IS in Stripe but persisting its id failed. Leave the row for
        // retry (do NOT count as uploaded). Worst case is an orphaned Stripe file
        // plus a re-upload next run, which is acceptable for evidence files.
        throw new Error(`persist of processor_file_id failed: ${updErr.message}`);
      }
      uploaded += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`[stripe-files] upload failed for evidence_file ${row.id}:`, message);
      await supabase
        .from('evidence_files')
        .update({ upload_status: 'failed' })
        .eq('id', row.id)
        .eq('merchant_id', merchantId);
    }
  }

  const { count } = await supabase
    .from('evidence_files')
    .select('id', { count: 'exact', head: true })
    .eq('dispute_id', disputeId)
    .eq('merchant_id', merchantId)
    .is('processor_file_id', null)
    .not('supabase_path', 'is', null);

  return {
    attempted: rows.length,
    uploaded,
    failed,
    remainingMissing: count ?? 0,
  };
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
};

function fileNameFor(row: EvidenceFileUploadRow): string {
  const ext = MIME_EXT[row.mime_type ?? ''] ?? 'bin';
  const purpose = (row.purpose ?? 'evidence').replace(/[^a-z0-9_]/gi, '');
  const shortId = row.id.replace(/-/g, '').slice(0, 12);
  return `verdact-${purpose}-${shortId}.${ext}`;
}
