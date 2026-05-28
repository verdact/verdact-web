import { AuthFrame } from '../../_components/auth-chrome';
import { MailIcon } from '../../_components/auth-icons';

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
        <div className="reveal reveal-1 text-center">
          <span className="eyebrow eyebrow-center">
            Verdact · awaiting confirmation
          </span>
          <h1 className="section-heading mt-5">Confirm your email.</h1>
        </div>

        <div className="reveal reveal-2 surface-card mt-9 overflow-hidden">
          <div
            className="h-1.5 w-full"
            aria-hidden="true"
            style={{
              background:
                'linear-gradient(90deg, var(--action) 0 60%, var(--trust) 60% 100%)',
            }}
          />
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-action-rule bg-action-soft text-action"
                aria-hidden="true"
              >
                <MailIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="label-mono-strong">Verification link sent</p>
                <p className="mt-2 text-base leading-7 text-ink-soft">
                  We sent a verification link to{' '}
                  {email ? (
                    <span className="font-mono text-ink">{email}</span>
                  ) : (
                    <span className="text-ink">the address you provided</span>
                  )}
                  . Click it to finish setting up your workspace.
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <a className="btn-primary w-full" href="/login">
                I&apos;ve confirmed - sign in
              </a>
              <a className="btn-ghost w-full justify-center" href="/signup">
                Use a different email
              </a>
            </div>
          </div>
        </div>

        <p className="reveal reveal-3 mt-8 text-center text-sm text-ink-mute">
          Link not arriving? Check your spam folder, or write to{' '}
          <a
            className="font-medium text-action underline underline-offset-[5px] hover:text-action-deep"
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
