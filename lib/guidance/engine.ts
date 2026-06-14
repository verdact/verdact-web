/**
 * Guidance engine (Standing Docket build plan §2).
 *
 * Runs the rule catalogue over a merchant's signals and splits the fired items
 * by delivery layer. Pure and deterministic.
 *
 *   - band    (Layer 1): ranked by weight, real-signal rules first; fallbacks
 *                        only top it up to `minBand`; capped at `maxBand`.
 *   - inline  (Layer 2): contextual tips at the object, ranked.
 *   - primers (Layer 4): pull-only educational, ranked.
 */

import { GUIDANCE_RULES } from './rules';
import type { GuidanceItem, GuidanceResult, GuidanceSignals, GuidanceTarget } from './types';

const DEFAULT_MIN_BAND = 2;
const DEFAULT_MAX_BAND = 4;

export interface EvaluateOptions {
  target?: GuidanceTarget;
  minBand?: number;
  maxBand?: number;
}

export function evaluateGuidance(
  signals: GuidanceSignals,
  options: EvaluateOptions = {},
): GuidanceResult {
  const target = options.target ?? 'dashboard';
  const minBand = options.minBand ?? DEFAULT_MIN_BAND;
  const maxBand = options.maxBand ?? DEFAULT_MAX_BAND;

  const byWeight = (a: GuidanceItem, b: GuidanceItem) => b.weight - a.weight;

  const fired = GUIDANCE_RULES.filter(
    (rule) =>
      rule.target === target &&
      (rule.dataPrecondition === undefined || rule.dataPrecondition(signals)) &&
      rule.trigger(signals),
  ).map<GuidanceItem & { fallback: boolean }>((rule) => {
    const rendered = rule.render(signals);
    return {
      id: rule.id,
      layer: rule.layer,
      target: rule.target,
      weight: rule.weight,
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

function stripInternal(item: GuidanceItem & { fallback?: boolean }): GuidanceItem {
  const { fallback: _fallback, ...rest } = item;
  return rest;
}
