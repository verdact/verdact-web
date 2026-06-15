import { NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { loadConnectedSlackToken } from '@/lib/slack/token';
import { listSlackChannels, SlackApiError, SlackRateLimitError } from '@/lib/slack/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lists the merchant's channels for the in-dispute picker. conversations.list is
// uncapped by the 2025 rate-limit change. Reads nothing else (no messages).
export async function GET() {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });

  const supabase = await createClient();
  const conn = await loadConnectedSlackToken(supabase, membership.merchant.id);
  if (!conn) return NextResponse.json({ connected: false }, { status: 200 });

  try {
    const channels = await listSlackChannels(conn.token);
    return NextResponse.json({ connected: true, channels });
  } catch (err) {
    if (err instanceof SlackRateLimitError) {
      return NextResponse.json(
        { error: 'Slack is rate-limiting this workspace. Try again shortly.', retryAfter: err.retryAfterSeconds },
        { status: 429 },
      );
    }
    if (err instanceof SlackApiError) {
      console.error('[slack/channels] Slack API error:', err.slackError);
      return NextResponse.json({ error: 'Could not load Slack channels.' }, { status: 502 });
    }
    console.error('[slack/channels] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not load Slack channels.' }, { status: 500 });
  }
}
