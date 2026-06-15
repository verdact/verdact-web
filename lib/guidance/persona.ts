/**
 * Persona helpers (Persona + Tip Cadence build §3, founder sign-off §0).
 *
 * Persona is ASK-ONLY: set from the skippable onboarding question and the
 * Settings → Business control. There is no inference and no default — unknown
 * stays unknown and the engine applies no multiplier. The id maps 1:1 onto
 * GuidancePersona (types.ts). Segment mapping is canonical in
 * 06_Build/Specs/Verdact_User_Journey_Maps_v1.md §2.1–2.4.
 */

import type { GuidancePersona } from './types';

export const PERSONA_IDS = ['marcus', 'priya', 'david', 'aisha'] as const;

export function isPersona(value: string | null | undefined): value is GuidancePersona {
  return value != null && (PERSONA_IDS as readonly string[]).includes(value);
}

/** Merchant-facing self-select options, in the order shown. */
export interface PersonaOption {
  id: GuidancePersona;
  label: string;
  hint: string;
}

export const PERSONA_OPTIONS: readonly PersonaOption[] = [
  {
    id: 'marcus',
    label: 'Freelancer or solo operator',
    hint: 'I bill clients directly',
  },
  {
    id: 'priya',
    label: 'SaaS or subscription business',
    hint: 'Recurring billing, steady volume',
  },
  {
    id: 'david',
    label: 'Agency or studio with a team',
    hint: 'Larger, less frequent invoices',
  },
  {
    id: 'aisha',
    label: 'Ops or RevOps at a larger company',
    hint: 'High volume, reporting and audit',
  },
];
