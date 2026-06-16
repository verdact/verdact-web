// ─────────────────────────────────────────────────────────────────────────────
// Merchant categorization (founder console).
//
// Pure, deterministic, DB-free. Takes already-resolved signals about one
// merchant and returns a single best-guess category plus full provenance: the
// source that decided it, a 0–1 confidence, and a one-line rationale explaining
// WHY. No I/O, no fabrication — when nothing is known the result is honestly
// `uncategorized`, never a guess dressed up as fact.
//
// Strict priority cascade (first match wins):
//   1. admin_override     — a founder set the category by hand.
//   2. explicit_persona   — the merchant self-selected a persona (ask-only).
//   3. stripe_inferred    — derived from Stripe business signals (DORMANT: the
//                           signals are not captured yet, so this never fires in
//                           practice, but the tier is implemented for when they
//                           are).
//   4. heuristic          — combine customer type, delivery method, email-domain
//                           class, and dispute mix into a soft best guess.
//   5. uncategorized      — nothing usable; say so plainly.
//
// Persona → category map (persona ids are canonical in lib/guidance/persona.ts):
//   marcus → freelancer · priya → saas · david → agency · aisha → other.
// ─────────────────────────────────────────────────────────────────────────────

export type MerchantCategory = 'freelancer' | 'agency' | 'saas' | 'other' | 'uncategorized';

export type CategorySource =
  | 'admin_override'
  | 'explicit_persona'
  | 'stripe_inferred'
  | 'heuristic'
  | 'uncategorized';

export type CustomerType = 'b2b' | 'b2c' | 'both';
export type DeliveryMethod = 'app' | 'email' | 'download' | 'combination';

/** Aggregated dispute signal for the merchant (real, DB-derived). */
export type DisputeMix = {
  total: number;
  // Share (0–1) of disputes whose reason is "subscription canceled".
  subscriptionCanceledShare: number;
  // Average dispute amount in whole USD, or null when no disputes on record.
  avgAmountUsd: number | null;
};

/** Stripe business signals. Not captured yet — the stripe tier stays dormant. */
export type StripeSignals = {
  businessType?: string | null;
  mcc?: string | null;
  url?: string | null;
};

/**
 * Everything categorizeMerchant reads. Every field is optional/nullable: callers
 * pass whatever the merchant_profiles row and related tables actually hold.
 */
export type CategorySignals = {
  override?: MerchantCategory | null;
  persona?: string | null;
  stripe?: StripeSignals | null;
  customerType?: CustomerType | null;
  deliveryMethod?: DeliveryMethod | null;
  emailDomain?: string | null;
  disputeMix?: DisputeMix | null;
};

export type CategoryResult = {
  category: MerchantCategory;
  source: CategorySource;
  // 0–1. Higher = more direct evidence. Override/persona are highest; heuristic
  // sits in the soft middle; uncategorized is 0.
  confidence: number;
  // Human-readable one-liner for the founder console explaining the decision.
  rationale: string;
};

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  freelancer: 'Freelancer',
  agency: 'Agency',
  saas: 'SaaS / Subscription',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

export const CATEGORY_DESCRIPTIONS: Record<MerchantCategory, string> = {
  freelancer: 'Solo operator billing clients directly. Small, frequent invoices.',
  agency: 'Studio or team with a few larger, less frequent invoices.',
  saas: 'Recurring or subscription billing with steady volume.',
  other: 'Does not fit freelancer, agency, or SaaS — usually ops at a larger company.',
  uncategorized: 'Not enough signal to place this merchant yet.',
};

export const SOURCE_LABELS: Record<CategorySource, string> = {
  admin_override: 'Set by founder',
  explicit_persona: 'Merchant self-selected',
  stripe_inferred: 'Inferred from Stripe',
  heuristic: 'Estimated from activity',
  uncategorized: 'No signal',
};

/** Persona id → category. Persona ids are canonical in lib/guidance/persona.ts. */
const PERSONA_TO_CATEGORY: Readonly<Record<string, MerchantCategory>> = {
  marcus: 'freelancer',
  priya: 'saas',
  david: 'agency',
  aisha: 'other',
};

