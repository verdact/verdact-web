'use client';

// Root-level error boundary. Catches uncaught render/data errors in any route
// that does not have its own closer error.tsx. Calm, honest copy and a retry
// that re-fetches the segment. Never surfaces a stack trace in production:
// the digest is the only server-correlated identifier we expose.
import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error:', error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-ink"
    >
      <div className="w-full max-w-md text-center">
        <p className="label-mono mb-4">Something interrupted</p>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-ink">
          This page did not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          A temporary problem stopped Verdact from finishing this view. Your work is
          safe. Try again, and if it keeps happening, reach us at{' '}
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
          <a href="/dashboard" className="btn btn--ghost">
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
