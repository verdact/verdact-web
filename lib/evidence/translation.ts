/**
 * Founder-language → bank-language translation (Revano teardown #4 + #6).
 *
 * Vince's central thesis: merchants lose because they submit "founder language"
 * (screenshots, casual emails) instead of structured data mapped to reason
 * codes ("bank language"). This builds the side-by-side transform: the
 * merchant's raw evidence on the left, the bank-formatted, reason-code-mapped
 * version on the right. It doubles as the merchant-review surface — the merchant
 * sees both and approves (reinforces the approval lock).
 *
 * Pure over (reasonCode, signals) → TranslationPair[]. Bank-language strings are
 * network-neutral, honest, and contain no win-rate / guarantee language.
 */

import type { ReasonCode } from '@/lib/audit/types';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import type { EvidenceSignals, TranslationPair } from './types';

export function buildTranslationPairs(
  reasonCode: ReasonCode,
  signals: EvidenceSignals,
): TranslationPair[] {
  const profile = getReasonProfile(reasonCode);
  const pairs: TranslationPair[] = [];

  // Always lead with the reason-code framing itself (the #4 thesis in one row).
  pairs.push({
    founder: 'The customer says I never did the work / they forgot to cancel.',
    bank:
      `Dispute mapped to ${profile.networkLabel} (${profile.shortReason}). The response is structured to the proof a reviewer weighs for this code: ${describeLocus(profile.evidenceLocus)}.`,
  });

  if (signals.proof.delivery) {
    pairs.push({
      founder: 'I have proof I delivered it (files, emails, links I sent).',
      bank:
        'Delivery evidence: dated artifacts showing the deliverable was provided to the customer, establishing services rendered.',
    });
  }

  if (signals.proof.usage && signals.sessions.length > 0) {
    pairs.push({
      founder: 'They were logging in and using it the whole time.',
      bank:
        `Usage evidence: ${signals.sessions.length} recorded access events across the engagement, demonstrating sustained customer engagement with the delivered service.`,
    });
  }

  if (signals.proof.comms) {
    pairs.push({
      founder: 'We have the whole email / Slack thread where they were happy.',
      bank:
        'Communication evidence: contemporaneous correspondence in which the customer acknowledged receipt and acceptance of the work, contradicting the dispute claim.',
    });
  }

  if (signals.policy && (signals.policy.text || signals.policy.url)) {
    pairs.push({
      founder: 'They agreed to my refund / cancellation policy at checkout.',
      bank:
        'Policy evidence: the refund and cancellation terms the customer accepted at purchase, in force on the transaction date.',
    });
  }

  return pairs;
}

function describeLocus(locus: ReturnType<typeof getReasonProfile>['evidenceLocus']): string {
  switch (locus) {
    case 'comms':
      return 'delivery records, usage history, and the communications showing acceptance';
    case 'transactional':
      return 'payment, device, and address data matching prior undisputed activity';
    case 'mixed':
      return 'both the delivery/communication record and the transactional data';
    default:
      return 'the strongest records available for this case';
  }
}
