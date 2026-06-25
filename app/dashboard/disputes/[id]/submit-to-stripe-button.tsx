'use client';

import { useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { approveEvidenceAction, submitToStripeAction } from './actions';

/**
 * Approve + Submit control for the Evidence Record. State is fully prop-driven and
 * honest: it never claims a live filing while the kill switch is off, and it routes
 * through the fail-closed server actions (which re-verify everything server-side).
 *
 * Flow: not-approved -> "Approve record" -> approved -> (kill switch / opt-in /
 * submittable gates) -> "Submit to Stripe". Terminal states (submitted / closed /
 * past-deadline) are disabled with a clear label.
 */

interface SubmitToStripeButtonProps {
  disputeId: string;
  approved: boolean;
  submitted: boolean;
  isClosed: boolean;
  pastDeadline: boolean;
  submittable: boolean; // dispute status === 'needs_response'
  submissionEnabled: boolean; // VERDACT_SUBMISSION_ENABLED kill switch
  optedIn: boolean; // merchant_profiles.submission_opt_in
}

const BTN = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold';
const PRIMARY = `${BTN} bg-action text-white disabled:cursor-not-allowed disabled:opacity-60`;
const DISABLED = `${BTN} bg-action text-white cursor-not-allowed opacity-60`;

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-white/20 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em]">
      {children}
    </span>
  );
}

export function SubmitToStripeButton(props: SubmitToStripeButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
      else router.refresh();
    });
  }

  // Terminal / non-actionable states.
  if (props.submitted) {
    return (
      <button type="button" disabled className={DISABLED}>
        Submitted <Badge>Done</Badge>
      </button>
    );
  }
  if (props.isClosed) {
    return (
      <button type="button" disabled className={DISABLED} title="This dispute is closed.">
        Dispute closed
      </button>
    );
  }
  if (props.pastDeadline) {
    return (
      <button type="button" disabled className={DISABLED} title="The response deadline for this dispute has passed.">
        Past deadline
      </button>
    );
  }

  // Not yet approved: the merchant must explicitly sign off before any submit.
  if (!props.approved) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          className={PRIMARY}
          disabled={pending}
          onClick={() => run(() => approveEvidenceAction({ disputeId: props.disputeId }))}
        >
          {pending ? 'Approving' : 'Approve record'}
        </button>
        {error ? <p className="text-xs text-accent">{error}</p> : null}
      </div>
    );
  }

  // Approved. The submit control honestly reflects the kill switch + opt-in.
  if (!props.submissionEnabled) {
    return (
      <button
        type="button"
        disabled
        className={DISABLED}
        title="Filing to Stripe is not open during beta. We will tell you the moment it opens, and nothing is ever sent without your sign-off."
      >
        Submit to Stripe <Badge>Opening soon</Badge>
      </button>
    );
  }
  if (!props.optedIn) {
    return (
      <button
        type="button"
        disabled
        className={DISABLED}
        title="Turn submission on in Settings before filing. Nothing is sent without your sign-off."
      >
        Submit to Stripe <Badge>Off</Badge>
      </button>
    );
  }
  if (!props.submittable) {
    return (
      <button
        type="button"
        disabled
        className={DISABLED}
        title="This dispute is not in a state where evidence can be submitted."
      >
        Submit to Stripe
      </button>
    );
  }

  // Fully enabled: a real submit (test or live depending on the configured Stripe key).
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={PRIMARY}
        disabled={pending}
        onClick={() => run(() => submitToStripeAction({ disputeId: props.disputeId }))}
      >
        {pending ? 'Submitting' : 'Submit to Stripe'}
      </button>
      {error ? <p className="text-xs text-accent">{error}</p> : null}
    </div>
  );
}
