import { PageFrame, SectionLabel } from '../_components/site-chrome';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    from?: string;
  }>;
};

export const metadata = {
  title: 'Sign in - Verdact',
  description: 'Reviewer sign-in for Verdact Gmail OAuth verification.',
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const hasAccessCode = Boolean(process.env.REVIEWER_ACCESS_CODE);

  return (
    <PageFrame active="signin" reviewer>
      <section className="px-5 py-10 md:py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_430px] lg:items-start">
          <div className="rounded-lg border border-[#d9e1dc] bg-white p-7 shadow-[0_18px_55px_rgba(23,32,51,0.08)] md:p-9">
            <a className="text-sm font-semibold text-[#235f5c] underline" href="/">
              &larr; Back to home
            </a>
            <div className="mt-8">
              <SectionLabel>Google OAuth verification</SectionLabel>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight text-[#172033] md:text-5xl">
                Reviewer access for Gmail consent testing.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#43515d]">
                This path lets Google reviewers reach Verdact&apos;s
                user-initiated Gmail connection flow without a separate account
                setup or two-factor authentication step.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                ['Scope', 'gmail.readonly only'],
                ['Access', 'Reviewer session only'],
                ['Use', 'Evidence search preview'],
              ].map(([label, value]) => (
                <div className="rounded-md border border-[#d9e1dc] bg-[#f7f9f6] p-4" key={label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#235f5c]">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#344653]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-md border border-[#bdd9d3] bg-[#f2faf7] p-4 text-sm leading-6 text-[#31585a]">
              Reviewer route: sign in, open Settings &gt; Connections, choose
              Connect Gmail, approve the Google consent screen, then preview a
              selected Gmail message.
            </div>
          </div>

          <div className="rounded-lg border border-[#d9e1dc] bg-white p-6 shadow-[0_24px_70px_rgba(23,32,51,0.10)]">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#235f5c]">
                Review session
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#172033]">Continue to Verdact</h2>
              <p className="mt-2 text-sm leading-6 text-[#52616d]">
                The next screen shows the Gmail connection card and the exact
                consent flow under review.
              </p>
            </div>

            {params.error ? (
              <div className="mb-4 rounded-md border border-[#d99882] bg-[#fff4ef] px-4 py-3 text-sm font-medium text-[#7d321f]">
                {params.error === 'access'
                  ? 'The reviewer access code was not accepted.'
                  : 'Sign-in could not be completed. Try again.'}
              </div>
            ) : null}

            <form action="/reviewer/session" method="post" className="space-y-4">
              <input type="hidden" name="from" value={params.from || '/settings/connections'} />
              {hasAccessCode ? (
                <label className="block text-sm font-semibold text-[#172033]">
                  Reviewer access code
                  <input
                    className="mt-2 w-full rounded-md border border-[#bdc9c3] px-3 py-3 text-base outline-none transition focus:border-[#235f5c] focus:ring-2 focus:ring-[#235f5c]/20"
                    name="accessCode"
                    type="password"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
              ) : (
                <div className="rounded-md border border-[#d9e1dc] bg-[#f7f9f6] px-4 py-3 text-sm leading-6 text-[#43515d]">
                  No password is required for this temporary reviewer path.
                </div>
              )}
              <button
                className="w-full rounded-md bg-[#172033] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#26364f] focus:outline-none focus:ring-2 focus:ring-[#172033]/25"
                type="submit"
              >
                Continue to connections
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold">
              <a className="text-[#235f5c] underline" href="/">
                Home
              </a>
              <a className="text-[#235f5c] underline" href="/privacy">
                Privacy policy
              </a>
              <a className="text-[#235f5c] underline" href="/terms">
                Terms of service
              </a>
              <a className="text-[#235f5c] underline" href="mailto:admin@verdact.io">
                Contact admin
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
