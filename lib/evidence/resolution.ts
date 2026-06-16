/**
 * Evidence resolution layer (Stage 1E) — PURE, DB/SDK-free.
 *
 * Turns the packet's readiness gaps into a decision-first "what do I do next"
 * plan for the guided Resolve card, and maps the readiness percent to an honest
 * strength label.
 *
 * Honesty locks this must honor:
 *  - The strength label is evidence COMPLETENESS, never a win prediction
 *    (S41 wording lock: no guarantees, no win-rate claims).
 *  - Manual-first intake only: routes are upload / paste / profile / narrative /
 *    Slack selected-message import / "mark unavailable, with a reason". Slack
 *    import is merchant SELECTION of specific messages, never auto-pull; Gmail
 *    auto-pull stays out (Gmail-manual-first lock), and there is NO one-click
 *    customer sign-off link (no inbound infra yet).
 *  - Nothing is fabricated. "Mark unavailable" records a gap; it never invents
 *    proof or inflates readiness.
 */

import { getReasonProfile } from '@/lib/audit/reason-codes';
import type { ReasonCode } from '@/lib/audit/types';
import type { ReadinessKey } from './packet';

// ─── Strength (evidence completeness, not a win prediction) ──────────────────

export type StrengthTone = 'trust' | 'warning' | 'neutral';

export interface EvidenceStrength {
  label: 'Strong' | 'Moderate' | 'Building' | 'Early';
  tone: StrengthTone;
}

export function strengthFromPercent(percent: number): EvidenceStrength {
  if (percent >= 85) return { label: 'Strong', tone: 'trust' };
  if (percent >= 60) return { label: 'Moderate', tone: 'warning' };
  if (percent >= 35) return { label: 'Building', tone: 'warning' };
  return { label: 'Early', tone: 'neutral' };
}

// ─── Resolution plan ─────────────────────────────────────────────────────────

export type ResolveRouteKind = 'upload' | 'paste' | 'profile' | 'narrative' | 'connect';

export interface ResolveRoute {
  kind: ResolveRouteKind;
  label: string;
  detail: string;
  // Anchor (#add-evidence / #your-account) or route (/settings). All client-safe.
  href: string;
  badge?: string;
  primary?: boolean;
}

export interface ResolutionPlan {
  // The single readiness gap this card is currently guiding the merchant to fix.
  key: ResolvableKey;
  // How many actionable gaps remain (drives the bottom-bar "Resolve N" CTA).
  actionableCount: number;
  eyebrow: string;
  title: string;
  why: string;
  routes: ResolveRoute[];
  // Only the delivery/acceptance gap can be honestly "marked unavailable" (some
  // merchants genuinely have no formal sign-off). Other gaps are self-fixable.
  allowUnavailable: boolean;
}

// Keys the Resolve card can actively guide. `charge_attached` is a data anomaly
// (not merchant-fixable here) and `qa_clear` lives in the QA panel — both are
// excluded so the card stays focused on closeable evidence gaps.
export type ResolvableKey = 'delivery_proof' | 'policy' | 'product_description' | 'narrative';

const RESOLVE_PRIORITY: ResolvableKey[] = [
  'delivery_proof',
  'policy',
  'product_description',
  'narrative',
];

const UPLOAD_ANCHOR = '#add-evidence';
const SLACK_ANCHOR = '#import-slack';
const NARRATIVE_ANCHOR = '#your-account';
const SETTINGS_HREF = '/settings';

export interface ResolutionInput {
  missingKeys: ReadinessKey[];
  reasonCode: ReasonCode;
  // The merchant has explicitly recorded that no formal delivery/acceptance proof
  // exists. When true, the delivery gap stops being an active blocker (the card
  // advances to the next real item) without inflating readiness.
  acceptanceNoted: boolean;
}

/**
 * Build the guided resolution plan for the FIRST actionable gap, or null when
 * there is nothing the card should actively push on.
 */
