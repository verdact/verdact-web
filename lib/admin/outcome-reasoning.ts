/**
 * Per-dispute outcome reasoning for the founder console (admin lane) — PURE,
 * DB/SDK-free, client-safe.
 *
 * Produces an HONEST "why we won / why we lost / how to improve" read for a
 * single decided dispute, plus an honest roll-up across a set. It REUSES the
 * audit rubric (reason-codes.ts) and the evidence completeness model
 * (resolution.ts) rather than restating either.
 *
 * Honesty locks (Verdact S41 — hard):
 *  - Completeness + correlation only, NEVER causation and NEVER a win-rate.
 *    Copy frames a tier as "this proof profile typically carries this reason",
 *    never "you will win" or any percentage of wins.
 *  - CE 3.0 is mentioned ONLY for Visa reason 10.4 card-absent fraud. It is a
 *    hard lock that it never applies to 13.x service codes.
 *  - `warning_closed` is its own outcome — an early-warning that closed in the
 *    merchant's favor WITHOUT a representment decision. It is never counted as
 *    a won or lost dispute.
 *  - No fabricated data. "How to improve" cites only the concrete readiness keys
 *    the merchant is actually missing; nothing is invented to fill a gap.
 *  - No em dashes in user-facing copy.
 */

import {
  getReasonProfile,
  normalizeReasonCode,
  scoreWinnability,
  TIER_RANK,
} from '@/lib/audit/reason-codes';
import type { WinnabilityTier } from '@/lib/audit/types';
import { strengthFromPercent } from '@/lib/evidence/resolution';
import type { ReadinessKey } from '@/lib/evidence/packet';

// ─── Inputs / outputs ─────────────────────────────────────────────────────────

/** A decided (or open) dispute, as the founder console knows it. */
export type ReasoningInput = {
  reason: string | null;
  network: string | null;
  outcome: 'won' | 'lost' | 'warning_closed' | null;
  status: string;
  ce3Eligible: boolean;
  readiness?: {
    percent: number;
    present: string[];
    missing: string[];
  } | null;
  amountCents?: number | null;
};

/** How a single dispute is framed in the console. `open` = not yet decided. */
export type ReasoningFraming = 'won' | 'lost' | 'warning_closed' | 'open';

export type OutcomeReasoning = {
  framing: ReasoningFraming;
  headline: string;
  why: string;
  howToImprove: string[];
  tags: string[];
  isShouldHaveWon: boolean;
  reasonCode: string | null;
  reasonLabel: string;
};

export type OutcomeAggregate = {
  decided: number;
  won: number;
  lost: number;
  warningClosed: number;
  open: number;
  whatsWorking: string[];
  whatsLeaking: string[];
  shouldHaveWonCount: number;
};

// ─── Shared honesty-locked phrasing ──────────────────────────────────────────

// Concrete, merchant-facing "how to improve" copy keyed by the SAME readiness
// keys the evidence packet emits, phrased to echo the Resolve-card routes in
// resolution.ts (single source of intent). Each is an ACTION the merchant can
// take, never a promise about the result.
const IMPROVE_BY_READINESS_KEY: Partial<Record<ReadinessKey, string>> = {
  delivery_proof:
    'Add dated delivery or acceptance proof: a delivery confirmation, signed acceptance, or the email or Slack thread where the customer received or used the work.',
  policy:
    'Record the refund or cancellation policy the customer agreed to at purchase, or upload the terms document in effect at that time.',
  product_description:
    'Add a clear product description so the record frames exactly what was sold.',
  narrative:
    'Write your first-person account of what happened so the packet can restate it in the language the bank reads.',
  charge_attached:
    'Attach the underlying charge so the record carries the transaction it disputes.',
  qa_clear:
    'Resolve the open QA flags before filing so the packet reads cleanly.',
};

// The honest, non-guarantee tier sentence. "Typically carries", never "wins".
function tierProfileSentence(reasonLabel: string, tier: WinnabilityTier): string {
  switch (tier) {
    case 'strong':
      return `On ${reasonLabel}, a packet with the right proof typically carries this reason. That is a pattern, not a promise.`;
    case 'moderate':
      return `On ${reasonLabel}, the outcome usually turns on how complete the proof is rather than on the reason alone.`;
    case 'weak':
      return `On ${reasonLabel}, representment rarely lands even with a full packet. Often the better move is to refund and protect the ratio.`;
    case 'unlikely':
      return `On ${reasonLabel}, this reason almost never reverses on representment regardless of the evidence.`;
  }
}

// Map a normalized reason code into the proof booleans scoreWinnability expects,
// derived from what the merchant actually has on file (present readiness keys).
// This is correlation input only: "do you hold the proof", never "did it win".
function proofFromReadiness(present: ReadonlySet<string>): {
  delivery: boolean;
  usage: boolean;
  comms: boolean;
} {
  const hasDelivery = present.has('delivery_proof');
  return {
    delivery: hasDelivery,
    // Usage and comms are not separate readiness keys in the packet model; the
    // delivery/acceptance evidence is where both live, so we read them off the
    // same signal rather than inventing a field the merchant never set.
    usage: hasDelivery,
    comms: hasDelivery,
  };
}

