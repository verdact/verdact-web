import { NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { loadConnectedSlackToken } from '@/lib/slack/token';
import { fetchChannelMessages, SlackApiError, SlackRateLimitError } from '@/lib/slack/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns one rate-limited page of recent messages for a single channel the
// merchant opened. Each call is one rate-capped conversations.history page
// (1/min, 15 objects for unlisted external installs). The picker only calls this
// on an explicit channel-open or "Load older" click, never automatically or in
// parallel, and a 429 is surfaced (below) for the merchant to retry. Never reads
// any channel other than the one requested.
export async function GET(request: Request) {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get('channelId') ?? '').trim();
  const cursor = (searchParams.get('cursor') ?? '').trim() || undefined;
  if (!channelId || channelId.length > 64) {
    return NextResponse.json({ error: 'Missing channel.' }, { status: 400 });
  }

  const supabase = await createClient();
  const conn = await loadConnectedSlackToken(supabase, membership.merchant.id);
  if (!conn) return NextResponse.json({ connected: false }, { status: 200 });

  try {
    const { messages, nextCursor } = await fetchChannelMessages({ token: conn.token, channelId, cursor });
    return NextResponse.json({ connected: true, messages, nextCursor: nextCursor ?? null });
  } catch (err) {
    if (err instanceof SlackRateLimitError) {
      return NextResponse.json(
        {
          error: 'Slack limits message reads to about once a minute for this app. Try again shortly.',
          retryAfter: err.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
    if (err instanceof SlackApiError) {
      console.error('[slack/messages] Slack API error:', err.slackError);
      const notInChannel = err.slackError === 'not_in_channel' || err.slackError === 'channel_not_found';
      return NextResponse.json(
        {
          error: notInChannel
            ? 'Verdact cannot read that channel. Open a channel you are a member of.'
            : 'Could not load messages from that channel.',
        },
        { status: 502 },
      );
    }
    console.error('[slack/messages] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 });
  }
}
