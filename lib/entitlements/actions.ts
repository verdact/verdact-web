/**
 * The SMALL, closed enum of gated actions.
 *
 * Entitlements decision #3 (2026-06-13), axis B1: `can()` is a boolean gate
 * keyed on a small action enum — NOT a policy engine, RBAC framework, or
 * feature-flag platform. Keep this list short and concrete. Anything beyond the
 * two locked tiers (Free / Paid; beta = Paid free for all) is out of scope.
 *
 * Tier mapping (A1 — "build+view free; download/export/file is Paid"):
 *   FREE  : build + view the evidence packet (always allowed; no action here).
 *   PAID  : download_packet, export_packet, submit_to_stripe, enable_automation,
 *           configure_alerts.
 *
 * During beta every action returns unlocked (see can.ts). When billing turns on
 * post-OPT, the gate flips inside can() with ZERO changes to call sites.
 */

export const GATED_ACTIONS = [
  'download_packet',
  'export_packet',
  'submit_to_stripe',
  'enable_automation',
  'configure_alerts',
] as const;

export type GatedAction = (typeof GATED_ACTIONS)[number];

// Human-facing labels for the gate's "this is a Paid action" messaging. Never
// a price — beta framing only ("available on the paid plan").
export const ACTION_LABELS: Record<GatedAction, string> = {
  download_packet: 'Download the evidence packet',
  export_packet: 'Export the evidence packet',
  submit_to_stripe: 'Submit the response to Stripe',
  enable_automation: 'Turn on auto-submit',
  configure_alerts: 'Turn on alerts',
};

export function isGatedAction(value: string): value is GatedAction {
  return (GATED_ACTIONS as readonly string[]).includes(value);
}
