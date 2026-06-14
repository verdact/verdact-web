/**
 * Temporal policy binding (Revano teardown #2).
 *
 * The argument: surface the EXACT policy text that was live on the purchase /
 * agreement date, not today's policy. Banks want the contract the customer
 * actually accepted. For Verdact's service ICP the equivalent is the
 * SOW / engagement terms / refund policy as it stood when the client signed —
 * which often lives in an email (the comms layer).
 *
 * Pure over PolicySnapshot → NarrativeBlock. Honesty: only argues "version in
 * force at purchase" when an effective date is actually bound to the purchase
 * date; otherwise it states plainly that the current policy is attached and
 * flags that the as-of-purchase version would be stronger.
 */

import type { EvidenceSignals, NarrativeBlock } from './types';

const POLICY_LABEL: Record<NonNullable<EvidenceSignals['policy']>['kind'], string> = {
  refund: 'Refund policy',
  cancellation: 'Cancellation policy',
  terms: 'Terms of service',
};

export function buildPolicyBindingNarrative(signals: EvidenceSignals): NarrativeBlock {
  const policy = signals.policy;

  if (!policy || (!policy.text && !policy.url)) {
    return {
      id: 'policy-binding',
      heading: 'Policy in force at purchase',
      body:
        'No policy version is attached for this engagement. Attach the refund or cancellation policy the customer agreed to so the bank can see the terms in force when they paid.',
      severity: 'missing',
      include: false,
    };
  }

  const label = POLICY_LABEL[policy.kind];
  const purchaseAt = policy.boundToPurchaseAt ?? signals.purchaseAt ?? null;
  const boundToVersion =
    Boolean(policy.effectiveAt) &&
    Boolean(purchaseAt) &&
    new Date(policy.effectiveAt as string).getTime() <= new Date(purchaseAt as string).getTime();

  if (boundToVersion) {
    return {
      id: 'policy-binding',
      heading: 'Policy in force at purchase',
      body:
        `The ${label.toLowerCase()} attached is the version that took effect on ${formatDay(policy.effectiveAt as string)} and was in force when the customer paid on ${formatDay(purchaseAt as string)}. ` +
        'This is the exact agreement the customer accepted, which is the contract a reviewer weighs, not a later revision.',
      severity: 'strong',
      include: true,
    };
  }

  // Policy present but not provably bound to the purchase-date version.
  return {
    id: 'policy-binding',
    heading: 'Policy in force at purchase',
    body:
      `A ${label.toLowerCase()} is attached, but it is not yet bound to the version in force on the purchase date. ` +
      'The strongest form of this evidence is the exact policy the customer accepted when they paid. If you have the as-of-purchase version, attach it.',
    severity: 'present',
    include: true,
  };
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}
