/**
 * Secure parsing for the evidence_draft JSONB column.
 *
 * Implements a strict "key-allowlist on read" as mandated by the R2-S1 security
 * review. Discards any unrecognized keys that may have been injected, preventing
 * garbage data from persisting or leaking into the UI.
 */

export interface EvidenceDraft {
  narrative: string;
  narrativeSavedAt?: string;
  acceptanceUnavailable?: {
    reason: string;
    notedAt?: string;
  };
}

export function parseEvidenceDraft(raw: unknown): EvidenceDraft {
  const result: EvidenceDraft = { narrative: '' };

  if (!raw) return result;

  // Legacy string migration
  if (typeof raw === 'string') {
    result.narrative = raw;
    return result;
  }

  if (typeof raw !== 'object') return result;

  const obj = raw as Record<string, unknown>;

  if (typeof obj.narrative === 'string') {
    result.narrative = obj.narrative;
  }

  if (typeof obj.narrativeSavedAt === 'string') {
    result.narrativeSavedAt = obj.narrativeSavedAt;
  }

  if (
    obj.acceptanceUnavailable &&
    typeof obj.acceptanceUnavailable === 'object'
  ) {
    const ua = obj.acceptanceUnavailable as Record<string, unknown>;
    if (typeof ua.reason === 'string' && ua.reason.trim().length > 0) {
      result.acceptanceUnavailable = {
        reason: ua.reason.trim(),
        notedAt: typeof ua.notedAt === 'string' ? ua.notedAt : undefined,
      };
    }
  }

  return result;
}
