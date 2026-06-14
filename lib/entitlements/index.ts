/**
 * Entitlements seam (decision #3, 2026-06-13).
 *
 * Public surface:
 *   - can / canSync / canDo  — the Free→Paid gate (B1). Beta = all unlocked.
 *   - GATED_ACTIONS / GatedAction / ACTION_LABELS — the small action enum (A1).
 *   - evaluateAutoSubmit / isAutoSubmitGloballyEnabled — inert C1 auto-submit.
 *   - writePreActionAudit — immutable pre-action audit row (C1).
 *
 * Server-only: every module imports 'server-only'. Do not import into client
 * components; pass the resolved boolean / CanResult down as a prop instead.
 */

export { can, canSync, canDo, hasPaidEntitlement, type CanResult } from './can';
export {
  GATED_ACTIONS,
  ACTION_LABELS,
  isGatedAction,
  type GatedAction,
} from './actions';
export {
  evaluateAutoSubmit,
  isAutoSubmitGloballyEnabled,
  type AutoSubmitContext,
  type AutoSubmitDecision,
} from './auto-submit';
export { writePreActionAudit, type AuditEntry } from './audit';
