'use client';

import { useActionState } from 'react';
import {
  loginAction,
  signInWithGoogleAction,
  type AuthFormState,
} from '@/lib/auth/actions';

const initialState: AuthFormState = undefined;

export function LoginForm({ presetError }: { presetError?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const errorMessage = state?.error ?? presetError;

  return (
    <div className="space-y-6">
      <form action={signInWithGoogleAction}>
        <button type="submit" className="btn btn--secondary w-full">
          <GoogleMark />
          <span>Continue with Google</span>
        </button>
      </form>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-rule" />
        <span className="t-label-mono text-ink-mute">or continue with email</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form action={formAction} className="space-y-5" suppressHydrationWarning>
        {errorMessage ? (
          <div className="notice notice--error">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            className={`inp ${errorMessage ? 'inp--error' : ''}`}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state?.email ?? ''}
            placeholder="founder@company.com"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className={`inp ${errorMessage ? 'inp--error' : ''}`}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={pending} className={`btn btn--primary w-full ${pending ? 'btn--loading' : ''}`}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="pt-5 text-center text-sm text-ink-soft border-t border-rule">
        New to Verdact?{' '}
        <a
          className="font-medium text-action underline underline-offset-[5px] hover:text-action-deep"
          href="/signup"
        >
          Create a workspace
        </a>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
