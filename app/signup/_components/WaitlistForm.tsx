'use client';

import { useRef, useState, type FormEvent } from 'react';
import { suggestEmail, validateEmail } from '../../_components/auth-email';
import { CheckIcon } from '../../_components/auth-icons';

type Status = 'idle' | 'submitting' | 'done';

// Public waitlist capture for the launching-soon gate. Mirrors the audit funnel:
// the client posts JSON to a rate-limited, service-role-backed route and the
// server is the source of truth. No account is created here.
export function WaitlistForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [emailErr, setEmailErr] = useState<string | undefined>(undefined);
  const [emailSugg, setEmailSugg] = useState<string | undefined>(undefined);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const email = emailRef.current?.value.trim() ?? '';
    const localErr = validateEmail(email);
    if (localErr) {
      setEmailErr(localErr);
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'launching_soon' }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }

      setStatus('done');
    } catch {
      setError('Could not reach the server. Please try again.');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="notice notice--info" role="status">
        <CheckIcon className="h-4 w-4" />
        <span>You&rsquo;re on the list. We&rsquo;ll email you the moment Verdact is live.</span>
      </div>
    );
  }

  const pending = status === 'submitting';

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? (
        <div className="notice notice--error" role="alert">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V4zm1 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="waitlist-email">Work email</label>
        <input
          id="waitlist-email"
          ref={emailRef}
          className={`inp ${emailErr ? 'inp--error' : ''}`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="founder@company.com"
          required
          disabled={pending}
          aria-invalid={emailErr ? true : undefined}
          aria-describedby={emailErr ? 'waitlist-email-err' : undefined}
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
          <p className="err" id="waitlist-email-err" aria-live="polite">{emailErr}</p>
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
        {pending ? 'Adding you…' : 'Join the waitlist'}
      </button>
    </form>
  );
}
