'use client';

import { useState, useTransition } from 'react';
import { deleteEvidenceFileAction } from './actions';

/**
 * Inline "Remove" control for an attached evidence file. Deletes the row + blob
 * via deleteEvidenceFileAction, then the revalidated workbench drops the row.
 */
export function RemoveFileButton({
  fileId,
  disputeId,
}: {
  fileId: string;
  disputeId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-xs text-accent">{error}</span> : null}
      <button
        type="button"
        className="rounded-sm text-xs font-semibold text-ink-mute underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40 disabled:opacity-60"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await deleteEvidenceFileAction({ fileId, disputeId });
            if (!res.ok) setError(res.error ?? 'Could not remove.');
          })
        }
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
    </span>
  );
}
