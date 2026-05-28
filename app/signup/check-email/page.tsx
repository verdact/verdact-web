import { AuthFrame } from '../../_components/auth-chrome';

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export const metadata = {
  title: 'Confirm your email · Verdact',
  description: 'Click the verification link to finish creating your workspace.',
};

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const params = await searchParams;
  const email = params.email ? decodeURIComponent(params.email) : undefined;

  return (
    <AuthFrame>
      <section className="mx-auto w-full max-w-lg py-12 md:py-20">
        <div className="reveal reveal-1">
          <p className="label-mono">Verdact · awaiting confirmation</p>
          <h1 className="font-display-light mt-5 text-[2.5rem] leading-[1.04] text-ink md:text-[3rem]">
            Confirm your email.
          </h1>

          <p className="mt-5 text-base leading-7 text-ink-soft">
            We sent a verification link to{' '}
            {email ? (
              <span className="font-mono text-ink">{email}</span>
            ) : (
              <span className="text-ink">the address you provided</span>
            )}
            . Click it to finish setting up your workspace.
          </p>
        </div>

        <div className="reveal reveal-2 mt-9 space-y-3">
          <a className="btn-primary w-full" href="/login">
            I&apos;ve confirmed - sign in
          </a>
          <a className="btn-ghost w-full justify-center" href="/signup">
            Use a different email
          </a>
        </div>

        <p className="reveal reveal-3 mt-8 text-sm text-ink-mute">
          Link not arriving? Check your spam folder, or write to{' '}
          <a
            className="font-medium text-ink underline underline-offset-[5px] hover:text-accent"
            href="mailto:admin@verdact.io"
          >
            admin@verdact.io
          </a>
          .
        </p>
      </section>
    </AuthFrame>
  );
}
