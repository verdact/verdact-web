import { AuthFrame } from '../_components/auth-chrome';
import { LockIcon } from '../_components/auth-icons';
import { ForgotPasswordForm } from './_components/ForgotPasswordForm';

export const metadata = {
  title: 'Reset password',
  description: 'Request a secure link to reset your Verdact password.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Password reset</p>
          <h1 className="auth-h1">
            Reset your password<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Enter your work email and we will send a secure link to choose a new
            password.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <ForgotPasswordForm />

          <p className="auth-trust" style={{ marginTop: 'var(--space-6)' }}>
            <LockIcon />
            Reset links expire quickly and work only once.
          </p>
        </div>

        <p
          className="auth-trust auth-rise"
          style={{ '--i': 2, justifyContent: 'center' } as React.CSSProperties}
        >
          Remembered it?{' '}
          <a className="underline hover:text-ink" href="/login">
            Back to sign in
          </a>
        </p>
      </div>
    </AuthFrame>
  );
}
