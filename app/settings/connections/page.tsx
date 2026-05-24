import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GMAIL_REVIEWER_COOKIE, GMAIL_TOKEN_COOKIE, REVIEWER_COOKIE } from '../../../lib/reviewer';
import { PageFrame, SectionLabel } from '../../_components/site-chrome';

type ConnectionsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const metadata = {
  title: 'Connections - Verdact',
  description: 'Connect Gmail for Verdact evidence review.',
};

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const cookieStore = await cookies();
  const isReviewer = cookieStore.get(REVIEWER_COOKIE)?.value === '1';
  const gmailReviewer = cookieStore.get(GMAIL_REVIEWER_COOKIE)?.value;
  const gmailToken = cookieStore.get(GMAIL_TOKEN_COOKIE)?.value;
  const gmailConnected = Boolean(gmailReviewer && gmailToken);
  const gmailExpired = Boolean(gmailReviewer && !gmailToken);
  const googleConfigured = Boolean(
    process.env.NEXT_PUBLIC_APP_URL && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  if (!isReviewer) {
    redirect('/signin?from=/settings/connections');
  }

  const params = await searchParams;

  return (
    <PageFrame active="connections" reviewer>
      <section className="px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 border-b border-[#d9e1dc] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel>Reviewer settings</SectionLabel>
              <h1 className="mt-3 text-4xl font-semibold text-[#172033]">Connect evidence sources</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#43515d]">
                Reviewers can verify that Gmail access is explicit, scoped, and
                limited to a user-initiated evidence search.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/">
                Home
              </a>
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/privacy">
                Privacy
              </a>
              <a className="rounded-md border border-[#bdc9c3] bg-white px-3 py-2 text-[#235f5c] hover:border-[#235f5c]" href="/terms">
                Terms
              </a>
            </div>
          </div>

          <div className="grid gap-8 py-8 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-lg border border-[#d9e1dc] bg-white p-5">
              <nav className="space-y-1 text-sm" aria-label="Settings navigation">
                <a className="block rounded-md bg-[#172033] px-3 py-2 font-semibold text-white" href="/settings/connections">
                  Connections
                </a>
                <span className="block px-3 py-2 text-[#657480]">Evidence sources</span>
                <span className="block px-3 py-2 text-[#657480]">Privacy controls</span>
              </nav>
              <div className="mt-6 rounded-md border border-[#bdd9d3] bg-[#f2faf7] p-4 text-sm leading-6 text-[#31585a]">
                Gmail review path uses OAuth consent and requests only
                gmail.readonly.
              </div>
            </aside>

            <div>
              {params.error ? (
                <div className="mb-5 rounded-md border border-[#d99882] bg-[#fff4ef] px-4 py-3 text-sm font-medium text-[#7d321f]">
                  {errorCopy(params.error)}
                </div>
              ) : null}

              {!googleConfigured ? (
                <div className="mb-5 rounded-md border border-[#d99882] bg-[#fff4ef] px-4 py-3 text-sm font-medium text-[#7d321f]">
                  Google OAuth environment variables are missing on this deployment.
                </div>
              ) : null}

              <div className="grid gap-4">
                <section className="rounded-lg border border-[#d9e1dc] bg-white p-5 shadow-[0_18px_55px_rgba(23,32,51,0.08)]">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#e5f1ee] text-base font-semibold text-[#235f5c]">
                          G
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-[#172033]">Gmail</h2>
                          <p className="text-sm text-[#52616d]">
                            User-initiated message search for dispute evidence.
                          </p>
                        </div>
                      </div>
                      <ul className="mt-5 grid gap-2 text-sm leading-6 text-[#43515d]">
                        <li>Scope requested: gmail.readonly</li>
                        <li>No continuous inbox monitoring</li>
                        <li>No Gmail data used for AI model training</li>
                        <li>Reviewer can preview one selected message before import</li>
                      </ul>
                    </div>
                    <div className="md:min-w-[210px] md:text-right">
                      {gmailConnected ? (
                        <div>
                          <p className="mb-3 rounded-full bg-[#e5f1ee] px-3 py-1 text-center text-sm font-semibold text-[#235f5c] md:inline-block">
                            Connected for review
                          </p>
                          <a
                            className="inline-flex w-full justify-center rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26364f] md:w-auto"
                            href="/evidence/import"
                          >
                            Continue to import preview
                          </a>
                        </div>
                      ) : googleConfigured ? (
                        <div>
                          {gmailExpired ? (
                            <p className="mb-3 rounded-full bg-[#fff4ef] px-3 py-1 text-center text-sm font-semibold text-[#7d321f] md:inline-block">
                              Session expired
                            </p>
                          ) : null}
                          <a
                            className="inline-flex w-full justify-center rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26364f] md:w-auto"
                            href="/api/google/start"
                          >
                            {gmailExpired ? 'Reconnect Gmail' : 'Connect Gmail'}
                          </a>
                        </div>
                      ) : (
                        <span className="inline-flex w-full justify-center rounded-md border border-[#d9e1dc] bg-[#f7f9f6] px-4 py-3 text-sm font-semibold text-[#657480] md:w-auto">
                          OAuth not configured
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-[#d9e1dc] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#edf0ee] text-base font-semibold text-[#657480]">
                      S
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-[#172033]">Slack</h2>
                      <p className="text-sm leading-6 text-[#52616d]">
                        Selected-thread import. Not required for Google OAuth review.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function errorCopy(error: string) {
  switch (error) {
    case 'missing_google_config':
      return 'Google OAuth is not configured on this deployment.';
    case 'google_denied':
      return 'Google authorization was cancelled before consent completed.';
    case 'missing_code':
      return 'Google did not return an authorization code.';
    case 'state':
      return 'Google OAuth state did not match. Please start the connection again.';
    case 'token':
      return 'Google returned consent, but token exchange failed. Check OAuth client settings and redirect URI.';
    default:
      return 'The Gmail connection could not be completed.';
  }
}
