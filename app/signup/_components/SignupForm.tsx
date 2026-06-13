'use client';

import { useActionState, useRef, useState } from 'react';
import {
  signupAction,
  signInWithGoogleAction,
  type AuthFormState,
} from '@/lib/auth/actions';
import { GoogleButton } from '../../_components/auth-google';
import { suggestEmail, validateEmail } from '../../_components/auth-email';

const initialState: AuthFormState = undefined;

function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter your password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  return undefined;
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [emailErr, setEmailErr] = useState<string | undefined>(undefined);
  const [emailSugg, setEmailSugg] = useState<string | undefined>(undefined);
  const [passwordErr, setPasswordErr] = useState<string | undefined>(undefined);
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <form action={signInWithGoogleAction}>
        <GoogleButton />
      </form>

      <div className="auth-divider">or</div>

      <form action={formAction} className="space-y-5" suppressHydrationWarning>
        {state?.error ? (
          <div className="notice notice--error" role="alert">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
            <span>{state.error}</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="signup-name">Your name</label>
          <input
            id="signup-name"
            className="inp"
            name="fullName"
            type="text"
            autoComplete="name"
            defaultValue={state?.fullName ?? ''}
            placeholder="Alex Rivera"
          />
        </div>

        <div className="field">
          <label htmlFor="signup-email">Work email</label>
          <input
            id="signup-email"
            ref={emailRef}
            className={`inp ${emailErr || state?.error ? 'inp--error' : ''}`}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state?.email ?? ''}
            placeholder="founder@company.com"
            required
            aria-invalid={emailErr ? true : undefined}
            aria-describedby={emailErr ? 'signup-email-err' : undefined}
            onBlur={(e) => {
              const value = e.target.value.trim();
              setEmailErr(validateEmail(value));
              setEmailSugg(suggestEmail(value));
            }}
            onChange={() => {
              setEmailErr(undefined);
              setEmailSugg(undefined);
            }}
          />
          {emailErr ? (
            <p className="err" id="signup-email-err" aria-live="polite">{emailErr}</p>
          ) : null}
          {emailSugg ? (
            <p className="didu" aria-live="polite">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => {
                  if (emailRef.current) emailRef.current.value = emailSugg;
                  setEmailSugg(undefined);
                  setEmailErr(undefined);
                }}
              >
                {emailSugg}
              </button>
              ?
            </p>
          ) : null}
        </div>

        <div className="field">
          <div className="lblrow">
            <label htmlFor="signup-password">Password</label>
            <span className="hint">Min. 8 characters</span>
          </div>
          <div className="pwwrap">
            <input
              id="signup-password"
              className={`inp ${passwordErr || state?.error ? 'inp--error' : ''}`}
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              placeholder="••••••••"
              required
              aria-invalid={passwordErr ? true : undefined}
              aria-describedby={passwordErr ? 'signup-password-err' : undefined}
              onBlur={(e) => setPasswordErr(validatePassword(e.target.value))}
              onChange={() => setPasswordErr(undefined)}
            />
            <button
              type="button"
              className="pwtoggle"
              aria-pressed={showPw}
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordErr ? (
            <p className="err" id="signup-password-err" aria-live="polite">{passwordErr}</p>
          ) : null}
        </div>

        <div className="field">
          <div className="lblrow">
            <label htmlFor="signup-business">Business name</label>
            <span className="hint">Optional</span>
          </div>
          <input
            id="signup-business"
            className="inp"
            name="businessName"
            type="text"
            autoComplete="organization"
            defaultValue={state?.businessName ?? ''}
            placeholder="Acme Services"
          />
        </div>

        <button type="submit" disabled={pending} className={`btn btn--primary w-full ${pending ? 'btn--loading' : ''}`}>
          {pending ? 'Creating workspace…' : 'Create workspace'}
        </button>
      </form>

      <div className="pt-5 text-center text-sm text-ink-soft border-t border-rule">
        Already have a workspace?{' '}
        <a
          className="font-medium text-action underline underline-offset-[5px] hover:text-action-deep"
          href="/login"
        >
          Sign in
        </a>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        By creating a workspace, you accept the{' '}
        <a className="underline hover:text-ink" href="/terms">
          Terms
        </a>{' '}
        and{' '}
        <a className="underline hover:text-ink" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
