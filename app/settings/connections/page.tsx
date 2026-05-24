import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GMAIL_REVIEWER_COOKIE, REVIEWER_COOKIE } from '../../../lib/reviewer';

type ConnectionsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const metadata = {
  title: 'Connections — Verdact',
  description: 'Connect Gmail for Verdact evidence review.',
};

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const cookieStore = await cookies();
  const isReviewer = cookieStore.get(REVIEWER_COOKIE)?.value === '1';
  const gmailReviewer = cookieStore.get(GMAIL_REVIEWER_COOKIE)?.value;

  if (!isReviewer) {
    redirect('/signin?from=/settings/connections');
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f7f3] px-6 py-8 text-[#172033]">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-[#ddd7ca] pb-5">
          <div className="flex items-center gap-3">
            <Image src="/verdact-logo.png" alt="Verdact" width={42} height={42} priority />
            <div>
              <p className="text-sm font-semibold text-[#172033]">Verdact</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#6c7581]">
                Settings
              </p>
            </div>
          </div>
          <a
            className="rounded-md border border-[#cfc8b8] px-3 py-2 text-sm font-medium text-[#354254] transition hover:bg-white"
            href="/signin"
          >
            Reviewer sign-in
          </a>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[280px_1fr]">
          <aside>
            <nav className="space-y-1 text-sm">
              <a className="block rounded-md bg-[#172033] px-3 py-2 font-medium text-white" href="/settings/connections">
                Connections
              </a>
              <span className="block px-3 py-2 text-[#7c8591]">Evidence sources</span>
              <span className="block px-3 py-2 text-[#7c8591]">Privacy controls</span>
            </nav>
          </aside>

          <div>
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6f73]">
                Reviewer test path
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#172033]">
                Connect evidence sources
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#5f6976]">
                Verdact uses Gmail only when a merchant starts an evidence
                search and explicitly selects messages for a dispute packet.
              </p>
            </div>

            {params.error ? (
              <div className="mb-5 rounded-md border border-[#e5b1a1] bg-[#fff4ef] px-4 py-3 text-sm text-[#8a3b26]">
                {errorCopy(params.error)}
              </div>
            ) : null}

            <div className="grid gap-4">
              <section className="rounded-lg border border-[#d8d1c3] bg-white p-5 shadow-[0_18px_45px_rgba(23,32,51,0.08)]">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef6f5] text-sm font-semibold text-[#2f6f73]">
                        G
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-[#172033]">Gmail</h2>
                        <p className="text-sm text-[#697381]">
                          User-initiated message search for delivery proof.
                        </p>
                      </div>
                    </div>
                    <ul className="mt-4 grid gap-2 text-sm text-[#5f6976]">
                      <li>Scope requested: gmail.readonly</li>
                      <li>No continuous inbox monitoring</li>
                      <li>No Gmail data used for AI model training</li>
                    </ul>
                  </div>
                  <div className="sm:text-right">
                    {gmailReviewer ? (
                      <div>
                        <p className="mb-3 text-sm font-medium text-[#2f6f73]">
                          Connected for reviewer test
                        </p>
                        <a
                          className="inline-flex rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#22304a]"
                          href="/evidence/import"
                        >
                          Continue to import preview
                        </a>
                      </div>
                    ) : (
                      <a
                        className="inline-flex rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#22304a]"
                        href="/api/google/start"
                      >
                        Connect Gmail
                      </a>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-[#d8d1c3] bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f2f1ec] text-sm font-semibold text-[#5f6976]">
                    S
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#172033]">Slack</h2>
                    <p className="text-sm text-[#697381]">
                      Selected-thread import. Not required for Google OAuth review.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
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
