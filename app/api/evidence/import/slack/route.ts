import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { loadConnectedSlackToken } from '@/lib/slack/token';
import { buildSlackTranscript, getPermalink, SLACK_MESSAGE_PAGE_SIZE } from '@/lib/slack/api';

// Node runtime: node:crypto for the content hash.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'evidence-files';
const MAX_TEXT_CHARS = 12_000;

// The selected snapshot comes from the picker's single authoritative
// conversations.history read (the only rate-capped call). The import does NOT
// re-read history (that would risk a 429 right after browse); it re-fetches only
// permalinks (uncapped) to re-anchor provenance server-side. Message text is at
// the same trust level as the existing paste / upload intake paths.
const ImportSchema = z.object({
  disputeId: z.string().uuid(),
  channelId: z.string().min(1).max(64),
  channelName: z.string().min(1).max(120),
  messages: z
    .array(
      z.object({
        ts: z.string().min(1).max(40),
        author: z.string().max(120),
        authorId: z.string().max(40),
        text: z.string().max(MAX_TEXT_CHARS),
      }),
    )
    .min(1)
    .max(SLACK_MESSAGE_PAGE_SIZE),
});

export async function POST(request: Request) {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });
  }
  const merchantId = membership.merchant.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid selection.' }, { status: 422 });
  }
  const { disputeId, channelId, channelName, messages } = parsed.data;

  const supabase = await createClient();

  // Ownership (RLS also enforces this).
  const { data: dispute } = await supabase
    .from('disputes')
    .select('id')
    .eq('id', disputeId)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (!dispute) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  }

  const conn = await loadConnectedSlackToken(supabase, merchantId);
  if (!conn) {
    return NextResponse.json({ error: 'Connect Slack before importing.' }, { status: 400 });
  }

  // Re-fetch permalinks server-side for provenance (uncapped). This also
  // re-verifies the merchant's token can resolve each (channel, ts) selected.
  const withLinks = await Promise.all(
    messages.map(async (m) => {
      let permalink = '';
      try {
        permalink = await getPermalink(conn.token, channelId, m.ts);
      } catch {
        permalink = '';
      }
      return { ts: m.ts, author: m.author, authorId: m.authorId, text: m.text, permalink };
    }),
  );

  const transcript = buildSlackTranscript({ channelName, teamName: conn.teamName, messages: withLinks });
  const bytes = Buffer.from(transcript, 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  // Dedupe identical selection on this dispute (re-importing the same messages
  // is a no-op).
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

  // First path segment = merchant_id satisfies the storage RLS path policy.
  const path = `${merchantId}/${disputeId}/${sha256}.txt`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'text/plain', upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: 'Could not save the import. Please try again.' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('evidence_files')
    .insert({
      merchant_id: merchantId,
      dispute_id: disputeId,
      purpose: 'communication',
      supabase_path: path,
      content_sha256: sha256,
      content_size_bytes: bytes.byteLength,
      mime_type: 'text/plain',
      source_kind: 'slack',
      slack_connection_id: conn.connectionId,
      // Provenance anchor only: the first selected message ts. The full,
      // authoritative record is the transcript blob (identified by
      // content_sha256), which carries every selected message + its permalink;
      // for a multi-message import this column points at message[0].
      source_message_id: withLinks[0]?.ts ?? null,
      source_thread_id: channelId,
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
