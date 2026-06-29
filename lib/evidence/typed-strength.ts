/**
 * Typed evidence-signal ladder — PURE, DB/SDK-free.
 *
 * Builds a per-signal "present vs missing" breakdown from signals ALREADY
 * loaded by the workbench server component. No new queries, no extra deps.
 *
 * Honesty lock: never presented as a win-probability or score. The label is
 * "which evidence categories you have and why they matter", not "odds you will
 * win". Reason: per-signal weights are non-empirical (honesty lock, resolution.ts).
 *
 * Signal order: strongest cardholder-identity signal → policy/ToS →
 * delivery → communications → usage.
 */

import type { EvidenceSignals } from './types';

export type SignalPresence = 'present' | 'missing';

export interface TypedSignal {
  key: string;
  name: string;
  why: string;
  presence: SignalPresence;
  note?: string;
}

export type SignalLadder = TypedSignal[];

export function buildSignalLadder(signals: EvidenceSignals): SignalLadder {
  const ladder: TypedSignal[] = [];

  // 1. Geographic match — real cardholder-identity signal. A card issued in the
  //    same country as the billing address corroborates the cardholder matches the
  //    card. A mismatch is a reviewer-visible fraud flag the merchant must explain.
  //    Available without session history: from the Stripe charge object.
  const hasGeoData = Boolean(signals.issuingCountry) && Boolean(signals.billingCountry);
  const geoMatch =
    hasGeoData && signals.issuingCountry === signals.billingCountry;
  ladder.push({
    key: 'geo_match',
    name: 'Card issuer and billing country match',
    why: 'Matching issuing and billing countries corroborate the cardholder is who they claim to be.',
    presence: geoMatch ? 'present' : 'missing',
    // If we have both countries and they mismatch, surface the note; if we lack
    // both countries (no charge enrichment yet), just mark missing quietly.
    note:
      hasGeoData && !geoMatch
        ? 'Countries differ — include an explanation in your account of what happened.'
        : undefined,
  });

  // 2. Policy / ToS — what the customer agreed to at purchase.
  const hasPolicy = Boolean(signals.policy?.text || signals.policy?.url);
  const versionBound = Boolean(signals.policy?.effectiveAt);
  ladder.push({
    key: 'policy',
    name: 'Refund or cancellation policy',
    why: 'The terms the customer agreed to at purchase anchor the case.',
    presence: hasPolicy ? 'present' : 'missing',
    note: hasPolicy && versionBound ? 'Version-bound to purchase date.' : undefined,
  });

  // 3. Delivery or acceptance proof.
  ladder.push({
    key: 'delivery',
    name: 'Delivery or acceptance proof',
    why: 'Dated confirmation the customer received or accepted the work.',
    presence: signals.proof.delivery ? 'present' : 'missing',
  });

  // 4. Customer communication.
  ladder.push({
    key: 'comms',
    name: 'Customer communication record',
    why: 'Emails, chat, or Slack messages showing the customer engaged after purchase.',
    presence: signals.proof.comms ? 'present' : 'missing',
  });

  // 5. Usage / activity evidence. Four or more logged sessions is the threshold
  //    consistent with the audit brain's usage-pattern analyzer.
  const hasUsage = signals.proof.usage || signals.sessions.length >= 4;
  ladder.push({
    key: 'usage',
    name: 'Usage or activity log',
    why: 'Login history or feature engagement showing the customer used what they paid for.',
    presence: hasUsage ? 'present' : 'missing',
  });

  return ladder;
}
