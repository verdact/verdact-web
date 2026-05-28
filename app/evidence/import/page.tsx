import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  decryptFromCookie,
  GMAIL_REVIEWER_COOKIE,
  GMAIL_TOKEN_COOKIE,
  REVIEWER_COOKIE,
} from '../../../lib/reviewer';
import { PageFrame, SectionLabel } from '../../_components/site-chrome';

export const dynamic = 'force-dynamic';

type ImportPageProps = {
  searchParams: Promise<{
    gmail?: string;
    q?: string;
    message?: string;
    marked?: string;
  }>;
};

type GmailMessageList = {
  messages?: Array<{ id: string; threadId: string }>;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    mimeType?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessage['payload'][];
  };
};

type MessageSummary = {
  id: string;
  threadId?: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
};

export const metadata = {
  title: 'Import Gmail Evidence - Verdact',
  description: 'Reviewer Gmail evidence import preview for Verdact.',
};

export default async function EvidenceImportPage({ searchParams }: ImportPageProps) {
  const cookieStore = await cookies();
  const isReviewer = cookieStore.get(REVIEWER_COOKIE)?.value === '1';

  if (!isReviewer) {
    redirect('/signin?from=/evidence/import');
  }

  const params = await searchParams;
  const reviewerProfile = parseReviewerProfile(cookieStore.get(GMAIL_REVIEWER_COOKIE)?.value);
  const encryptedToken = cookieStore.get(GMAIL_TOKEN_COOKIE)?.value;
  const accessToken = encryptedToken ? decryptFromCookie(encryptedToken) : null;
  const query = (params.q || '').trim();
  const marked = params.marked === '1';

  let summaries: MessageSummary[] = [];
  let selectedMessage: GmailMessage | null = null;
  let searchError: string | null = null;

  if (query && accessToken) {
    const result = await searchGmail(accessToken, query);
    summaries = result.messages;
    searchError = result.error;
  }

  if (params.message && accessToken) {
    selectedMessage = await fetchGmailMessage(accessToken, params.message, 'full');
  }

  return (
    <PageFrame active="evidence" reviewer>
      <section className="px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 border-b border-[#d9e1dc] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel>Gmail evidence preview</SectionLabel>
              <h1 className="mt-3 text-4xl font-semibold text-[#172033]">
                Search and inspect Gmail evidence
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#43515d]">
                Reviewers can confirm that Verdact reads Gmail only after
                explicit consent and only for a user-entered evidence query.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/settings/connections">
                Connections
              </a>
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/privacy">
                Privacy
              </a>
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/terms">
                Terms
              </a>
            </div>
          </div>

          <div className="grid gap-8 py-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="rounded-lg border border-[#d9e1dc] bg-white p-5 shadow-[0_18px_55px_rgba(23,32,51,0.08)]">
                <div className="mb-4 text-sm text-[#52616d]">
                  Connected Gmail account:{' '}
                  <span className="font-semibold text-[#172033]">
                    {reviewerProfile?.email || 'Connected reviewer account'}
                  </span>
                </div>

                {accessToken ? (
                  <form action="/evidence/import" className="flex flex-col gap-3 sm:flex-row">
                    <label className="sr-only" htmlFor="q">
                      Gmail search query
                    </label>
                    <input
                      id="q"
                      name="q"
                      className="min-w-0 flex-1 rounded-md border border-[#bdc9c3] px-3 py-3 text-base text-[#172033] outline-none transition placeholder:text-[#7a8791] focus:border-[#235f5c] focus:ring-2 focus:ring-[#235f5c]/20"
                      defaultValue={query}
                      placeholder="Example: from:customer@example.com newer_than:90d"
                    />
                    <button
                      className="rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26364f]"
                      type="submit"
                    >
                      Search Gmail
                    </button>
                  </form>
                ) : (
                  <div className="rounded-md border border-[#d99882] bg-[#fff4ef] px-4 py-3 text-sm leading-6 text-[#7d321f]">
                    The temporary Gmail token is missing or expired. Reconnect
                    Gmail to continue the reviewer flow.
                    <div className="mt-3">
                      <a className="font-semibold text-[#235f5c] underline" href="/api/google/start">
                        Reconnect Gmail
                      </a>
                    </div>
                  </div>
                )}

                <p className="mt-3 text-xs leading-5 text-[#657480]">
                  Search uses Google Gmail API read-only access for the current
                  reviewer session. The access token is short-lived and stored in
                  an encrypted HTTP-only cookie.
                </p>
              </div>

              {searchError ? (
                <div className="mt-5 rounded-md border border-[#d99882] bg-[#fff4ef] px-4 py-3 text-sm font-medium text-[#7d321f]">
                  {searchError}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3">
                {query && !searchError && summaries.length === 0 ? (
                  <div className="rounded-lg border border-[#d9e1dc] bg-white p-5 text-sm text-[#52616d]">
                    No messages matched that query.
                  </div>
                ) : null}

                {summaries.map((message) => (
                  <article
                    className="rounded-lg border border-[#d9e1dc] bg-white p-5 transition hover:border-[#235f5c]"
                    key={message.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#657480]">{message.date}</p>
                        <h2 className="mt-1 text-lg font-semibold text-[#172033]">
                          {message.subject || '(No subject)'}
                        </h2>
                        <p className="mt-2 text-sm text-[#52616d]">From: {message.from}</p>
                        <p className="text-sm text-[#52616d]">To: {message.to}</p>
                        <p className="mt-3 text-sm leading-6 text-[#43515d]">{message.snippet}</p>
                      </div>
                      <a
                        className="shrink-0 rounded-md border border-[#172033] px-3 py-2 text-center text-sm font-semibold text-[#172033] transition hover:bg-[#172033] hover:text-white"
                        href={`/evidence/import?q=${encodeURIComponent(query)}&message=${message.id}`}
                      >
                        Preview
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-lg border border-[#d9e1dc] bg-white p-5 shadow-[0_18px_55px_rgba(23,32,51,0.08)]">
              <p className="text-xs font-semibold uppercase text-[#235f5c]">
                Selected message
              </p>
              {selectedMessage ? (
                <div className="mt-4">
                  {marked ? (
                    <div className="mb-4 rounded-md border border-[#bdd9d3] bg-[#f2faf7] px-4 py-3 text-sm font-medium text-[#235f5c]">
                      Selected message staged for the reviewer evidence draft.
                    </div>
                  ) : null}
                  <h2 className="text-lg font-semibold text-[#172033]">
                    {headerValue(selectedMessage, 'Subject') || '(No subject)'}
                  </h2>
                  <dl className="mt-4 space-y-3 text-sm text-[#52616d]">
                    <div>
                      <dt className="font-semibold text-[#172033]">From</dt>
                      <dd>{headerValue(selectedMessage, 'From')}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#172033]">Date</dt>
                      <dd>{headerValue(selectedMessage, 'Date')}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 max-h-[420px] overflow-auto rounded-md border border-[#d9e1dc] bg-[#f7f9f6] p-4 text-sm leading-6 text-[#344653]">
                    {extractText(selectedMessage).slice(0, 5000) ||
                      selectedMessage.snippet ||
                      'No readable text body returned for this message.'}
                  </div>
                  <form action="/evidence/import" className="mt-5">
                    <input type="hidden" name="q" value={query} />
                    <input type="hidden" name="message" value={selectedMessage.id} />
                    <input type="hidden" name="marked" value="1" />
                    <button
                      className="w-full rounded-md bg-[#235f5c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#194b48]"
                      type="submit"
                    >
                      Mark selected for evidence draft
                    </button>
                  </form>
                  <p className="mt-3 text-xs leading-5 text-[#657480]">
                    Reviewer demo only: this confirms the selected-message
                    import step without submitting a dispute.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#52616d]">
                  Search Gmail and select Preview to inspect one message that
                  could support a dispute evidence draft.
                </p>
              )}
            </aside>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

async function searchGmail(accessToken: string, query: string) {
  const searchUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('maxResults', '5');

  const listResponse = await fetch(searchUrl, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    return {
      messages: [],
      error: 'Gmail search failed. Reconnect Gmail and try again.',
    };
  }

  const listPayload = (await listResponse.json()) as GmailMessageList;
  const messageIds = listPayload.messages || [];
  const messages = await Promise.all(
    messageIds.map(async (message) => {
      const details = await fetchGmailMessage(accessToken, message.id, 'metadata');
      return detailsToSummary(details);
    }),
  );

  return { messages: messages.filter(Boolean) as MessageSummary[], error: null };
}

async function fetchGmailMessage(accessToken: string, id: string, format: 'metadata' | 'full') {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', format);
  if (format === 'metadata') {
    ['From', 'To', 'Subject', 'Date'].forEach((header) => {
      url.searchParams.append('metadataHeaders', header);
    });
  }

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GmailMessage;
}

function detailsToSummary(message: GmailMessage | null): MessageSummary | null {
  if (!message) {
    return null;
  }

  return {
    id: message.id,
    threadId: message.threadId,
    date: headerValue(message, 'Date'),
    from: headerValue(message, 'From'),
    to: headerValue(message, 'To'),
    subject: headerValue(message, 'Subject'),
    snippet: message.snippet || '',
  };
}

function headerValue(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value || ''
  );
}

function extractText(message: GmailMessage) {
  const payload = message.payload;
  if (!payload) {
    return '';
  }

  const parts = flattenParts(payload);
  const plain = parts.find((part) => part?.mimeType === 'text/plain' && part.body?.data);
  const html = parts.find((part) => part?.mimeType === 'text/html' && part.body?.data);
  const selected = plain || html || payload;
  const encoded = selected.body?.data;

  if (!encoded) {
    return '';
  }

  const text = Buffer.from(encoded, 'base64url').toString('utf8');
  return selected.mimeType === 'text/html' ? stripHtml(text) : text;
}

function flattenParts(payload: NonNullable<GmailMessage['payload']>): NonNullable<GmailMessage['payload']>[] {
  const parts = [payload];
  for (const part of payload.parts || []) {
    if (part) {
      parts.push(...flattenParts(part));
    }
  }
  return parts;
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseReviewerProfile(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as { email?: string; verifiedAt?: string };
  } catch {
    return null;
  }
}
