'use client';

import { useActionState } from 'react';
import {
  confirmMergeAction,
  rejectMergeAction,
  type MergeActionState,
} from '@/lib/customers/actions';
import type { MergeSuggestion } from '@/lib/customers/types';
import s from './customers.module.css';

// Client merge/split controls (R8). The server actions persist the decision and
// revalidate; these wrappers add a pending state and an inline success/error
// line so the choice never fails silently. Markup + classes mirror the previous
// inline forms — only the feedback affordances are new.

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

function Feedback({ state }: { state: MergeActionState }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <span className={s.formMsg} role="status">
        {state.decision === 'merge' ? 'Linked.' : 'Kept separate.'}
      </span>
    );
  }
  return (
    <span className={`${s.formMsg} ${s.formMsgError}`} role="alert">
      {state.error}
    </span>
  );
}

// Merge icon for the primary "Yes, merge" affordance.
const MERGE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M8 7L4 11l4 4" />
    <path d="M16 17l4-4-4-4" />
    <path d="M4 11h13a3 3 0 003-3" />
  </svg>
);

// "Yes, merge" on a doubtful prompt (confirms the two are the same customer).
export function ConfirmMergeForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    confirmMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} includeReason />
      <button type="submit" className={s.suggestConfirm} disabled={pending} aria-busy={pending}>
        {!pending && MERGE_ICON}
        {pending ? 'Linking…' : 'Yes, merge'}
      </button>
      <Feedback state={state} />
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
      <Feedback state={state} />
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
      <Feedback state={state} />
    </form>
  );
}
