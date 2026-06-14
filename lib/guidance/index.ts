/**
 * Guidance engine public surface (Standing Docket build plan §2).
 *
 * One rule catalogue over the merchant's own signals, four delivery layers:
 *   Layer 1 — dashboard band      → evaluateGuidance(...).band
 *   Layer 2 — contextual inline   → evaluateGuidance(...).inline (extensible)
 *   Layer 4 — educational primers → evaluateGuidance(...).primers
 * (Layer 3 first-run coachmarks need a prefs table — deferred.)
 */

export { evaluateGuidance, type EvaluateOptions } from './engine';
export { GUIDANCE_RULES } from './rules';
export type {
  GuidanceSignals,
  GuidanceItem,
  GuidanceResult,
  GuidanceRule,
  GuidanceRender,
  GuidanceSeverity,
  GuidanceLayer,
  GuidanceTarget,
  HealthBand,
} from './types';
