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

// "Confirm same customer" on a doubtful prompt.
export function ConfirmMergeForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    confirmMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} includeReason />
      <button type="submit" className={s.suggestConfirm} disabled={pending} aria-busy={pending}>
        {pending ? 'Linking…' : 'Confirm same customer'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// "Not the same" on a doubtful prompt (records a split).
export function RejectMergeForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    rejectMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} />
      <button type="submit" className={s.suggestReject} disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Not the same'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// "Not the same" undo on an auto-linked pair (a labeled false positive).
export function AutoSplitForm({ suggestion }: { suggestion: MergeSuggestion }) {
  const [state, formAction, pending] = useActionState<MergeActionState, FormData>(
    rejectMergeAction,
    undefined,
  );
  return (
    <form action={formAction} className={s.inlineForm}>
      <SuggestionFields suggestion={suggestion} source="auto" />
      <button type="submit" className={s.autoSplit} disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Not the same'}
      </button>
      <Feedback state={state} />
    </form>
  );
}
