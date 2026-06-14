/**
 * Shared types for the per-dispute evidence analysis layer (lib/evidence).
 *
 * These power the Revano-adopted evidence-quality features (teardown doc
 * 2026-06-13, Part 2 #1–#6) inside the Evidence Record / packet-builder flow:
 *   #1 geographic & network consistency narrative
 *   #2 temporal policy binding (version-in-force-at-purchase)
 *   #3 activity-pattern timeline ("steady use, not one burst")
 *   #4 founder-language → bank-language translation surface
 *   #5 pre-submission case-strength QA (missing / weak / mismatched)
 *   #6 bank-facing plain-language action descriptions
 *
 * Everything here is PURE and DB/SDK-free so the analyzers stay testable. The
 * workbench server component fetches the signals and passes them in.
 *
 * Honesty locks honored: narratives are built only from signals actually
 * present; no fabricated consistency claims; network-neutral; no win-rate /
 * guarantee language. Submission via Stripe native fields (NOT a third-party
 * PDF) — these analyzers produce structured argument text, not a signed report.
 */

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface SessionSignal {
  // ISO timestamp of a login / usage / API event for the disputed account.
  at: string;
  ip?: string | null;
  country?: string | null; // ISO-3166 alpha-2 (e.g. "US")
  // Plain-language action label (Revano #6): "Logged in", "Exported a report".
  action?: string | null;
}

export interface PolicySnapshot {
  // Which policy this is.
  kind: 'refund' | 'cancellation' | 'terms';
  // The text/url of the version that was IN FORCE on the purchase date (Revano
  // #2 — temporal binding), NOT necessarily today's policy.
  text?: string | null;
  url?: string | null;
  // When this version took effect, if known.
  effectiveAt?: string | null;
  // The purchase / agreement date this snapshot is bound to.
  boundToPurchaseAt?: string | null;
}

export interface EvidenceSignals {
  purchaseAt?: string | null;
  disputeCreatedAt?: string | null;
  billingCountry?: string | null; // ISO-3166 alpha-2
  sessions: SessionSignal[];
  policy: PolicySnapshot | null;
  // Whether the merchant says they hold each proof kind (mirrors the audit
  // brain's ProofKind so the two layers agree).
  proof: { delivery: boolean; usage: boolean; comms: boolean };
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type Severity = 'strong' | 'present' | 'missing' | 'mismatch';

export interface NarrativeBlock {
  id: string;
  // Bank-facing heading, e.g. "Geographic consistency".
  heading: string;
  // The structured argument paragraph(s) — bank language, not founder language.
  body: string;
  severity: Severity;
  // Whether this block is safe to include (true only when truthfully supported).
  include: boolean;
}

export type QaStatus = 'ok' | 'warn' | 'block';

export interface QaFinding {
  id: string;
  title: string;
  detail: string;
  status: QaStatus;
  // The failure mode this maps to (Revano #5): missing / weak / mismatched.
  kind: 'missing' | 'weak' | 'mismatch' | 'ok';
}

export interface TranslationPair {
  // What the merchant has, in their words (Revano #4 left column).
  founder: string;
  // The same thing in bank language, mapped to the reason code (right column).
  bank: string;
}
