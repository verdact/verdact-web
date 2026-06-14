import 'server-only';

import type { User } from '@supabase/supabase-js';
import type { GatedAction } from './actions';

/**
 * The single entitlements seam: `can(user, action)`.
 *
 * Entitlements decision #3, axes A1 + B1. This is the ONE place the Free→Paid
 * line is enforced. Every gated action (download / export / submit to Stripe /
 * enable automation / configure alerts) routes through here.
 *
 * BETA POSTURE: returns unlocked for every action. The beta makes the Paid tier
 * free for all merchants, so the gate is open — but every call site is ALREADY
 * routed through this function, so turning billing on post-OPT is a one-line
 * change here (flip BETA_ALL_UNLOCKED to false / wire the subscription read),
 * with zero call-site edits.
 *
 * SCOPE GUARD (KISS/YAGNI): this is a boolean gate keyed on a small action enum.
 * It is NOT an RBAC engine, policy framework, or feature-flag platform. Do not
 * grow roles/conditions/tiers beyond the two locked tiers here.
 */

// Master beta flag. While true, every gated action is unlocked for everyone.
// Overridable by env for testing the gated state without a code change:
//   VERDACT_BETA_ALL_UNLOCKED=false  → exercises the paid-check path.
function isBetaAllUnlocked(): boolean {
  const raw = process.env.VERDACT_BETA_ALL_UNLOCKED;
  if (raw === 'false' || raw === '0') return false;
  return true; // default: beta open
}

export interface CanResult {
  allowed: boolean;
  // 'beta' when allowed because beta unlocks everything; 'paid' when the user
  // holds the paid entitlement; 'gated' when denied (Paid-only, beta off).
  reason: 'beta' | 'paid' | 'gated';
}

/**
 * Synchronous entitlement check. Pure over (user, action, beta-flag) so it is
 * trivially testable. Today it never reads the DB — beta unlocks all, and the
 * post-beta paid check (when added) belongs in `hasPaidEntitlement`, kept async
 * and separate so this stays a fast, side-effect-free gate.
 */
export function canSync(user: User | null, _action: GatedAction): CanResult {
  if (!user) {
    return { allowed: false, reason: 'gated' };
  }
  if (isBetaAllUnlocked()) {
    return { allowed: true, reason: 'beta' };
  }
  // Post-beta: paid entitlement is resolved by the async `can()`; the sync path
  // conservatively denies so a caller that only has the user object cannot
  // accidentally allow a Paid action once beta closes.
  return { allowed: false, reason: 'gated' };
}

/**
 * The async entitlement check used by server actions / route handlers. During
 * beta this is identical to `canSync`; once billing lands it additionally
 * consults `hasPaidEntitlement(user)`.
 */
export async function can(user: User | null, action: GatedAction): Promise<CanResult> {
  if (!user) {
    return { allowed: false, reason: 'gated' };
  }
  if (isBetaAllUnlocked()) {
    return { allowed: true, reason: 'beta' };
  }
  const paid = await hasPaidEntitlement(user);
  return paid ? { allowed: true, reason: 'paid' } : { allowed: false, reason: 'gated' };
}

/**
 * Whether the user holds the Paid entitlement (post-beta). Stubbed to `false`
 * today: there is no billing yet, and beta short-circuits before this is
 * reached. When billing lands, resolve the subscription here (one place).
 */
export async function hasPaidEntitlement(_user: User): Promise<boolean> {
  return false;
}

/** Convenience boolean for call sites that only need allow/deny. */
export async function canDo(user: User | null, action: GatedAction): Promise<boolean> {
  return (await can(user, action)).allowed;
}