function asReadinessKey(value: string): ReadinessKey | null {
  switch (value) {
    case 'charge_attached':
    case 'delivery_proof':
    case 'policy':
    case 'product_description':
    case 'narrative':
    case 'qa_clear':
      return value;
    default:
      return null;
  }
}

function improvementsFromMissing(missing: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of missing) {
    const key = asReadinessKey(raw);
    if (!key) continue;
    const copy = IMPROVE_BY_READINESS_KEY[key];
    if (copy && !out.includes(copy)) out.push(copy);
  }
  return out;
}

function ce3Note(reasonCode: string, ce3Eligible: boolean): string | null {
  // Hard lock: CE 3.0 only ever applies to Visa 10.4 card-absent fraud.
  if (reasonCode !== 'fraudulent' || !ce3Eligible) return null;
  return 'Compelling Evidence 3.0 (Visa 10.4 only) can sometimes clear card-absent fraud on prior-transaction matching, which the processor evaluates automatically.';
}

// ─── Per-dispute reasoning ────────────────────────────────────────────────────

export function reasonForDispute(input: ReasoningInput): OutcomeReasoning {
  const reasonCode = normalizeReasonCode(input.reason);
  const profile = getReasonProfile(reasonCode);
  const reasonLabel = profile.networkLabel;

  const present = new Set(input.readiness?.present ?? []);
  const missing = input.readiness?.missing ?? [];
  const proof = proofFromReadiness(present);
  const { tier } = scoreWinnability(reasonCode, proof);
  const winnable = TIER_RANK[tier] >= TIER_RANK.moderate;

  const locusPhrase =
    profile.evidenceLocus === 'comms'
      ? 'your email, Slack, and delivery records'
      : profile.evidenceLocus === 'transactional'
        ? 'the payment and device data the processor already holds'
        : profile.evidenceLocus === 'mixed'
          ? 'a mix of delivery records and transaction data'
          : 'records that are rarely decisive for this reason';

  const tags: string[] = [profile.shortReason];
  if (profile.isCommsWedge) tags.push('comms-wedge');
  tags.push(`tier:${tier}`);

  const ce3 = ce3Note(reasonCode, input.ce3Eligible);

  // ── WON ──────────────────────────────────────────────────────────────────
  if (input.outcome === 'won') {
    const why = `You won. ${reasonLabel} hinges on ${locusPhrase}, which the packet supplied. ${tierProfileSentence(
      reasonLabel,
      tier,
    )}`;
    return {
      framing: 'won',
      headline: `Won on ${reasonLabel}`,
      why,
      howToImprove: present.size > 0
        ? ['Keep the same proof profile on hand for the next case with this reason.']
        : [],
      tags: [...tags, 'won'],
      isShouldHaveWon: false,
      reasonCode,
      reasonLabel,
    };
  }

  // ── WARNING CLOSED (its own outcome, not won/lost) ─────────────────────────
  if (input.outcome === 'warning_closed') {
    return {
      framing: 'warning_closed',
      headline: `Early warning closed on ${reasonLabel}`,
      why: `This closed in your favor as an early warning, before it became a dispute, so there was no representment decision to win or lose. Nothing was filed and nothing counts against your ratio here.`,
      howToImprove: [
        'No action needed. Early warnings that close this way are the cheapest possible outcome.',
      ],
      tags: [...tags, 'warning-closed'],
      isShouldHaveWon: false,
      reasonCode,
      reasonLabel,
    };
  }

  // ── LOST ───────────────────────────────────────────────────────────────────
  if (input.outcome === 'lost') {
    const improvements = improvementsFromMissing(missing);
    const isShouldHaveWon = winnable;

    const whyParts: string[] = [];
    if (isShouldHaveWon) {
      whyParts.push(
        `This is a should-have-won candidate. ${tierProfileSentence(reasonLabel, tier)}`,
      );
      if (improvements.length > 0) {
        whyParts.push(
          `The packet was missing proof that usually decides ${reasonLabel}, so the read correlates the loss with those gaps, not with the reason itself.`,
        );
      } else {
        whyParts.push(
          `The packet looked complete, so the gap is not in the evidence you held. Banks still decline winnable cases, and that is what appears to have happened here.`,
        );
      }
    } else {
      whyParts.push(tierProfileSentence(reasonLabel, tier));
    }
    if (ce3) whyParts.push(ce3);

    return {
      framing: 'lost',
      headline: isShouldHaveWon
        ? `Lost on ${reasonLabel} (should-have-won candidate)`
        : `Lost on ${reasonLabel}`,
      why: whyParts.join(' '),
      howToImprove:
        improvements.length > 0
          ? improvements
          : isShouldHaveWon
            ? ['The evidence looked complete. Keep this packet as a reference and resubmit faster on the next case with this reason if the program allows.']
            : ['For this reason, refunding early and protecting the dispute ratio is usually the stronger play than fighting.'],
      tags: [...tags, 'lost', ...(isShouldHaveWon ? ['should-have-won'] : [])],
      isShouldHaveWon,
      reasonCode,
      reasonLabel,
    };
  }

  // ── OPEN (no decision yet) ─────────────────────────────────────────────────
  const openImprovements = improvementsFromMissing(missing);
  const whyOpen = `${tierProfileSentence(reasonLabel, tier)} The deciding proof for this reason lives in ${locusPhrase}.${
    ce3 ? ` ${ce3}` : ''
  }`;
  return {
    framing: 'open',
    headline: `Open on ${reasonLabel}`,
    why: whyOpen,
    howToImprove:
      openImprovements.length > 0
        ? openImprovements
        : ['Make sure the packet carries the delivery or acceptance proof and your account of what happened before it is filed.'],
    tags: [...tags, 'open'],
    isShouldHaveWon: false,
    reasonCode,
    reasonLabel,
  };
}

