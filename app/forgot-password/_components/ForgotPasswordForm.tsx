'use client';

import { useActionState, useRef, useState } from 'react';
import {
  requestPasswordResetAction,
  type PasswordResetState,
} from '@/lib/auth/actions';
import { suggestEmail, validateEmail } from '../../_components/auth-email';
import { MailIcon } from '../../_components/auth-icons';

const initialState: PasswordResetState = undefined;

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  const [emailErr, setEmailErr] = useState<string | undefined>(undefined);
  const [emailSugg, setEmailSugg] = useState<string | undefined>(undefined);
  const emailRef = useRef<HTMLInputElement>(null);

  if (state?.sent) {
    return (
      <div className="space-y-5">
        <div className="notice notice--info" role="status">
          <MailIcon />
          <span>
            If a Verdact account exists for <strong>{state.email}</strong>, a
            reset link is on the way.
          </span>
        </div>

        <a className="btn btn--primary w-full" href="/login">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" suppressHydrationWarning>
      {state?.error ? (
        <div className="notice notice--error" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
          </svg>
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="reset-email">Work email</label>
        <input
          id="reset-email"
          ref={emailRef}
          className={`inp ${emailErr || state?.error ? 'inp--error' : ''}`}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.email ?? ''}
          placeholder="founder@company.com"
          required
          aria-invalid={emailErr ? true : undefined}
          aria-describedby={emailErr ? 'reset-email-err' : undefined}
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
          <p className="err" id="reset-email-err" aria-live="polite">
            {emailErr}
          </p>
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

      <button
        type="submit"
        disabled={pending}
        className={`btn btn--primary w-full ${pending ? 'btn--loading' : ''}`}
      >
        {pending ? 'Sending link...' : 'Send reset link'}
      </button>
    </form>
  );
}
