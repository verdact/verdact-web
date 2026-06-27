'use client';

// Dashboard segment error boundary. Sits below the dashboard layout (which only
// guards the session), so it replaces the page output. Keeps the merchant calm,
// never blames them, and offers a retry that re-fetches the dashboard data.
//
// Redesign 2026-06-27: renders the shared AppErrorCard for the calm
// workbench-grade reassurance surface, theme-aware via data-app-surface so a
// dark-mode user stays dark. id="main" dropped (S3) — the skip target is the
// shell's main, and a full-screen error has nothing to skip.
import { useEffect } from 'react';
import { AppErrorCard } from '../_components/ui/app-error-card';

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
      data-app-surface
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 py-12 text-[var(--ink)]"
    >
      <AppErrorCard
        eyebrow="Dashboard interrupted"
        title="We could not load your workspace"
        onPrimary={() => unstable_retry()}
        primaryLabel="Try again"
        secondaryHref="/dashboard"
        secondaryLabel="Reload dashboard"
        body={
          <>
            A temporary problem stopped your disputes and account health from
            loading. Nothing was lost. Try again, and if it persists, reach us at{' '}
            <a
              href="mailto:support@verdact.io"
              className="text-action underline underline-offset-4 hover:text-action-deep"
            >
              support@verdact.io
            </a>
            .
            {error.digest ? (
              <span className="label-mono mt-4 block text-ink-mute">
                Reference {error.digest}
              </span>
            ) : null}
          </>
        }
      />
    </main>
  );
}
