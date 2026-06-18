'use client';

// Dashboard segment error boundary. Sits below the dashboard layout (which only
// guards the session), so it replaces the page output. Keeps the merchant calm,
// never blames them, and offers a retry that re-fetches the dashboard data.
import { useEffect } from 'react';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] unhandled error:', error);
  }, [error]);

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-ink"
    >
      <div className="w-full max-w-md text-center">
        <p className="label-mono mb-4">Dashboard interrupted</p>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-ink">
          We could not load your workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          A temporary problem stopped your disputes and account health from loading.
          Nothing was lost. Try again, and if it persists, reach us at{' '}
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
            Reload dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
