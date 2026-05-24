import Image from 'next/image';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    from?: string;
  }>;
};

export const metadata = {
  title: 'Sign in — Verdact',
  description: 'Reviewer sign-in for Verdact Gmail OAuth verification.',
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const hasAccessCode = Boolean(process.env.REVIEWER_ACCESS_CODE);

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-6 py-10 text-[#172033]">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <Image src="/verdact-logo.png" alt="Verdact" width={48} height={48} priority />
            <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#37577f]">
              Verdact
            </span>
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-[#172033] md:text-6xl">
            Reviewer access for Gmail verification.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#52606f]">
            This path is provided for Google reviewers to test user-initiated
            Gmail connection and consent. It does not submit disputes or access
            Gmail in the background.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 text-sm text-[#52606f] sm:grid-cols-3">
            <div className="border-l-2 border-[#2f6f73] pl-4">No 2FA on reviewer path</div>
            <div className="border-l-2 border-[#2f6f73] pl-4">User-initiated OAuth only</div>
            <div className="border-l-2 border-[#2f6f73] pl-4">No inbox model training</div>
          </div>
        </div>

        <div className="rounded-lg border border-[#d7d0c2] bg-white p-6 shadow-[0_24px_70px_rgba(23,32,51,0.12)]">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6f73]">
              Google reviewer
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#172033]">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-[#66717f]">
              Continue to the connections screen, then choose Connect Gmail to
              reach the Google OAuth consent screen.
            </p>
          </div>

          {params.error ? (
            <div className="mb-4 rounded-md border border-[#e5b1a1] bg-[#fff4ef] px-4 py-3 text-sm text-[#8a3b26]">
              {params.error === 'access'
                ? 'The reviewer access code was not accepted.'
                : 'Sign-in could not be completed. Try again.'}
            </div>
          ) : null}

          <form action="/reviewer/session" method="post" className="space-y-4">
            <input type="hidden" name="from" value={params.from || '/settings/connections'} />
            {hasAccessCode ? (
              <label className="block text-sm font-medium text-[#172033]">
                Reviewer access code
                <input
                  className="mt-2 w-full rounded-md border border-[#cfc7b8] px-3 py-3 text-base outline-none transition focus:border-[#2f6f73] focus:ring-2 focus:ring-[#2f6f73]/20"
                  name="accessCode"
                  type="password"
                  autoComplete="one-time-code"
                  required
                />
              </label>
            ) : (
              <div className="rounded-md border border-[#d8e4e3] bg-[#f4fbfa] px-4 py-3 text-sm leading-6 text-[#31585a]">
                No password is required for this temporary reviewer path.
              </div>
            )}
            <button
              className="w-full rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#22304a] focus:outline-none focus:ring-2 focus:ring-[#172033]/30"
              type="submit"
            >
              Continue to connections
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-[#7b8490]">
            Reviewer route: /signin → /settings/connections → Connect Gmail →
            Google OAuth consent.
          </p>
        </div>
      </section>
    </main>
  );
}