export function buildResolutionPlan(input: ResolutionInput): ResolutionPlan | null {
  const actionable = actionableKeys(input.missingKeys, input.acceptanceNoted);
  const target = RESOLVE_PRIORITY.find((k) => actionable.includes(k));
  if (!target) return null;

  const profile = getReasonProfile(input.reasonCode);
  const count = actionable.length;
  const eyebrow = `Resolve ${count} ${count === 1 ? 'item' : 'items'} to strengthen this record`;

  switch (target) {
    case 'delivery_proof': {
      const routes: ResolveRoute[] = [
        {
          kind: 'upload',
          primary: true,
          badge: 'Fastest',
          label: 'Upload a signed document',
          detail:
            'PDF or image of a signed acceptance, SOW completion, delivery confirmation, or milestone sign-off.',
          href: UPLOAD_ANCHOR,
        },
        {
          kind: 'paste',
          label: 'Paste a screenshot or message',
          detail:
            'Paste an email, chat, or screenshot that shows the work was delivered or accepted.',
          href: UPLOAD_ANCHOR,
        },
      ];
      // Slack selected-message import is an ADDITIONAL manual-first route for the
      // comms-wedge codes, where the agreement / acceptance / usage typically
      // lives in chat. Merchant selection of specific messages, never auto-pull;
      // it deep-links to the same #add-evidence picker.
      if (profile.isCommsWedge) {
        routes.push({
          kind: 'connect',
          label: 'Import from Slack',
          detail: 'Pick the exact messages where the customer agreed, accepted, or used the work.',
          href: SLACK_ANCHOR,
        });
      }
      return {
        key: target,
        actionableCount: count,
        eyebrow,
        title: 'Add the missing delivery or acceptance proof',
        why: profile.isCommsWedge
          ? `For ${profile.networkLabel} (${profile.shortReason}), issuers expect dated proof the service was delivered or accepted. A delivery confirmation or signed acceptance is the single strongest item for this code.`
          : `Issuers expect evidence the customer received what they paid for. A delivery confirmation or signed acceptance is the strongest item to add.`,
        routes,
        allowUnavailable: true,
      };
    }
    case 'policy':
      return {
        key: target,
        actionableCount: count,
        eyebrow,
        title: 'Add the policy the customer agreed to',
        why: `Showing the refund or cancellation terms the customer accepted is core support for a ${profile.shortReason} case.`,
        routes: [
          {
            kind: 'profile',
            primary: true,
            label: 'Add your policy in Settings',
            detail: 'Record the refund or cancellation terms the customer agreed to at purchase.',
            href: SETTINGS_HREF,
          },
          {
            kind: 'upload',
            label: 'Upload the policy document',
            detail: 'Attach a PDF or screenshot of the terms in effect at the time of purchase.',
            href: UPLOAD_ANCHOR,
          },
        ],
        allowUnavailable: false,
      };
    case 'product_description':
      return {
        key: target,
        actionableCount: count,
        eyebrow,
        title: 'Add a product description',
        why: 'A clear description of what was sold frames the whole record and anchors the rest of the evidence.',
        routes: [
          {
            kind: 'profile',
            primary: true,
            label: 'Add a product description in Settings',
            detail: 'Describe what was sold so the record frames the engagement clearly.',
            href: SETTINGS_HREF,
          },
        ],
        allowUnavailable: false,
      };
    case 'narrative':
      return {
        key: target,
        actionableCount: count,
        eyebrow,
        title: 'Write your account of what happened',
        why: 'Your first-person account is what Verdact restates in the language the bank reads. Without it, the packet leans only on raw documents.',
        routes: [
          {
            kind: 'narrative',
            primary: true,
            label: 'Write your account of what happened',
            detail: 'A short, plain account. Verdact restates it in bank language for the packet.',
            href: NARRATIVE_ANCHOR,
          },
        ],
        allowUnavailable: false,
      };
  }
}

// The actionable gaps, in no particular order, with charge/QA excluded and the
// delivery gap dropped once it has been consciously marked unavailable.
function actionableKeys(missingKeys: ReadinessKey[], acceptanceNoted: boolean): ResolvableKey[] {
  return RESOLVE_PRIORITY.filter((k) => {
    if (!missingKeys.includes(k)) return false;
    if (k === 'delivery_proof' && acceptanceNoted) return false;
    return true;
  });
}
