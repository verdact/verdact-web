'use client';

import { useActionState, useRef, useState } from 'react';
import {
  loginAction,
  signInWithGoogleAction,
  type AuthFormState,
} from '@/lib/auth/actions';
import { GoogleButton } from '../../_components/auth-google';
import { suggestEmail, validateEmail } from '../../_components/auth-email';

const initialState: AuthFormState = undefined;

export function LoginForm({ presetError }: { presetError?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [emailErr, setEmailErr] = useState<string | undefined>(undefined);
  const [emailSugg, setEmailSugg] = useState<string | undefined>(undefined);
  const [passwordErr, setPasswordErr] = useState<string | undefined>(undefined);
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorMessage = state?.error ?? presetError;

  return (
    <div className="space-y-6">
      <form action={signInWithGoogleAction}>
        <GoogleButton />
      </form>

      <div className="auth-divider">or</div>

      <form action={formAction} className="space-y-5" suppressHydrationWarning>
        {errorMessage ? (
          <div className="notice notice--error" role="alert">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            ref={emailRef}
            className={`inp ${emailErr || errorMessage ? 'inp--error' : ''}`}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state?.email ?? ''}
            placeholder="founder@company.com"
            required
            aria-invalid={emailErr ? true : undefined}
            aria-describedby={emailErr ? 'login-email-err' : undefined}
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
            <p className="err" id="login-email-err" aria-live="polite">{emailErr}</p>
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
            <label htmlFor="login-password">Password</label>
            <a className="hint underline underline-offset-[4px] hover:text-action" href="/forgot-password">
              Forgot password?
            </a>
          </div>
          <div className="pwwrap">
            <input
              id="login-password"
              className={`inp ${passwordErr || errorMessage ? 'inp--error' : ''}`}
              name="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              aria-invalid={passwordErr ? true : undefined}
              aria-describedby={passwordErr ? 'login-password-err' : undefined}
              onBlur={(e) => setPasswordErr(e.target.value ? undefined : 'Enter your password.')}
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
            <p className="err" id="login-password-err" aria-live="polite">{passwordErr}</p>
          ) : null}
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
          Join the beta
        </a>
      </div>
    </div>
  );
}
