/**
 * Slack Web API helpers (raw fetch, no @slack/* SDK).
 *
 * Token model: USER token (xoxp-), read from authed_user.access_token at OAuth
 * time and stored encrypted on slack_connections. Every read here runs under
 * that user token, scoped to the channels the authorizing merchant can see.
 *
 * The selected-message guarantee is enforced by Verdact application logic (we
 * only ever fetch the channel the merchant opened and the messages they picked),
 * NOT by a Slack permission: Slack's *:history scopes are channel-scoped, not
 * thread-scoped, and a user token can read every public channel.
 *
 * Rate-limit note (Slack 2025-05-29): conversations.history and
 * conversations.replies are capped at 1 request/min and 15 objects/request for
 * unlisted non-Marketplace apps installed in external workspaces.
 * conversations.list, users.info, and chat.getPermalink are NOT affected. The
 * picker makes ONE capped conversations.history call per user-initiated page: a
 * channel open, plus one more for each explicit "Load older" click. These are
 * never automatic and never parallel; a 429 is surfaced for the merchant to
 * retry rather than retried in a loop. The import route adds no further capped
 * call (it re-fetches only permalinks, which are uncapped). The escape for
 * heavier pagination is Marketplace approval or a per-merchant internal app
 * (Tier 3, 1000 objects) - a documented roadmap item, not a v1 need.
 */

export const SLACK_USER_SCOPES = [
  'channels:read',
  'groups:read',
  'channels:history',
  'groups:history',
  'users:read',
] as const;

const SLACK_API = 'https://slack.com/api';

// Cap a channel-open at a single rate-limited history page.
export const SLACK_MESSAGE_PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// OAuth + revoke
// ---------------------------------------------------------------------------

export interface SlackOAuthResult {
  ok: boolean;
  error?: string;
  team?: { id: string; name?: string };
  authed_user?: { id: string; scope?: string; access_token?: string; token_type?: string };
}

export async function exchangeSlackOAuthCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<SlackOAuthResult> {
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
    }),
  });
  return (await res.json()) as SlackOAuthResult;
}

export async function revokeSlackToken(token: string): Promise<void> {
  await fetch(`${SLACK_API}/auth.revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
}

// ---------------------------------------------------------------------------
// Reads (user token)
// ---------------------------------------------------------------------------

export class SlackRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('slack_rate_limited');
    this.name = 'SlackRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class SlackApiError extends Error {
  slackError: string;
  constructor(slackError: string) {
    super(slackError);
    this.name = 'SlackApiError';
    this.slackError = slackError;
  }
}

type SlackResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

async function slackGet<T>(
  method: string,
  token: string,
  params: Record<string, string>,
): Promise<T> {
  const url = `${SLACK_API}/${method}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    const header = Number(res.headers.get('retry-after') ?? '60');
    throw new SlackRateLimitError(Number.isFinite(header) && header > 0 ? header : 60);
  }
  const json = (await res.json()) as SlackResponse<T>;
  if (!json.ok) throw new SlackApiError(json.error);
  return json as T;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export async function listSlackChannels(token: string): Promise<SlackChannel[]> {
  const out: SlackChannel[] = [];
  let cursor: string | undefined;
  // conversations.list is Tier 2 (uncapped by the 2025 cut). Bound the pages so
  // a very large workspace cannot make this unbounded.
  for (let page = 0; page < 5; page++) {
    const params: Record<string, string> = {
      types: 'public_channel,private_channel',
      exclude_archived: 'true',
      limit: '200',
    };
    if (cursor) params.cursor = cursor;
    const data = await slackGet<{
      channels: Array<{ id: string; name: string; is_private: boolean }>;
      response_metadata?: { next_cursor?: string };
    }>('conversations.list', token, params);
    for (const c of data.channels) {
      out.push({ id: c.id, name: c.name, isPrivate: c.is_private });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface SlackMessageSnapshot {
  ts: string;
  authorId: string;
  author: string;
  text: string;
  permalink: string;
}

/**
 * Fetch one rate-limited page of recent channel messages, with author display
 * names and permalinks resolved via uncapped methods. This is the single capped
 * call per channel open. Throws SlackRateLimitError on a 429 so the caller can
 * surface an honest "try again in ~Ns" state.
 */
export async function fetchChannelMessages(args: {
  token: string;
  channelId: string;
  cursor?: string;
  limit?: number;
}): Promise<{ messages: SlackMessageSnapshot[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    channel: args.channelId,
    limit: String(args.limit ?? SLACK_MESSAGE_PAGE_SIZE),
  };
  if (args.cursor) params.cursor = args.cursor;

  const data = await slackGet<{
    messages: Array<{ ts: string; user?: string; text?: string; subtype?: string }>;
    response_metadata?: { next_cursor?: string };
  }>('conversations.history', args.token, params);

  // Keep only real user messages with text; drop join/leave/system subtypes.
  const raw = data.messages.filter((m) => !!m.ts && !m.subtype && (m.text ?? '').trim().length > 0);

  const authorNames = await resolveAuthors(args.token, raw.map((m) => m.user).filter(Boolean) as string[]);

  // Permalinks (chat.getPermalink) are uncapped, so fetch them in parallel.
  const messages = await Promise.all(
    raw.map(async (m): Promise<SlackMessageSnapshot> => {
      let permalink = '';
      try {
        permalink = await getPermalink(args.token, args.channelId, m.ts);
      } catch {
        permalink = '';
      }
      return {
        ts: m.ts,
        authorId: m.user ?? '',
        author: m.user ? authorNames.get(m.user) ?? m.user : 'unknown',
        text: m.text ?? '',
        permalink,
      };
    }),
  );

  return { messages, nextCursor: data.response_metadata?.next_cursor || undefined };
}

async function resolveAuthors(token: string, userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds));
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, string]> => {
      try {
        const data = await slackGet<{
          user: { profile?: { display_name?: string; real_name?: string }; real_name?: string; name?: string };
        }>('users.info', token, { user: id });
        const p = data.user.profile;
        return [id, p?.display_name || p?.real_name || data.user.real_name || data.user.name || id];
      } catch {
        return [id, id];
      }
    }),
  );
  return new Map(entries);
}

export async function getPermalink(token: string, channelId: string, ts: string): Promise<string> {
  const data = await slackGet<{ permalink: string }>('chat.getPermalink', token, {
    channel: channelId,
    message_ts: ts,
  });
  return data.permalink;
}

// ---------------------------------------------------------------------------
// Transcript (text/plain evidence artifact, d3)
// ---------------------------------------------------------------------------

export function buildSlackTranscript(args: {
  channelName: string;
  teamName: string | null;
  messages: SlackMessageSnapshot[];
}): string {
  const lines: string[] = [];
  lines.push(`Slack import: #${args.channelName}`);
  if (args.teamName) lines.push(`Workspace: ${args.teamName}`);
  lines.push(`Messages selected by the merchant: ${args.messages.length}`);
  lines.push('Only the messages the merchant explicitly selected are included below.');
  lines.push('');
  for (const m of args.messages) {
    const when = slackTsToIso(m.ts);
    lines.push(`[${when}] ${m.author}${m.authorId ? ` (${m.authorId})` : ''}`);
    lines.push(m.text.trim().length > 0 ? m.text : '(no text)');
    if (m.permalink) lines.push(m.permalink);
    lines.push('');
  }
  return lines.join('\n');
}

function slackTsToIso(ts: string): string {
  const seconds = Number(ts.split('.')[0]);
  if (!Number.isFinite(seconds)) return ts;
  return new Date(seconds * 1000).toISOString();
}
