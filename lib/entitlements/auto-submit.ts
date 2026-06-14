import 'server-only';

import type { User } from '@supabase/supabase-js';
import { can } from './can';
import { writePreActionAudit } from './audit';

/**
 * INERT auto-submit gate (Entitlements decision #3, axis C1).
 *
 * This scaffolds the merchant-controlled auto-submit pathway so the control
 * wedge is demonstrable, WITHOUT ever filing. It is built fail-closed with
 * three CRITICAL, non-negotiable guardrails:
 *
 *   1. GLOBAL KILL SWITCH (env) — `VERDACT_AUTO_SUBMIT_ENABLED` must be exactly
 *      "true" to even consider proceeding. Absent / anything else = hard off.
 *      This switch is independent of any per-user flag and is verified OFF in
 *      every non-prod environment. It is the outermost gate.
 *   2. DEFAULT-DENY — every decision branch that is not an explicit, fully
 *      satisfied allow returns `{ willFire: false }`. There is no default-allow
 *      path anywhere in this module.
 *   3. IMMUTABLE PRE-ACTION AUDIT — a row is written BEFORE any (hypothetical)
 *      submission; if the audit write fails, the gate denies.
 *
 * Additionally, the real submission is NOT implemented here: even if all gates
 * passed, `evaluateAutoSubmit` returns a decision object and performs no Stripe
 * call. Wiring an actual submit is a separate, spec-gated task. Today this
 * module CANNOT file by construction.
 *
 * The legal gate (OPT + Delaware LLC + charges-disabled test account) is a
 * second, independent floor underneath all of this.
 */

export interface AutoSubmitContext {
  user: User | null;
  merchantId: string | null;
  disputeId: string;
  // Per-merchant opt-in flag (default OFF). Even when true, the kill switch and
  // approval/audit gates still apply.
  merchantOptedIn: boolean;
  // Explicit, specific approval of THIS response by the merchant. Auto-submit
  // does not bypass approval; it pre-authorizes within strict bounds only.
  hasExplicitApproval: boolean;
  approvedByUserId: string | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
}

export interface AutoSubmitDecision {
  // Whether a real submission WOULD fire. Always false today (inert): even a
  // fully-allowed decision performs no Stripe call.
  willFire: boolean;
  // Why the gate denied (or 'allowed_inert' when all gates passed but the
  // module is intentionally inert).
  reason:
    | 'kill_switch_off'
    | 'not_opted_in'
    | 'not_approved'
    | 'no_entitlement'
    | 'audit_write_failed'
    | 'allowed_inert';
  auditId: string | null;
}

/** The outermost, independent kill switch. Hard-off unless env is exactly "true". */
export function isAutoSubmitGloballyEnabled(): boolean {
  return process.env.VERDACT_AUTO_SUBMIT_ENABLED === 'true';
}

/**
 * Evaluate whether auto-submit would fire. Default-deny throughout; never calls
 * Stripe. Returns a decision object for surfacing the control state in the UI.
 */
export async function evaluateAutoSubmit(
  ctx: AutoSubmitContext,
): Promise<AutoSubmitDecision> {
  // Gate 1 — global kill switch (outermost, independent of per-user state).
  if (!isAutoSubmitGloballyEnabled()) {
    return { willFire: false, reason: 'kill_switch_off', auditId: null };
  }

  // Gate 2 — merchant opt-in (default OFF).
  if (!ctx.merchantOptedIn) {
    return { willFire: false, reason: 'not_opted_in', auditId: null };
  }

  // Gate 3 — explicit, specific approval of this response.
  if (!ctx.hasExplicitApproval) {
    return { willFire: false, reason: 'not_approved', auditId: null };
  }

  // Gate 4 — paid entitlement (automation is a Paid action).
  const entitlement = await can(ctx.user, 'enable_automation');
  if (!entitlement.allowed) {
    return { willFire: false, reason: 'no_entitlement', auditId: null };
  }

  // Gate 5 — immutable pre-action audit. Fail closed if the write fails.
  const auditId = await writePreActionAudit({
    merchantId: ctx.merchantId,
    userId: ctx.approvedByUserId,
    action: 'auto_submit.attempt',
    resource: ctx.disputeId,
    metadata: {
      inert: true,
      killSwitch: isAutoSubmitGloballyEnabled(),
      entitlementReason: entitlement.reason,
    },
    requestIp: ctx.requestIp ?? null,
    requestUserAgent: ctx.requestUserAgent ?? null,
  });
  if (!auditId) {
    return { willFire: false, reason: 'audit_write_failed', auditId: null };
  }

  // All gates passed — but the module is intentionally INERT. No Stripe call is
  // made. willFire stays false until the safety spec lands and a real submit is
  // wired behind these same gates.
  return { willFire: false, reason: 'allowed_inert', auditId };
}
