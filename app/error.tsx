'use client';

// Root-level error boundary. Catches uncaught render/data errors in any route
// that does not have its own closer error.tsx. Calm, honest copy and a retry
// that re-fetches the segment. Never surfaces a stack trace in production:
// the digest is the only server-correlated identifier we expose.
//
// Redesign 2026-06-27: renders the shared AppErrorCard (the workbench-grade calm
// reassurance card) instead of bare centered text, and tags the full-screen root
// with data-app-surface so a dark-mode user who errors stays in their familiar
// dark theme (globals.css scopes the dark tokens to that attribute). The
// duplicate id="main" is dropped (S3): the skip-link target lives on the shell;
// a full-screen error page has nothing to skip past.
import { useEffect } from 'react';
import { AppErrorCard } from './_components/ui/app-error-card';

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
      data-app-surface
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 py-12 text-[var(--ink)]"
    >
      <AppErrorCard
        eyebrow="Something interrupted"
        title="This page did not load"
        onPrimary={() => unstable_retry()}
        primaryLabel="Try again"
        secondaryHref="/dashboard"
        secondaryLabel="Back to dashboard"
        body={
          <>
            A temporary problem stopped Verdact from finishing this view. Your work
            is safe. Try again, and if it keeps happening, reach us at{' '}
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
