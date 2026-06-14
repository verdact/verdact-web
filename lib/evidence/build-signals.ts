/**
 * Build EvidenceSignals for a dispute from the data Verdact actually holds today.
 *
 * This is the bridge between the live DB rows (dispute, merchant_profile,
 * evidence files, and — when available — the audit backfill) and the pure
 * analyzers in lib/evidence. It degrades honestly: signals that are not yet
 * sourced (per-session usage/geo events need the DB-connect roadmap) are simply
 * absent, and the analyzers render their "not enough data" states rather than
 * inventing a pattern.
 */

import type { ReasonCode } from '@/lib/audit/types';
import { normalizeReasonCode } from '@/lib/audit/reason-codes';
import type { EvidenceSignals, PolicySnapshot, SessionSignal } from './types';

export interface DisputeForSignals {
  reason: string | null;
  processor_charge_id: string | null;
  created_at: string;
  // Stripe doesn't give a purchase date directly on the dispute; the charge date
  // is the closest proxy and is wired when charge enrichment lands.
  purchase_at?: string | null;
  billing_country?: string | null;
}

export interface ProfileForSignals {
  refund_policy_text: string | null;
  refund_policy_url: string | null;
  cancellation_policy_text: string | null;
  cancellation_policy_url: string | null;
  logs_user_activity: string | null;
}

export interface SignalsInput {
  dispute: DisputeForSignals;
  profile: ProfileForSignals | null;
  // Session/usage events for the disputed account. Empty until the usage-events
  // source is connected — the analyzers handle the empty case honestly.
  sessions?: SessionSignal[];
  // What the merchant has asserted they hold (e.g. from the audit backfill or
  // the workbench checkboxes). Defaults conservatively to all-false.
  proof?: { delivery: boolean; usage: boolean; comms: boolean };
}

export function buildEvidenceSignals(input: SignalsInput): {
  reasonCode: ReasonCode;
  signals: EvidenceSignals;
} {
  const { dispute, profile } = input;
  const reasonCode = normalizeReasonCode(dispute.reason);

  return {
    reasonCode,
    signals: {
      purchaseAt: dispute.purchase_at ?? null,
      disputeCreatedAt: dispute.created_at,
      billingCountry: dispute.billing_country ?? null,
      sessions: input.sessions ?? [],
      policy: derivePolicy(reasonCode, profile, dispute.purchase_at ?? null),
      proof: input.proof ?? { delivery: false, usage: false, comms: false },
    },
  };
}

function derivePolicy(
  reasonCode: ReasonCode,
  profile: ProfileForSignals | null,
  purchaseAt: string | null,
): PolicySnapshot | null {
  if (!profile) return null;

  // Pick the policy most relevant to the reason code.
  const preferCancellation = reasonCode === 'subscription_canceled';
  const text = preferCancellation
    ? profile.cancellation_policy_text || profile.refund_policy_text
    : profile.refund_policy_text || profile.cancellation_policy_text;
  const url = preferCancellation
    ? profile.cancellation_policy_url || profile.refund_policy_url
    : profile.refund_policy_url || profile.cancellation_policy_url;

  if (!text && !url) return null;

  return {
    kind: preferCancellation ? 'cancellation' : 'refund',
    text: text ?? null,
    url: url ?? null,
    // effectiveAt is not captured yet (temporal policy versioning is the roadmap
    // item); leaving it null means the analyzer honestly says "attached but not
    // bound to the as-of-purchase version".
    effectiveAt: null,
    boundToPurchaseAt: purchaseAt,
  };
}
