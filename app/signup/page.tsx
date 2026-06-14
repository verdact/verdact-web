import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { getUser } from '@/lib/dal';
import { WaitlistForm } from './_components/WaitlistForm';

export const metadata = {
  title: 'Launching soon',
  description: 'Verdact is opening soon. Leave your email and we will let you know the moment it is live.',
};

// Public sign-up is gated while the app is being finished. New visitors land
// here on a launching-soon panel and can leave an email for the waitlist.
// Existing team members who are already signed in still continue to /dashboard;
// the team signs in directly at /login (auth is unchanged there).
export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Launching soon</p>
          <h1 className="auth-h1">
            Verdact is almost ready<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            New workspaces are not open to the public yet. Leave your email and we
            will let you know the moment you can create yours.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <WaitlistForm />

          <p className="auth-trust" style={{ marginTop: 'var(--space-6)' }}>
            We will only use your email to tell you when Verdact opens.
          </p>
        </div>

        <p
          className="auth-sub auth-rise"
          style={{ '--i': 2, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          Not ready to wait? Run a free, no-login{' '}
          <a className="underline hover:text-ink" href="/audit">
            dispute audit
          </a>{' '}
          and see which of your recent Stripe disputes are worth fighting.
        </p>

        <p className="auth-trust auth-rise" style={{ '--i': 3 } as React.CSSProperties}>
          Already have a workspace?{' '}
          <a className="underline hover:text-ink" href="/login">
            Sign in
          </a>
        </p>
      </div>
    </AuthFrame>
  );
}
