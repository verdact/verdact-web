'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckIcon } from '../../_components/auth-icons';

function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter your new password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  return undefined;
}

type FormState =
  | {
      error?: string;
      updated?: boolean;
    }
  | undefined;

export function ResetPasswordForm() {
  const [state, setState] = useState<FormState>(undefined);
  const [pending, setPending] = useState(false);
  const [passwordErr, setPasswordErr] = useState<string | undefined>(undefined);
  const [confirmErr, setConfirmErr] = useState<string | undefined>(undefined);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = (formData.get('password') as string | null) ?? '';
    const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

    const passwordError = validatePassword(password);
    if (passwordError) {
      setPasswordErr(passwordError);
      setState(undefined);
      return;
    }
    if (!confirmPassword) {
      setConfirmErr('Confirm your new password.');
      setState(undefined);
      return;
    }
    if (password !== confirmPassword) {
      setState({ error: 'Passwords do not match.' });
      return;
    }

    setPending(true);
    setState(undefined);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPending(false);
      setState({
        error: 'This reset link has expired. Request a new link to continue.',
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setState({ error: error.message });
      return;
    }

    setState({ updated: true });
  }

  if (state?.updated) {
    return (
      <div className="space-y-5">
        <div className="notice notice--info" role="status">
          <CheckIcon />
          <span>Your password has been updated.</span>
        </div>

        <a className="btn btn--primary w-full" href="/dashboard">
          Continue to dashboard
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" suppressHydrationWarning>
      {state?.error ? (
        <div className="notice notice--error" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
          </svg>
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="field">
        <div className="lblrow">
          <label htmlFor="new-password">New password</label>
          <span className="hint">Min. 8 characters</span>
        </div>
        <div className="pwwrap">
          <input
            id="new-password"
            className={`inp ${passwordErr || state?.error ? 'inp--error' : ''}`}
            name="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            placeholder="••••••••"
            required
            aria-invalid={passwordErr ? true : undefined}
            aria-describedby={passwordErr ? 'new-password-err' : undefined}
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
          <p className="err" id="new-password-err" aria-live="polite">
            {passwordErr}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          className={`inp ${confirmErr || state?.error ? 'inp--error' : ''}`}
          name="confirmPassword"
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          placeholder="••••••••"
          required
          aria-invalid={confirmErr ? true : undefined}
          aria-describedby={confirmErr ? 'confirm-password-err' : undefined}
          onBlur={(e) => {
            setConfirmErr(e.target.value ? undefined : 'Confirm your new password.');
          }}
          onChange={() => setConfirmErr(undefined)}
        />
        {confirmErr ? (
          <p className="err" id="confirm-password-err" aria-live="polite">
            {confirmErr}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`btn btn--primary w-full ${pending ? 'btn--loading' : ''}`}
      >
        {pending ? 'Updating password...' : 'Update password'}
      </button>
    </form>
  );
}
