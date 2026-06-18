import { AuthFrame } from '../_components/auth-chrome';
import { signOutAction } from '@/lib/auth/actions';

// Shown when an authenticated user reaches onboarding without an active merchant
// membership. The wizard's write steps cannot save in that state, so rather than
// render a form that hard-errors we guide the user to sign out and back in, which
// re-runs the post-auth workspace setup.
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
            Your account is signed in, but its Verdact workspace is not ready yet.
            Sign out and back in to finish setting it up. If this keeps happening,
            email support@verdact.io.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <form action={signOutAction} className="space-y-5">
            <button type="submit" className="btn btn--primary w-full">
              Sign out and back in
            </button>
          </form>
        </div>
      </div>
    </AuthFrame>
  );
}