/**
 * Common free / consumer email providers. A merchant on one of these is more
 * likely a solo operator than an established agency or SaaS on a custom domain.
 */
const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'mail.com',
  'yandex.com',
]);

// Confidence bands. Direct statements of fact rank highest; soft inference low.
const CONFIDENCE_OVERRIDE = 1;
const CONFIDENCE_PERSONA = 0.9;
const CONFIDENCE_STRIPE = 0.7;
const CONFIDENCE_HEURISTIC_STRONG = 0.6;
const CONFIDENCE_HEURISTIC_WEAK = 0.4;
const CONFIDENCE_NONE = 0;

// Heuristic thresholds (named, not magic).
const SUBSCRIPTION_CANCEL_HEAVY_SHARE = 0.4; // ≥40% subscription-cancel → SaaS lean.
const AGENCY_AVG_AMOUNT_USD = 1000; // large invoices → agency lean.
const FREELANCER_AVG_AMOUNT_USD = 250; // small invoices → freelancer lean.
const FREQUENT_DISPUTE_COUNT = 5; // "frequent" floor for the freelancer read.

// MCC bands (dormant). Kept here so the stripe tier is fully implemented and
// ready the moment business signals start being captured.
const SAAS_MCC_CODES: ReadonlySet<string> = new Set([
  '5734', // Computer software stores
  '5817', // Digital goods — applications (excludes games)
  '5818', // Digital goods — large merchant
  '7372', // Computer programming / data processing
]);

const AGENCY_MCC_CODES: ReadonlySet<string> = new Set([
  '7311', // Advertising services
  '7333', // Commercial photography / art / graphics
  '7392', // Management / consulting / public relations
  '8999', // Professional services (not elsewhere classified)
]);

/**
 * True when `domain` is a common free / consumer email provider. Case- and
 * whitespace-insensitive. Null/undefined/empty → false (no domain to classify).
 */
export function isFreeEmailDomain(domain: string | null | undefined): boolean {
  if (domain == null) {
    return false;
  }
  const normalized = domain.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return FREE_EMAIL_DOMAINS.has(normalized);
}

/** Tier 3 — Stripe business signals (dormant until signals are captured). */
function fromStripe(stripe: StripeSignals | null | undefined): CategoryResult | null {
  if (stripe == null) {
    return null;
  }

  const businessType = stripe.businessType?.trim().toLowerCase() ?? null;
  const mcc = stripe.mcc?.trim() ?? null;
  const url = stripe.url?.trim() ?? null;

  if (mcc != null && SAAS_MCC_CODES.has(mcc)) {
    return {
      category: 'saas',
      source: 'stripe_inferred',
      confidence: CONFIDENCE_STRIPE,
      rationale: `Stripe MCC ${mcc} is a software/digital-goods code, which reads as SaaS.`,
    };
  }
  if (mcc != null && AGENCY_MCC_CODES.has(mcc)) {
    return {
      category: 'agency',
      source: 'stripe_inferred',
      confidence: CONFIDENCE_STRIPE,
      rationale: `Stripe MCC ${mcc} is an advertising/consulting code, which reads as an agency.`,
    };
  }
  if (businessType === 'individual' && url == null) {
    return {
      category: 'freelancer',
      source: 'stripe_inferred',
      confidence: CONFIDENCE_STRIPE,
      rationale: 'Stripe business type is individual with no business URL, which reads as a freelancer.',
    };
  }

  // Stripe present but no band matched — let lower tiers decide.
  return null;
}

/**
 * Tier 4 — heuristic blend. Combines customer type, delivery method, email-domain
 * class, and dispute mix into a soft best guess. Returns null when no signal is
 * strong enough to claim anything (caller falls through to uncategorized).
 */
