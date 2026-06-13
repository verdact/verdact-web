'use client';

import { useActionState } from 'react';
import { refreshAccountHealthAction, type RefreshState } from '../actions';
import s from '../account-health.module.css';

// Free Refresh (Decision #11). Sends the recompute event without force, so a
// snapshot under 24h old is served from cache. The reading updates async via
// Inngest, so the result line sets that expectation. The "Updated X ago"
// freshness sits next to this button in the header (see account-health-view).
export function RefreshButton() {
  const [state, formAction, pending] = useActionState<RefreshState, FormData>(
    () => refreshAccountHealthAction(undefined),
    undefined,
  );

  return (
    <form action={formAction} className={s.refreshForm}>
      <button type="submit" className={s.refreshBtn} disabled={pending}>
        {pending ? 'Refreshing…' : 'Refresh'}
      </button>
      {state?.error ? (
        <span className={`${s.refreshMsg} ${s.refreshMsgError}`} role="alert">
          {state.error}
        </span>
      ) : null}
      {state?.ok ? (
        <span className={s.refreshMsg} role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
