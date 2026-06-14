/**
 * Guidance engine types (Standing Docket build plan §2).
 *
 * One guidance SYSTEM, four delivery layers, a single shared rule catalogue over
 * the merchant's own signals. Pure and DB-free so it stays testable; the surface
 * (dashboard/workbench/…) computes signals and renders the items.
 *
 * Honesty gate (Decision #2): a rule fires ONLY when its claim is truthfully
 * computed from this merchant's signals. No generic SaaS advice, no fabricated
 * or empty-state claims.
 */

export type HealthBand = 'healthy' | 'close' | 'at-risk' | 'unknown';

// neutral = informational/calm · gap = something to act on · verified = a win/strength.
export type GuidanceSeverity = 'neutral' | 'gap' | 'verified';

// Delivery layer (plan §2): band = Zone-D dashboard cards (Layer 1); inline =
// contextual tips at the object (Layer 2); primer = pull-only educational (Layer 4).
// (Layer 3 first-run coachmarks need a prefs table — deferred, not modelled here.)
export type GuidanceLayer = 'band' | 'inline' | 'primer';

export type GuidanceTarget = 'dashboard' | 'account-health' | 'disputes' | 'settings' | 'workbench';

/**
 * The merchant's own signals the rules read. Everything is derived from live
 * data the surface already holds — no rule may invent a signal that is absent.
 */
export interface GuidanceSignals {
  hasStripe: boolean;
  openDisputeCount: number;
  needsActionCount: number;
  healthBand: HealthBand;
  // True only when the account-health snapshot is a real, confident number
  // (medium/high confidence). Gates any rule that quotes the dispute rate.
  healthConfident: boolean;
  actionableEfwCount: number;
  // Whether the merchant has filled enough of their business profile to build a
  // response without first stopping to set it up.
  profileComplete: boolean;
  // Days to the nearest open deadline (null when none open). Negative = overdue.
  nearestDeadlineDays: number | null;
}

/** A rendered guidance item ready for a surface to display. */
export interface GuidanceItem {
  id: string;
  layer: GuidanceLayer;
  target: GuidanceTarget;
  text: string;
  action: string;
  actionHref?: string;
  severity: GuidanceSeverity;
  weight: number;
}

/** What a rule's render returns (id/layer/target/weight come from the rule). */
export type GuidanceRender = Pick<GuidanceItem, 'text' | 'action' | 'severity'> & {
  actionHref?: string;
};

export interface GuidanceRule {
  id: string;
  layer: GuidanceLayer;
  target: GuidanceTarget;
  weight: number;
  // Fallback rules only fill the band to its minimum when too few real-signal
  // rules fired; they never displace a real-signal rule.
  fallback?: boolean;
  // Honesty gate: fire only when truthfully supported by these signals.
  trigger: (signals: GuidanceSignals) => boolean;
  render: (signals: GuidanceSignals) => GuidanceRender;
}

export interface GuidanceResult {
  band: GuidanceItem[];
  inline: GuidanceItem[];
  primers: GuidanceItem[];
}