function fromHeuristics(signals: CategorySignals): CategoryResult | null {
  const mix = signals.disputeMix ?? null;
  const onFreeEmail = isFreeEmailDomain(signals.emailDomain);

  // Subscription-cancel-heavy dispute mix is the strongest single tell → SaaS.
  if (mix != null && mix.total > 0 && mix.subscriptionCanceledShare >= SUBSCRIPTION_CANCEL_HEAVY_SHARE) {
    const pct = Math.round(mix.subscriptionCanceledShare * 100);
    return {
      category: 'saas',
      source: 'heuristic',
      confidence: CONFIDENCE_HEURISTIC_STRONG,
      rationale: `${pct}% of disputes are subscription-cancellation, which points to recurring SaaS billing.`,
    };
  }

  // Recurring / app-style delivery also points to SaaS.
  if (signals.deliveryMethod === 'app') {
    return {
      category: 'saas',
      source: 'heuristic',
      confidence: CONFIDENCE_HEURISTIC_WEAK,
      rationale: 'Delivery is in-app access, which is typical of a SaaS or subscription product.',
    };
  }

  // Large, infrequent invoices → agency. Needs a real average to claim it.
  if (mix != null && mix.avgAmountUsd != null && mix.avgAmountUsd >= AGENCY_AVG_AMOUNT_USD) {
    const business = signals.customerType === 'b2b' ? ' to business clients' : '';
    return {
      category: 'agency',
      source: 'heuristic',
      confidence: CONFIDENCE_HEURISTIC_STRONG,
      rationale: `Average dispute is $${mix.avgAmountUsd}${business}, which reads as larger agency-style invoices.`,
    };
  }

  // Small, frequent invoices from a solo operator on free email → freelancer.
  if (
    mix != null &&
    mix.avgAmountUsd != null &&
    mix.avgAmountUsd <= FREELANCER_AVG_AMOUNT_USD &&
    mix.total >= FREQUENT_DISPUTE_COUNT &&
    onFreeEmail
  ) {
    return {
      category: 'freelancer',
      source: 'heuristic',
      confidence: CONFIDENCE_HEURISTIC_STRONG,
      rationale: `Small ($${mix.avgAmountUsd}) frequent invoices on a free email domain read as a solo freelancer.`,
    };
  }

  // Weaker freelancer lean: free email plus direct (email) delivery, no other tells.
  if (onFreeEmail && signals.deliveryMethod === 'email') {
    return {
      category: 'freelancer',
      source: 'heuristic',
      confidence: CONFIDENCE_HEURISTIC_WEAK,
      rationale: 'Free email domain with direct email delivery reads as a solo operator billing clients directly.',
    };
  }

  return null;
}

/**
 * Categorize one merchant from its resolved signals.
 *
 * Strict priority cascade: admin_override > explicit_persona > stripe_inferred
 * (dormant) > heuristic > uncategorized. Always returns a source and a one-line
 * rationale explaining the decision. Pure and deterministic.
 */
export function categorizeMerchant(signals: CategorySignals): CategoryResult {
  // 1. Admin override — a founder's hand-set category beats every inference.
  if (signals.override != null && signals.override !== 'uncategorized') {
    return {
      category: signals.override,
      source: 'admin_override',
      confidence: CONFIDENCE_OVERRIDE,
      rationale: `A founder set this merchant to ${CATEGORY_LABELS[signals.override]} by hand.`,
    };
  }

  // 2. Explicit persona — the merchant self-selected (ask-only, never inferred).
  const personaId = signals.persona?.trim().toLowerCase() ?? null;
  if (personaId != null) {
    const mapped = PERSONA_TO_CATEGORY[personaId];
    if (mapped != null) {
      return {
        category: mapped,
        source: 'explicit_persona',
        confidence: CONFIDENCE_PERSONA,
        rationale: `Merchant self-selected the ${personaId} persona, which maps to ${CATEGORY_LABELS[mapped]}.`,
      };
    }
  }

  // 3. Stripe-inferred — dormant until Stripe business signals are captured.
  const stripeResult = fromStripe(signals.stripe);
  if (stripeResult != null) {
    return stripeResult;
  }

  // 4. Heuristic blend over the merchant's own activity.
  const heuristicResult = fromHeuristics(signals);
  if (heuristicResult != null) {
    return heuristicResult;
  }

  // 5. Nothing usable — say so honestly.
  return {
    category: 'uncategorized',
    source: 'uncategorized',
    confidence: CONFIDENCE_NONE,
    rationale: 'No override, persona, Stripe signal, or activity pattern strong enough to categorize yet.',
  };
}
