/**
 * Chain of Intent timeline (C-E2). PURE, DB/SDK-free.
 *
 * Turns the assembled evidence into the chronological story a reviewer reads:
 * checkout authorization FIRST, then what the customer agreed to, then delivery
 * and usage, then client acceptance. The thesis (locked in CONCEPTS.md): banks
 * reward a timeline, not a pile. A single charge proves little; an ordered chain
 * from authorization through accepted delivery is hard to fake.
 *
 * HONESTY: a node is `present: true` only when the underlying signal genuinely
 * exists. Where an authorization or acceptance signal is absent, the node is a
 * `gap` (vermilion) the merchant can close, never an invented green.
 *
 * Built from data already computed upstream (packet readiness checks + evidence
 * signals), so it never re-derives or fabricates. Layout-only rendering in the
 * component; nothing here animates.
 */

import type { ReasonCode } from '@/lib/audit/types';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import type { EvidenceSignals } from './types';

export type ChainNodeState = 'present' | 'gap';

export interface ChainNode {
  id:
    | 'authorization'
    | 'agreement'
    | 'delivery'
    | 'usage'
    | 'acceptance';
  /** Bank-legible node title (R6 plain language, no raw ids). */
  title: string;
  detail: string;
  state: ChainNodeState;
  /** Optional plain-language timestamp label when a real date is known. */
  when?: string;
}

export interface ChainOfIntentInput {
  reasonCode: ReasonCode;
  signals: EvidenceSignals;
  hasChargeAttached: boolean;
  /** From packet.readiness: does a delivery/acceptance proof file exist. */
  hasDeliveryProof: boolean;
  /** From packet.readiness: is a policy on file. */
  hasPolicy: boolean;
  /** The merchant consciously recorded no formal acceptance exists. */
  acceptanceNoted: boolean;
  /** Purchase / authorization date, when enriched from the charge. */
  purchaseAt?: string | null;
}

function fmtDay(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Build the ordered Chain of Intent. Always returns nodes in chronological
 * reading order: authorization, agreement, delivery, usage, acceptance.
 */
export function buildChainOfIntent(input: ChainOfIntentInput): ChainNode[] {
  const profile = getReasonProfile(input.reasonCode);
  const billing = input.signals.billingCountry?.toUpperCase() ?? null;
  const issuing = input.signals.issuingCountry?.toUpperCase() ?? null;
  const geoCorroborated = Boolean(billing && issuing && billing === issuing);
  const hasUsage = input.signals.sessions.length >= 4;

  const nodes: ChainNode[] = [];

  // 1. Checkout authorization (first, always the spine's anchor).
  nodes.push({
    id: 'authorization',
    title: 'Checkout authorization',
    detail: input.hasChargeAttached
      ? geoCorroborated
        ? `The card was authorized at checkout, and the issuing country matched the billing country on file. This anchors the charge to a real cardholder.`
        : `The card was authorized at checkout. This anchors the charge, the amount, and the date for the reviewer.`
      : `No authorization context is attached yet. Attach the Stripe charge so the bank can see the payment, amount, and authorization at checkout.`,
    state: input.hasChargeAttached ? 'present' : 'gap',
    when: fmtDay(input.purchaseAt),
  });

  // 2. What the customer agreed to (policy / terms in force at purchase).
  nodes.push({
    id: 'agreement',
    title: 'What the customer agreed to',
    detail: input.hasPolicy
      ? `The refund or cancellation terms the customer accepted before the engagement are on file, in the version in force at purchase.`
      : `The terms the customer agreed to are not attached yet. Add the refund or cancellation policy the customer accepted at purchase.`,
    state: input.hasPolicy ? 'present' : 'gap',
  });

  // 3. Delivery of the work.
  nodes.push({
    id: 'delivery',
    title: 'Delivery of the work',
    detail: input.hasDeliveryProof
      ? `Dated proof the work was delivered is attached, the moment the customer received what they paid for.`
      : `No delivery proof is attached yet. Add the email, handoff, or confirmation that shows the work was delivered.`,
    state: input.hasDeliveryProof ? 'present' : 'gap',
  });

  // 4. Usage over time (supporting, only shown as present when a real pattern
  //    exists; absence here is neutral-supporting, so it is NOT a vermilion gap).
  if (hasUsage) {
    nodes.push({
      id: 'usage',
      title: 'Sustained usage',
      detail: `The account was active across several days, the spread of a real engaged user rather than a single session before a dispute.`,
      state: 'present',
    });
  }

  // 5. Client acceptance (weighted highest for comms-wedge codes; the deciding
  //    node). A consciously-noted absence stays a gap the merchant has already
  //    acknowledged, but never flips green.
  const acceptancePresent = input.hasDeliveryProof && !input.acceptanceNoted;
  nodes.push({
    id: 'acceptance',
    title: 'Client accepted or received it',
    detail: acceptancePresent
      ? `Proof the customer accepted or acknowledged the delivery is attached. For ${profile.networkLabel}, this is the item the reviewer weighs most.`
      : input.acceptanceNoted
        ? `You recorded that no formal sign-off exists. The packet files the rest and notes this gap honestly, it is never claimed as present.`
        : `Proof the customer accepted the delivery is not attached yet. Paste the exact message where the customer confirmed receipt, or request a sign-off. For ${profile.networkLabel}, this is the deciding item.`,
    state: acceptancePresent ? 'present' : 'gap',
  });

  return nodes;
}
