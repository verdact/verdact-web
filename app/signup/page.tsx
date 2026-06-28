import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { getUser } from '@/lib/dal';
import { WaitlistForm } from './_components/WaitlistForm';
import { SignupForm } from './_components/SignupForm';
import { BETA_ACCESS_MESSAGE, getAdmissionMode } from '@/lib/auth/admission';
import { getAuditLeadEmailById } from '@/lib/audit/backfill';

export async function generateMetadata(): Promise<Metadata> {
  const mode = await getAdmissionMode();
  return mode === 'open_beta'
    ? {
        title: 'Create your Verdact workspace',
        description:
          'Create your free Verdact workspace and build submission-ready dispute evidence. Free during beta.',
      }
    : {
        title: 'Launching soon',
        description:
          'Verdact is opening soon. Leave your email and we will let you know the moment it is live.',
      };
}

// Sign-up RENDERING is driven by the platform admission mode (open_beta vs
// invite_only) plus the per-request handoff params. Account CREATION is always
// gated server-side regardless of what UI is shown — signupAction and the
// auth.users DB trigger both enforce emailHasBetaAccess() — so the UI here only
// decides whether the public default is the real form (open beta) or the
// launching-soon waitlist (invite-only). Paths that always show the real form:
//   - open beta:            any visit
//   - invited users:        /signup?invite=1
//   - audit-funnel handoff: /signup?from=audit (&lead=<uuid> prefills the email)
// Existing signed-in members continue to /dashboard; the team signs in at /login.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    access?: string;
    from?: string;
    email?: string;
    invite?: string;
    lead?: string;
  }>;
}) {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const mode = await getAdmissionMode();
  const openBeta = mode === 'open_beta';
  const pendingAccess = params.access === 'pending';

  // Prefill the email for an /audit handoff WITHOUT carrying it in the URL: look
  // it up server-side from the lead id (?lead=<uuid>). Legacy ?email= is still
  // honored for back-compat, but our own links no longer include it.
  const leadEmail = params.from === 'audit' ? await getAuditLeadEmailById(params.lead) : null;
  const urlEmail =
    typeof params.email === 'string' && /^\S+@\S+\.\S+$/.test(params.email)
      ? params.email
      : undefined;
  const initialEmail = leadEmail ?? urlEmail;

  const wantsSignup =
    openBeta || params.from === 'audit' || params.invite === '1' || Boolean(initialEmail);

  // Real account-creation form (the public default in open beta; the invite /
  // audit-handoff path in invite-only).
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
              {openBeta
                ? 'Free while we are in beta. Create your workspace below and start building submission-ready dispute evidence.'
                : 'Beta access is invite-only. If your email has been approved, create your workspace below.'}
            </p>
          </div>

          <div
            className="auth-card auth-rise"
            style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
          >
            <SignupForm initialEmail={initialEmail} />
          </div>

          {openBeta ? (
            <p className="auth-trust auth-rise" style={{ '--i': 2 } as React.CSSProperties}>
              Already have a workspace?{' '}
              <a className="underline hover:text-ink" href="/login">
                Sign in
              </a>
            </p>
          ) : (
            <p className="auth-trust auth-rise" style={{ '--i': 2 } as React.CSSProperties}>
              Not approved yet?{' '}
              <a className="underline hover:text-ink" href="/signup">
                Join the waitlist
              </a>
            </p>
          )}
        </div>
      </AuthFrame>
    );
  }

  // Invite-only public default: launching-soon waitlist.
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