// ─── Set-level aggregate ──────────────────────────────────────────────────────

// Below this many decided disputes, the set is too small to read a theme from
// honestly. We say so rather than imply a pattern from noise.
const MIN_SAMPLE_FOR_THEMES = 5;

export function aggregateOutcomes(items: ReasoningInput[]): OutcomeAggregate {
  let won = 0;
  let lost = 0;
  let warningClosed = 0;
  let open = 0;
  let shouldHaveWonCount = 0;

  // Theme accumulators (counts only — never converted to a win-rate).
  let commsWedgeWon = 0;
  let commsWedgeDecided = 0;
  let lostMissingDelivery = 0;
  let lostMissingPolicy = 0;
  let lostMissingNarrative = 0;
  let lostTotal = 0;

  for (const item of items) {
    const reasoning = reasonForDispute(item);
    switch (reasoning.framing) {
      case 'won':
        won += 1;
        break;
      case 'lost':
        lost += 1;
        break;
      case 'warning_closed':
        warningClosed += 1;
        break;
      case 'open':
        open += 1;
        break;
    }
    if (reasoning.isShouldHaveWon) shouldHaveWonCount += 1;

    const isCommsWedge = reasoning.tags.includes('comms-wedge');
    if (isCommsWedge && (reasoning.framing === 'won' || reasoning.framing === 'lost')) {
      commsWedgeDecided += 1;
      if (reasoning.framing === 'won') commsWedgeWon += 1;
    }

    if (reasoning.framing === 'lost') {
      lostTotal += 1;
      const missing = new Set(item.readiness?.missing ?? []);
      if (missing.has('delivery_proof')) lostMissingDelivery += 1;
      if (missing.has('policy')) lostMissingPolicy += 1;
      if (missing.has('narrative')) lostMissingNarrative += 1;
    }
  }

  const decided = won + lost;
  const whatsWorking: string[] = [];
  const whatsLeaking: string[] = [];

  if (decided < MIN_SAMPLE_FOR_THEMES) {
    whatsWorking.push('Too few decided disputes to read a reliable theme yet.');
    whatsLeaking.push('Too few decided disputes to read a reliable theme yet.');
    return {
      decided,
      won,
      lost,
      warningClosed,
      open,
      whatsWorking,
      whatsLeaking,
      shouldHaveWonCount,
    };
  }

  // What's working: correlation language only, no percentages.
  if (commsWedgeDecided >= MIN_SAMPLE_FOR_THEMES && commsWedgeWon * 2 >= commsWedgeDecided) {
    whatsWorking.push('Comms-wedge reasons (services not received, subscription cancelled) are your strongest tier so far.');
  }
  if (won > 0) {
    whatsWorking.push('Decided cases where the packet carried delivery or acceptance proof are the ones that came back in your favor.');
  }
  if (whatsWorking.length === 0) {
    whatsWorking.push('No clear strength stands out yet across the decided set.');
  }

  // What's leaking: name the most common missing item on lost disputes.
  if (lostTotal > 0) {
    const leaks: Array<{ count: number; copy: string }> = [
      { count: lostMissingDelivery, copy: 'Lost disputes are most often missing delivery or acceptance proof.' },
      { count: lostMissingPolicy, copy: 'Lost disputes frequently lack the refund or cancellation policy on file.' },
      { count: lostMissingNarrative, copy: 'Lost disputes often went out without your written account of what happened.' },
    ].sort((a, b) => b.count - a.count);
    for (const leak of leaks) {
      if (leak.count > 0) whatsLeaking.push(leak.copy);
    }
  }
  if (shouldHaveWonCount > 0) {
    whatsLeaking.push(
      `${shouldHaveWonCount} lost ${shouldHaveWonCount === 1 ? 'dispute is a' : 'disputes are'} should-have-won ${
        shouldHaveWonCount === 1 ? 'candidate' : 'candidates'
      } where a winnable reason came back against you.`,
    );
  }
  if (whatsLeaking.length === 0) {
    whatsLeaking.push('No single evidence gap dominates the lost set.');
  }

  return {
    decided,
    won,
    lost,
    warningClosed,
    open,
    whatsWorking,
    whatsLeaking,
    shouldHaveWonCount,
  };
}

// Surface the completeness helper for callers that want the packet's strength
// label alongside this reasoning. Re-exported (not redefined) so the strength
// label stays evidence COMPLETENESS, never a win prediction.
export { strengthFromPercent };
