/**
 * Pre-submission "case strength" QA engine (Revano teardown #5).
 *
 * Turns Revano's three failure modes — MISSING data / WEAK data / MISMATCHED
 * data — into an automated pre-flight that warns the merchant BEFORE filing.
 * This operationalizes Verdact's existing "missing-proof pre-submission QA"
 * lock: catching a mismatch before submission protects the win profile AND the
 * VAMP ratio. A `block` finding means do-not-file-yet (the approval gate must
 * hold). Pure over (reasonCode, signals, narratives) → QaFinding[].
 */

import type { ReasonCode } from '@/lib/audit/types';
import { getReasonProfile } from '@/lib/audit/reason-codes';
import type { EvidenceSignals, NarrativeBlock, QaFinding } from './types';

export interface QaInput {
  reasonCode: ReasonCode;
  signals: EvidenceSignals;
  // The consistency/policy narrative blocks already computed (so QA can react to
  // any `mismatch` they surfaced without recomputing).
  narratives: NarrativeBlock[];
  hasChargeAttached: boolean;
  approved: boolean;
}

export function runPreSubmissionQa(input: QaInput): QaFinding[] {
  const { reasonCode, signals, narratives, hasChargeAttached, approved } = input;
  const profile = getReasonProfile(reasonCode);
  const findings: QaFinding[] = [];

  // ── MISMATCH findings (highest priority — these read as fraud) ──────────────
  for (const block of narratives) {
    if (block.severity === 'mismatch') {
      findings.push({
        id: `mismatch-${block.id}`,
        title: `${block.heading}: conflict to resolve`,
        detail: block.body,
        status: 'block',
        kind: 'mismatch',
      });
    }
  }

  // ── MISSING: the reason code's deciding proof is absent ─────────────────────
  if (profile.isCommsWedge) {
    const hasWedgeProof = signals.proof.comms || signals.proof.delivery;
    if (!hasWedgeProof) {
      findings.push({
        id: 'missing-comms-proof',
        title: 'Deciding proof not attached',
        detail:
          `${profile.networkLabel} is decided on delivery and communication evidence. None is attached yet, so the case is weak as it stands. Add the email, delivery, or acceptance proof before filing.`,
        status: 'block',
        kind: 'missing',
      });
    }
  }

  // ── MISSING: policy not attached for an agreement-based code ────────────────
  const policyMissing = !signals.policy || (!signals.policy.text && !signals.policy.url);
  if (policyMissing && (reasonCode === 'subscription_canceled' || reasonCode === 'credit_not_processed')) {
    findings.push({
      id: 'missing-policy',
      title: 'Policy not attached',
      detail:
        'This dispute turns on the terms the customer agreed to. Attach the refund or cancellation policy in force at purchase.',
      status: 'warn',
      kind: 'missing',
    });
  }

  // ── WEAK: charge context not attached ───────────────────────────────────────
  if (!hasChargeAttached) {
    findings.push({
      id: 'weak-no-charge',
      title: 'Stripe charge not attached',
      detail:
        'The charge gives the bank the payment, amount, and date context. Without it the response reads as incomplete.',
      status: 'warn',
      kind: 'weak',
    });
  }

  // ── WEAK: thin activity history ─────────────────────────────────────────────
  if (signals.sessions.length > 0 && signals.sessions.length < 4) {
    findings.push({
      id: 'weak-thin-activity',
      title: 'Activity history is thin',
      detail:
        'Only a few usage events are connected. A longer, steady history is much stronger proof of services rendered.',
      status: 'warn',
      kind: 'weak',
    });
  }

  // ── OK rows so the panel always shows the positives too ─────────────────────
  if (hasChargeAttached) {
    findings.push({
      id: 'ok-charge',
      title: 'Stripe charge attached',
      detail: 'Payment context is available for source traceability.',
      status: 'ok',
      kind: 'ok',
    });
  }
  const strongNarratives = narratives.filter((n) => n.include && n.severity === 'strong');
  for (const n of strongNarratives) {
    findings.push({
      id: `ok-${n.id}`,
      title: `${n.heading}: strong`,
      detail: n.body,
      status: 'ok',
      kind: 'ok',
    });
  }
  if (approved) {
    findings.push({
      id: 'ok-approved',
      title: 'Merchant approval recorded',
      detail: 'You have approved this record for the filing workflow.',
      status: 'ok',
      kind: 'ok',
    });
  }

  return findings;
}

/** Roll-up: does any finding block filing? */
export function hasBlockingFinding(findings: QaFinding[]): boolean {
  return findings.some((f) => f.status === 'block');
}

export function qaSummary(findings: QaFinding[]): { blocks: number; warns: number; oks: number } {
  return {
    blocks: findings.filter((f) => f.status === 'block').length,
    warns: findings.filter((f) => f.status === 'warn').length,
    oks: findings.filter((f) => f.status === 'ok').length,
  };
}
