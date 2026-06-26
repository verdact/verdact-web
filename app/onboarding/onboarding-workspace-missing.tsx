import { AuthFrame } from '../_components/auth-chrome';
import { signOutAction } from '@/lib/auth/actions';

// Shown when an authenticated user reaches onboarding without an active merchant
// membership — a should-never-happen state, since the workspace + owner membership
// are created by a one-time after-insert trigger on auth.users at signup. That
// trigger does NOT refire on re-login (no new auth.users row), so signing back in
// cannot recover it. We surface support as the real fix and offer sign-out only so
// the user is not stranded in a half-authenticated state.
export function OnboardingWorkspaceMissing() {
  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Setup paused</p>
          <h1 className="auth-h1">
            We could not find your workspace<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Your account is signed in, but its Verdact workspace was not set up. This is rare and we
            need to fix it on our side. Email support@verdact.io from this address and we will
            restore your workspace, usually within one business day.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <a className="btn btn--primary w-full" href="mailto:support@verdact.io?subject=Workspace%20setup%20needed">
            Email support
          </a>
          <form action={signOutAction} className="space-y-5" style={{ marginTop: 'var(--space-4)' }}>
            <button type="submit" className="btn btn--ghost w-full">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </AuthFrame>
  );
}
