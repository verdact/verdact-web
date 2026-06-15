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

// Persona IDs used for persona-weighted ranking adjustments.
export type GuidancePersona = 'marcus' | 'priya' | 'david' | 'aisha';

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
  // Whether the merchant has a self-selected persona on file. False → the gentle
  // "tailor your tips" re-prompt fires (persona is ask-only; never inferred).
  personaKnown: boolean;
}

/** A rendered guidance item ready for a surface to display. */
export interface GuidanceItem {
  id: string;
  layer: GuidanceLayer;
  target: GuidanceTarget;
  text: string;
  action: string;
  actionHref?: string;
  // Propagated from render — see GuidanceRender.targetRef.
  targetRef?: string;
  severity: GuidanceSeverity;
  weight: number;
  // Resolved at evaluation from the rule's `urgent`. Urgent items are exempt
  // from cadence suppression and never offer a dismiss control.
  urgent: boolean;
}

/** What a rule's render returns (id/layer/target/weight come from the rule). */
export type GuidanceRender = Pick<GuidanceItem, 'text' | 'action' | 'severity'> & {
  actionHref?: string;
  // Object reference for dedup: inline-at-object wins; the band aggregates and
  // points there instead of duplicating. E.g. a dispute ID or EFW charge ID.
  targetRef?: string;
};

export interface GuidanceRule {
  id: string;
  layer: GuidanceLayer;
  target: GuidanceTarget;
  weight: number;
  // Fallback rules only fill the band to its minimum when too few real-signal
  // rules fired; they never displace a real-signal rule.
  fallback?: boolean;
  // Data precondition (honesty gate — step 1): signals must satisfy this before
  // the trigger is evaluated. Use when the rule requires a specific data field
  // to be non-null/non-empty before it can fire truthfully.
  dataPrecondition?: (signals: GuidanceSignals) => boolean;
  // Honesty gate (step 2): fire only when this merchant's condition is met.
  trigger: (signals: GuidanceSignals) => boolean;
  render: (signals: GuidanceSignals) => GuidanceRender;
  // Deadline / account-risk urgency. true (or a predicate that returns true)
  // marks the item urgent: it is exempt from cadence suppression and shows until
  // the underlying issue resolves. Omitted → non-urgent (rests per cadence).
  urgent?: boolean | ((signals: GuidanceSignals) => boolean);
  // Per-persona ranking weight multipliers. When set, the rule's effective weight
  // is `weight * (personaWeight[persona] ?? 1)` during evaluation.
  personaWeight?: Partial<Record<GuidancePersona, number>>;
}

export interface GuidanceResult {
  band: GuidanceItem[];
  inline: GuidanceItem[];
  primers: GuidanceItem[];
}
