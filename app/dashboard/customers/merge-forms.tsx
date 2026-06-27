'use client';

import { useActionState } from 'react';
import {
  confirmMergeAction,
  rejectMergeAction,
  type MergeActionState,
} from '@/lib/customers/actions';
import type { MergeSuggestion } from '@/lib/customers/types';
import { CheckIcon, AlertIcon } from '../dash-icons';
import s from './customers.module.css';

// Client merge/split controls (R8). The server actions persist the decision and
// revalidate; these wrappers add a pending state and an inline success/error
// line so the choice never fails silently. Markup + classes mirror the previous
// inline forms — only the feedback copy/icons and the primary glyph changed, so
// the server-action wiring (confirmMergeAction / rejectMergeAction) is untouched.

function SuggestionFields({
  suggestion,
  includeReason = false,
  source,
}: {
  suggestion: MergeSuggestion;
  includeReason?: boolean;
  source?: 'auto';
}) {
  return (
    <>
      <input type="hidden" name="primaryKey" value={suggestion.primaryKey} />
      <input type="hidden" name="linkedKey" value={suggestion.linkedKey} />
      <input type="hidden" name="kind" value={suggestion.kind} />
      <input type="hidden" name="confidence" value={String(suggestion.confidence)} />
      {includeReason && <input type="hidden" name="reason" value={suggestion.reason} />}
      {source && <input type="hidden" name="source" value={source} />}
    </>
  );
}

// Which control produced the feedback, so a "split" can read as "kept separate"
// on a doubtful prompt but "unlinked" on an auto-linked undo.
type FeedbackIntent = 'confirm' | 'reject' | 'undo';

function successMessage(intent: FeedbackIntent): string {
  if (intent === 'confirm') return 'Linked. You can undo this anytime.';
  if (intent === 'undo') return 'Unlinked. They are separate now.';
  return 'Kept separate. We will not ask about this pair again.';
}

// Small but unmistakable confirmation line: a check glyph (verdict) for success,
// an alert glyph (gap) for error. Object-included copy reads meaningfully aloud.
// Reserved row height (in CSS) keeps a confirmation from jumping the card.
function Feedback({
  state,
  intent,
}: {
  state: MergeActionState;
  intent: FeedbackIntent;
}) {
  if (!state) return null;
  if (state.ok) {
    return (
      <span className={s.formMsg} role="status">
        <CheckIcon />
        {successMessage(intent)}
      </span>
    );
  }
  return (
    <span className={`${s.formMsg} ${s.formMsgError}`} role="alert">
      <AlertIcon />
      {state.error}
    </span>
  );
}

// Link icon for the primary "Yes, link them" affordance — a link, not a merge.
const LINK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5" />
  </svg>
);

// "Yes, link them" on a doubtful prompt (confirms the two are the same customer).
export function ConfirmMergeForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    confirmMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} includeReason />
      <button type="submit" className={s.suggestConfirm} disabled={pending} aria-busy={pending}>
        {!pending && LINK_ICON}
        {pending ? 'Linking…' : 'Yes, link them'}
      </button>
      <Feedback state={state} intent="confirm" />
    </form>
  );
}

// "Keep separate" on a doubtful prompt (records a split so we will not ask again).
export function RejectMergeForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    rejectMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} />
      <button type="submit" className={s.suggestReject} disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Keep separate'}
      </button>
      <Feedback state={state} intent="reject" />
    </form>
  );
}

// "Undo" on an auto-linked pair (a labeled false positive). Reversible, neutral.
export function AutoSplitForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    rejectMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} source="auto" />
      <button
        type="submit"
        className={s.autoSplit}
        disabled={pending}
        aria-busy={pending}
        aria-label={`Undo auto-link for ${suggestion.primaryLabel}`}
      >
        {pending ? 'Saving…' : 'Undo'}
      </button>
      <Feedback state={state} intent="undo" />
    </form>
  );
}
