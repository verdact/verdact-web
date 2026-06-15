/**
 * Guidance engine (Standing Docket build plan §2; persona + cadence 2026-06-15).
 *
 * Runs the rule catalogue over a merchant's signals and splits the fired items
 * by delivery layer. Pure and deterministic.
 *
 *   - band    (Layer 1): ranked by weight, real-signal rules first; fallbacks
 *                        only top it up to `minBand`; capped at `maxBand`.
 *   - inline  (Layer 2): contextual tips at the object, ranked.
 *   - primers (Layer 4): pull-only educational, ranked.
 *
 * Persona-weighted ranking (options.persona) and cadence suppression
 * (options.suppressedRuleIds) are applied here so they affect the band BEFORE
 * the fallback fill and the maxBand slice — a withheld item frees its slot
 * rather than leaving a hole.
 */

import { GUIDANCE_RULES } from './rules';
import type {
  GuidanceItem,
  GuidancePersona,
  GuidanceResult,
  GuidanceRule,
  GuidanceSignals,
  GuidanceTarget,
} from './types';

const DEFAULT_MIN_BAND = 2;
const DEFAULT_MAX_BAND = 4;

// Persona multiplier bounds. The multiplier only nudges ranking; it must never
// reorder the urgency spine (connect-stripe > needs-response > health-watch >
// efw-prevent). That is enforced structurally — spine rules carry no
// personaWeight — and clamped here as a backstop so a stray weight can't invert
// the spine.
const PERSONA_MULT_MIN = 0.5;
const PERSONA_MULT_MAX = 1.5;

export interface EvaluateOptions {
  target?: GuidanceTarget;
  minBand?: number;
  maxBand?: number;
  // Persona-weighted ranking. When set, a rule's effective weight is
  // weight * clamp(personaWeight[persona] ?? 1). Undefined → no multiplier.
  persona?: GuidancePersona;
  // Cadence: non-urgent band rules whose id is in this set are withheld this
  // render (still inside their rest window). Urgent rules are never withheld.
  suppressedRuleIds?: ReadonlySet<string>;
}

export function evaluateGuidance(
  signals: GuidanceSignals,
  options: EvaluateOptions = {},
): GuidanceResult {
  const target = options.target ?? 'dashboard';
  const minBand = options.minBand ?? DEFAULT_MIN_BAND;
  const maxBand = options.maxBand ?? DEFAULT_MAX_BAND;
  const persona = options.persona;
  const suppressed = options.suppressedRuleIds;

  const byWeight = (a: GuidanceItem, b: GuidanceItem) => b.weight - a.weight;

  const fired = GUIDANCE_RULES.filter(
    (rule) =>
      rule.target === target &&
      (rule.dataPrecondition === undefined || rule.dataPrecondition(signals)) &&
      rule.trigger(signals) &&
      // Cadence (before band fill/slice so a withheld item frees its slot): drop
      // a suppressed BAND rule unless it is urgent. The suppression set only ever
      // names band rules (impressions are recorded for band items only); the
      // layer guard makes that explicit so primers/inline are never withheld.
      !(
        suppressed !== undefined &&
        rule.layer === 'band' &&
        suppressed.has(rule.id) &&
        !ruleIsUrgent(rule, signals)
      ),
  ).map<GuidanceItem & { fallback: boolean }>((rule) => {
    const rendered = rule.render(signals);
    const personaMult =
      persona !== undefined
        ? clamp(rule.personaWeight?.[persona] ?? 1, PERSONA_MULT_MIN, PERSONA_MULT_MAX)
        : 1;
    return {
      id: rule.id,
      layer: rule.layer,
      target: rule.target,
      weight: rule.weight * personaMult,
      urgent: ruleIsUrgent(rule, signals),
      fallback: rule.fallback === true,
      ...rendered,
    };
  });

  // Band: real-signal rules first; fill from fallbacks only up to the minimum.
  const bandReal = fired.filter((i) => i.layer === 'band' && !i.fallback).sort(byWeight);
  const bandFallback = fired.filter((i) => i.layer === 'band' && i.fallback).sort(byWeight);
  const needed = Math.max(0, minBand - bandReal.length);
  const band = [...bandReal, ...bandFallback.slice(0, needed)]
    .slice(0, maxBand)
    .map(stripInternal);

  const inline = fired
    .filter((i) => i.layer === 'inline')
    .sort(byWeight)
    .map(stripInternal);

  const primers = fired
    .filter((i) => i.layer === 'primer')
    .sort(byWeight)
    .map(stripInternal);

  return { band, inline, primers };
}

// Resolves a rule's urgency for these signals (boolean or predicate). Urgent
// items are exempt from cadence suppression and carry urgent: true to the surface.
function ruleIsUrgent(rule: GuidanceRule, signals: GuidanceSignals): boolean {
  if (typeof rule.urgent === 'function') return rule.urgent(signals);
  return rule.urgent === true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stripInternal(item: GuidanceItem & { fallback?: boolean }): GuidanceItem {
  const { fallback: _fallback, ...rest } = item;
  return rest;
}
