/**
 * Per-dispute evidence analysis layer (Revano-adopted features, 2026-06-13).
 *
 * Public surface — pure, DB-free analyzers the Evidence Record / packet builder
 * consumes:
 *   - analyzeEvidence(input) → EvidenceAnalysis  (one-call orchestrator)
 *   - individual analyzers (geo/network, activity timeline, policy binding,
 *     translation, pre-submission QA) for granular use.
 *
 * FEATURE → PLACEMENT MAP (where each Revano feature inserts):
 *   #1 geo/network consistency narrative → Evidence Record narrative block
 *   #2 temporal policy binding           → Evidence Record policy block
 *   #3 activity-pattern timeline         → Evidence Record timeline (+ bar data)
 *   #4 founder→bank translation          → packet-builder side-by-side review
 *   #5 pre-submission QA                 → QA panel (block/warn/ok findings)
 *   #6 plain-language action labels      → carried on SessionSignal.action
 *
 * Explicitly NOT built (out of scope per the teardown): the crypto/PDF proof
 * chain and API pre-instrumentation — Verdact files via Stripe-native fields.
 */

export { analyzeEvidence, type EvidenceAnalysis, type AnalyzeInput } from './analyze';
export {
  buildGeoConsistencyNarrative,
  buildActivityTimelineNarrative,
  dailyActivityCounts,
} from './consistency';
export { buildPolicyBindingNarrative } from './policy-binding';
export { buildTranslationPairs } from './translation';
export {
  runPreSubmissionQa,
  qaSummary,
  hasBlockingFinding,
  type QaInput,
} from './qa-engine';
export type {
  EvidenceSignals,
  SessionSignal,
  PolicySnapshot,
  NarrativeBlock,
  QaFinding,
  QaStatus,
  TranslationPair,
  Severity,
} from './types';
