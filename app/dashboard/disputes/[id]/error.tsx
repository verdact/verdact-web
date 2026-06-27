'use client';

// Evidence record (workbench) error boundary. This route enriches the dispute
// with live Stripe charge data, so a transient upstream hiccup is the most
// likely cause: lead with a retry. Honest, no blame, no stack trace in prod.
//
// Redesign 2026-06-27: renders the shared AppErrorCard for the calm
// workbench-grade reassurance surface, theme-aware via data-app-surface so a
// dark-mode user stays dark. id="main" dropped (S3).
import { useEffect } from 'react';
import { AppErrorCard } from '@/app/_components/ui/app-error-card';

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
      data-app-surface
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6 py-12 text-[var(--ink)]"
    >
      <AppErrorCard
        eyebrow="Evidence record interrupted"
        title="We could not open this record"
        onPrimary={() => unstable_retry()}
        primaryLabel="Try again"
        secondaryHref="/dashboard/disputes"
        secondaryLabel="Back to disputes"
        body={
          <>
            A temporary problem stopped this dispute from loading, often while
            pulling the latest charge details. Your evidence is safe. Try again,
            and if it persists, reach us at{' '}
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
