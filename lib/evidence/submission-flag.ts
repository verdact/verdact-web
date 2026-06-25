import 'server-only';

/**
 * Global kill switch for LIVE Stripe dispute-evidence filing.
 *
 * The manual "submit to Stripe" path (lib/evidence/stripe-submit.ts) is built and
 * test-mode-exercisable, but live filing on a real merchant dispute is gated by a
 * locked legal decision (Delaware LLC + F-1/OPT immigration clearance). Until both
 * clear, this stays OFF and the submit path returns `kill_switch_off` before any
 * Stripe write.
 *
 * Mirrors `isAutoSubmitGloballyEnabled()` (lib/entitlements/auto-submit.ts): hard-off
 * unless the env value is exactly "true". This is the OUTERMOST gate, independent of
 * the per-merchant opt-in and the `submit_to_stripe` entitlement.
 *
 * IMPORTANT: this is a feature flag, NOT a required secret. It must NEVER throw when
 * unset (unlike AUDIT_IP_SALT) — an unset value means "feature off", and the app must
 * deploy and run normally with submission inert.
 */
export function isSubmissionEnabled(): boolean {
  return process.env.VERDACT_SUBMISSION_ENABLED === 'true';
}
