import Link from 'next/link';
import { AuthFrame } from '../../_components/auth-chrome';
import { MailIcon } from '../../_components/auth-icons';

type CheckEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export const metadata = {
  title: 'Confirm your email',
  description: 'Open the confirmation link to finish creating your workspace.',
};

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const params = await searchParams;
  const email = params.email ? decodeURIComponent(params.email) : undefined;

  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Check your email</p>
          <h1 className="auth-h1">
            Confirm your email<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            We sent a confirmation link to{' '}
            {email ? <strong>{email}</strong> : 'your email'}. Click it to finish
            setting up your workspace.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <div className="notice notice--info">
            <MailIcon className="h-4 w-4" />
            <span>After you confirm, you will come back here to sign in.</span>
          </div>

          <div className="space-y-3" style={{ marginTop: 'var(--space-5)' }}>
            <Link className="btn btn--primary w-full" href="/login">
              Back to sign in
            </Link>
            <Link className="btn btn--ghost w-full" href="/signup">
              Use a different email
            </Link>
          </div>
        </div>

        <p className="auth-trust auth-rise" style={{ '--i': 2 } as React.CSSProperties}>
          Link not arriving? Check your spam folder, or write to{' '}
          <a className="underline hover:text-ink" href="mailto:support@verdact.io">
            support@verdact.io
          </a>
          .
        </p>
      </div>
    </AuthFrame>
  );
}
