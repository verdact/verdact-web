'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAcceptanceUnavailableAction } from './actions';
import styles from './workbench.module.css';

/**
 * The single home for the "mark delivery/acceptance proof unavailable" control
 * (Stage 1E). Lives inside the Evidence Record gap row. Honest by construction:
 * recording a reason notes the gap, it never fabricates proof or moves readiness.
 *
 *   - not noted  → a disclosure that records a reason ("Record gap").
 *   - noted      → the recorded reason + an Undo that clears it.
 */
export function AcceptanceUnavailable({
  disputeId,
  noted,
  reason,
}: {
  disputeId: string;
  noted: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (nextReason: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setAcceptanceUnavailableAction({ disputeId, reason: nextReason });
      if (!res.ok) {
        setError(res.error ?? 'Could not save your note.');
        return;
      }
      setOpen(false);
      setValue('');
      router.refresh();
    });
  };

  if (noted) {
    return (
      <div className="mt-3 rounded-md border border-rule bg-surface-2 px-3 py-2.5">
        <p className="text-xs leading-5 text-ink-soft">
          <span className="font-semibold text-ink">Noted as unavailable.</span>{' '}
          Verdact will file the rest and flag this gap. No formal sign-off is claimed.
        </p>
        {reason ? (
          <p className="mt-1.5 border-l-2 border-rule-strong pl-2.5 text-xs italic leading-5 text-ink-mute">
            {reason}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-action underline underline-offset-4 hover:text-action-deep disabled:opacity-60"
          onClick={() => submit('')}
          disabled={pending}
        >
          {pending ? 'Updating…' : 'Undo, I can supply this'}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 text-xs font-semibold text-ink-mute underline underline-offset-4 hover:text-ink"
        onClick={() => setOpen(true)}
      >
        No formal sign-off exists? Mark it unavailable, with a reason
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-rule-strong bg-surface px-3 py-3">
      <label className={`${styles.labelMono} mb-1.5 block`} htmlFor={`unavail-${disputeId}`}>
        Why is it unavailable?
      </label>
      <textarea
        id={`unavail-${disputeId}`}
        className="w-full resize-y rounded-md border border-rule-strong bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
        rows={2}
        maxLength={500}
        placeholder="e.g. The engagement was approved verbally; no signed document was ever produced."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error ? <p className="mt-1.5 text-xs text-accent">{error}</p> : null}
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-action px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => submit(value)}
          disabled={pending || value.trim().length === 0}
        >
          {pending ? 'Recording…' : 'Record gap'}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-ink-mute hover:text-ink"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
