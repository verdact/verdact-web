'use client';

// Evidence record (workbench) error boundary. This route enriches the dispute
// with live Stripe charge data, so a transient upstream hiccup is the most
// likely cause: lead with a retry. Honest, no blame, no stack trace in prod.
import { useEffect } from 'react';

export default function WorkbenchError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[workbench] unhandled error:', error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-ink"
    >
      <div className="w-full max-w-md text-center">
        <p className="label-mono mb-4">Evidence record interrupted</p>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-ink">
          We could not open this record
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          A temporary problem stopped this dispute from loading, often while pulling
          the latest charge details. Your evidence is safe. Try again, and if it
          persists, reach us at{' '}
          <a
            href="mailto:support@verdact.io"
            className="text-action underline underline-offset-4 hover:text-action-deep"
          >
            support@verdact.io
          </a>
          .
        </p>

        {error.digest ? (
          <p className="label-mono mt-5 text-ink-mute">Reference {error.digest}</p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => unstable_retry()} className="btn btn--primary">
            Try again
          </button>
          <a href="/dashboard/disputes" className="btn btn--ghost">
            Back to disputes
          </a>
        </div>
      </div>
    </main>
  );
}
