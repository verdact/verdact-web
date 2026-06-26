import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { getUser } from '@/lib/dal';
import { WaitlistForm } from './_components/WaitlistForm';
import { SignupForm } from './_components/SignupForm';
import { BETA_ACCESS_MESSAGE } from '@/lib/auth/admission';

export const metadata = {
  title: 'Launching soon',
  description: 'Verdact is opening soon. Leave your email and we will let you know the moment it is live.',
};

// Public sign-up is gated while the app is being finished. New visitors land on a
// launching-soon waitlist. Two paths still create an account, because account
// creation is gated SERVER-SIDE regardless of what UI is shown — signupAction and
// the auth.users DB trigger both enforce emailHasBetaAccess(), so a non-invited
// email gets the friendly invite-only message instead of an account:
//   - invited users:        /signup?invite=1
//   - audit-funnel handoff:  /signup?from=audit (&email=…)
// Existing team members who are already signed in continue to /dashboard; the team
// signs in directly at /login (auth is unchanged there).
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; from?: string; email?: string; invite?: string }>;
}) {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }
  const params = await searchParams;
  const pendingAccess = params.access === 'pending';
  // Only accept a plausibly-shaped email from the URL (audit-funnel handoff), so a
  // junk ?email= value neither prefills the form nor flips it out of waitlist mode.
  const initialEmail =
    typeof params.email === 'string' && /^\S+@\S+\.\S+$/.test(params.email) ? params.email : undefined;
  const wantsSignup = params.from === 'audit' || params.invite === '1' || Boolean(initialEmail);

  // Approved-invite / audit-handoff: show the real account-creation form.
  if (wantsSignup) {
    return (
      <AuthFrame>
        <div className="auth-center">
          <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
            <p className="eyebrow auth-eyebrow-row">Create your workspace</p>
            <h1 className="auth-h1">
              Set up Verdact<span className="auth-dot">.</span>
            </h1>
            <p className="auth-sub">
              Beta access is invite-only. If your email has been approved, create your workspace below.
            </p>
          </div>

          <div
            className="auth-card auth-rise"
            style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
          >
            <SignupForm initialEmail={initialEmail} />
          </div>

          <p className="auth-trust auth-rise" style={{ '--i': 2 } as React.CSSProperties}>
            Not approved yet?{' '}
            <a className="underline hover:text-ink" href="/signup">
              Join the waitlist
            </a>
          </p>
        </div>
      </AuthFrame>
    );
  }

  // Public default: launching-soon waitlist.
  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Launching soon</p>
          <h1 className="auth-h1">
            Verdact is almost ready<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            {pendingAccess
              ? BETA_ACCESS_MESSAGE
              : 'New workspaces are not open to the public yet. Leave your email and we will let you know the moment you can create yours.'}
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          {pendingAccess ? (
            <div className="notice notice--info" style={{ marginBottom: 'var(--space-5)' }}>
              Your email can stay on the waitlist while beta access is closed.
            </div>
          ) : null}

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
          Have a beta invite?{' '}
          <a className="underline hover:text-ink" href="/signup?invite=1">
            Create your account
          </a>
        </p>

        <p className="auth-trust auth-rise" style={{ '--i': 4 } as React.CSSProperties}>
          Already have a workspace?{' '}
          <a className="underline hover:text-ink" href="/login">
            Sign in
          </a>
        </p>
      </div>
    </AuthFrame>
  );
}
