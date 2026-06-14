/**
 * Evidence-analysis orchestrator. One call assembles every adopted Revano
 * evidence-quality feature for a dispute, for the Evidence Record / packet
 * builder to render. Pure, deterministic, DB-free.
 */

import type { ReasonCode } from '@/lib/audit/types';
import {
  buildActivityTimelineNarrative,
  buildGeoConsistencyNarrative,
  dailyActivityCounts,
} from './consistency';
import { buildPolicyBindingNarrative } from './policy-binding';
import { buildTranslationPairs } from './translation';
import { runPreSubmissionQa, qaSummary, hasBlockingFinding } from './qa-engine';
import type {
  EvidenceSignals,
  NarrativeBlock,
  QaFinding,
  TranslationPair,
} from './types';

export interface EvidenceAnalysis {
  narratives: NarrativeBlock[];
  timeline: { day: string; count: number }[];
  translation: TranslationPair[];
  qa: QaFinding[];
  qaSummary: { blocks: number; warns: number; oks: number };
  filingBlocked: boolean;
}

export interface AnalyzeInput {
  reasonCode: ReasonCode;
  signals: EvidenceSignals;
  hasChargeAttached: boolean;
  approved: boolean;
}

export function analyzeEvidence(input: AnalyzeInput): EvidenceAnalysis {
  const { reasonCode, signals, hasChargeAttached, approved } = input;

  const narratives: NarrativeBlock[] = [
    buildGeoConsistencyNarrative(signals),
    buildActivityTimelineNarrative(signals),
    buildPolicyBindingNarrative(signals),
  ];

  const qa = runPreSubmissionQa({
    reasonCode,
    signals,
    narratives,
    hasChargeAttached,
    approved,
  });

  return {
    narratives,
    timeline: dailyActivityCounts(signals.sessions),
    translation: buildTranslationPairs(reasonCode, signals),
    qa,
    qaSummary: qaSummary(qa),
    filingBlocked: hasBlockingFinding(qa),
  };
}
