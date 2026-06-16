import type { WaitlistSignupRow, AuditLeadRow, MerchantRow } from './queries';

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const VAMP_STRIPE_LINE_PCT = 0.75;

// Free email-domain classes lower propensity slightly versus a business domain.
const FREE_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'live.com',
  'msn.com',
  'me.com',
  'mail.com',
  'yandex.com',
  'zoho.com',
]);

// Standing bands that indicate acute, time-sensitive pain.
const ACUTE_STANDING_BANDS = new Set<string>(['atRisk', 'at_risk', 'close']);

// ── Exported types ───────────────────────────────────────────────────────────

export type ConvertKind = 'waitlist' | 'audit_lead' | 'unactivated';

export type Draft = {
  subject: string;
  body: string;
};

export type ConvertItem = {
  id: string;
  kind: ConvertKind;
  label: string;
  score: number;
  whyNow: string;
  recommendedAction: string;
  signals: string[];
  draft: Draft;
};

// ── Internal helpers (pure) ──────────────────────────────────────────────────

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function daysBetween(fromIso: string, now: number): number {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return 0;
  const elapsed = now - t;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / DAY_MS);
}

function toFiniteNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '';
  return email.slice(at + 1).toLowerCase().trim();
}

function isFreeEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  if (domain.length === 0) return true; // unknown domain treated as free-tier class
  return FREE_EMAIL_DOMAINS.has(domain);
}

function displayName(businessName: string | null, fallback: string): string {
  const trimmed = businessName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function greetingName(businessName: string | null): string {
  const trimmed = businessName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'there';
}

function recencyScore(days: number): number {
  // Fresh leads score highest; decays toward zero over ~30 days.
  if (days <= 0) return 30;
  if (days >= 30) return 0;
  return Math.round(30 * (1 - days / 30));
}

// ── Scorers ──────────────────────────────────────────────────────────────────

export function scoreAuditLead(row: AuditLeadRow, now: number): ConvertItem {
  const days = daysBetween(row.created_at, now);
  const shouldHaveWon = Math.max(0, Math.round(toFiniteNumber(row.should_have_won_count)));
  const commsHinged = Math.max(0, Math.round(toFiniteNumber(row.comms_hinged_count)));
  const lost = Math.max(0, Math.round(toFiniteNumber(row.lost_disputes)));
  const total = Math.max(0, Math.round(toFiniteNumber(row.total_disputes)));
  const disputeRate = toFiniteNumber(row.estimated_dispute_rate);
  const band = row.standing_band?.trim() ?? '';
  const acuteBand = ACUTE_STANDING_BANDS.has(band);
  const alreadyConverted = row.converted_merchant_id != null;

  // Highest propensity = acute, recent, unresolved pain.
  let raw = 0;
  raw += Math.min(shouldHaveWon, 20) * 2.2; // strongest signal: winnable losses
  raw += Math.min(commsHinged, 20) * 1.6; // disputes that turned on communications
  raw += Math.min(lost, 30) * 0.8; // raw lost volume
  raw += acuteBand ? 14 : 0; // standing band atRisk / close
  raw += disputeRate >= 0.0075 ? 10 : disputeRate >= 0.005 ? 5 : 0;
  raw += recencyScore(days);
  if (alreadyConverted) raw -= 60; // already a merchant, deprioritize outreach

  const score = clampScore(raw);

  const signals: string[] = [];
  if (shouldHaveWon > 0) {
    signals.push(`${shouldHaveWon} likely-winnable ${pluralize(shouldHaveWon, 'dispute', 'disputes')} flagged`);
  }
  if (commsHinged > 0) {
    signals.push(`${commsHinged} ${pluralize(commsHinged, 'dispute', 'disputes')} hinged on communications`);
  }
  if (lost > 0) {
    signals.push(`${lost} lost of ${total} total`);
  }
  if (acuteBand) {
    signals.push(`standing band: ${band}`);
  }
  if (disputeRate > 0) {
    signals.push(`estimated dispute rate ${(disputeRate * 100).toFixed(2)}%`);
  }
  signals.push(`audit run ${days} ${pluralize(days, 'day', 'days')} ago`);
  if (alreadyConverted) {
    signals.push('already converted to merchant');
  }

  const whyNow = buildAuditWhyNow(shouldHaveWon, commsHinged, lost, acuteBand, band, days);

  const recommendedAction = alreadyConverted
    ? 'Already a merchant. Skip outreach or send an activation check-in instead.'
    : shouldHaveWon > 0
      ? 'Reach out referencing their own flagged audit numbers. Offer to walk one record together.'
      : 'Reach out with a calm, honest recap of their audit result.';

  const draft = buildAuditDraft(row, shouldHaveWon, commsHinged, lost, total);

  return {
    id: row.id,
    kind: 'audit_lead',
    label: displayName(row.business_name, row.email),
    score,
    whyNow,
    recommendedAction,
    signals,
    draft,
  };
}

function buildAuditWhyNow(
  shouldHaveWon: number,
  commsHinged: number,
  lost: number,
  acuteBand: boolean,
  band: string,
  days: number,
): string {
  if (shouldHaveWon > 0) {
    return `Their audit flagged ${shouldHaveWon} ${pluralize(shouldHaveWon, 'dispute', 'disputes')} they likely should have won, run ${days} ${pluralize(days, 'day', 'days')} ago.`;
  }
  if (commsHinged > 0) {
    return `Their audit found ${commsHinged} ${pluralize(commsHinged, 'dispute', 'disputes')} that hinged on communications, run ${days} ${pluralize(days, 'day', 'days')} ago.`;
  }
  if (acuteBand) {
    return `Their standing band came back ${band}, run ${days} ${pluralize(days, 'day', 'days')} ago.`;
  }
  if (lost > 0) {
    return `Their audit recorded ${lost} lost ${pluralize(lost, 'dispute', 'disputes')}, run ${days} ${pluralize(days, 'day', 'days')} ago.`;
  }
  return `Ran the audit ${days} ${pluralize(days, 'day', 'days')} ago and has not connected yet.`;
}

function buildAuditDraft(
  row: AuditLeadRow,
  shouldHaveWon: number,
  commsHinged: number,
  lost: number,
  total: number,
): Draft {
  const name = greetingName(row.business_name);
  const business = displayName(row.business_name, 'your store');

  const lines: string[] = [`Hi ${name},`, ''];

  if (shouldHaveWon > 0) {
    lines.push(
      `When you ran the Verdact audit, it flagged ${shouldHaveWon} ${pluralize(shouldHaveWon, 'dispute', 'disputes')} for ${business} that looked winnable based on your own records.`,
    );
  } else if (commsHinged > 0) {
    lines.push(
      `When you ran the Verdact audit, it found ${commsHinged} ${pluralize(commsHinged, 'dispute', 'disputes')} where the outcome hinged on the communications around the order.`,
    );
  } else if (lost > 0 && total > 0) {
    lines.push(
      `When you ran the Verdact audit, it recorded ${lost} lost ${pluralize(lost, 'dispute', 'disputes')} out of ${total} for ${business}.`,
    );
  } else {
    lines.push(`Thanks for running the Verdact audit for ${business}.`);
  }

  lines.push('');
  lines.push(
    'I am the founder. I am reaching out because the next step is turning that read into submission-ready evidence, organized the way the networks expect to see it.',
  );
  lines.push('');
  lines.push(
    'If it is useful, connect Stripe when you are ready and we can put together a processor-ready, network-guided response on one of those records together. No pressure, and nothing automated on your inbox.',
  );
  lines.push('');
  lines.push('Happy to walk one through with you on a call.');
  lines.push('');
  lines.push('Best,');

  return {
    subject: `Your Verdact audit for ${business}`,
    body: lines.join('\n'),
  };
}

export function scoreWaitlistSignup(row: WaitlistSignupRow, now: number): ConvertItem {
  const days = daysBetween(row.created_at, now);
  const source = row.source?.trim() ?? '';
  const businessDomain = !isFreeEmailDomain(row.email);

  let raw = 0;
  raw += recencyScore(days); // up to 30
  raw += businessDomain ? 16 : 6; // business domain signals higher intent
  raw += source.length > 0 ? 8 : 0; // attributed source is a small positive
  raw += 20; // baseline waitlist warmth

  const score = clampScore(raw);

  const signals: string[] = [`on the waitlist ${days} ${pluralize(days, 'day', 'days')}`];
  signals.push(businessDomain ? 'business email domain' : 'free email domain');
  if (source.length > 0) {
    signals.push(`source: ${source}`);
  }

  const whyNow = `On the waitlist ${days} ${pluralize(days, 'day', 'days')}, launching soon.`;

  const recommendedAction =
    'Send a warm welcome note inviting them to connect Stripe when ready. Keep it founder-to-founder.';

  const draft = buildWaitlistDraft(row);

  return {
    id: row.id,
    kind: 'waitlist',
    label: row.email,
    score,
    whyNow,
    recommendedAction,
    signals,
    draft,
  };
}

function buildWaitlistDraft(row: WaitlistSignupRow): Draft {
  const lines: string[] = [
    'Hi there,',
    '',
    'You are in. Thanks for joining the Verdact waitlist.',
    '',
    'I am the founder. We are getting close to opening up, and I wanted to reach out personally rather than send a form blast.',
    '',
    'When you are ready, you can connect Stripe and we will help you turn your dispute history into submission-ready, network-guided evidence. There is no automation on your inbox and nothing happens until you choose to start.',
    '',
    'If now is a good time to take a look, just reply and I will get you set up.',
    '',
    'Best,',
  ];

  return {
    subject: 'You are in - welcome to Verdact',
    body: lines.join('\n'),
  };
}

export function scoreUnactivatedMerchant(
  args: { merchant: MerchantRow; daysSinceSignup: number; profileComplete: boolean },
  now: number,
): ConvertItem {
  const { merchant, profileComplete } = args;
  // Prefer the caller-provided figure; fall back to created_at when not finite.
  const days = Number.isFinite(args.daysSinceSignup) && args.daysSinceSignup >= 0
    ? Math.floor(args.daysSinceSignup)
    : daysBetween(merchant.created_at, now);

  let raw = 0;
  raw += recencyScore(days); // recent signups are the warmest activation targets
  raw += profileComplete ? 18 : 8; // a completed profile shows real intent
  raw += 14; // baseline: they created an account but stalled at Stripe

  const score = clampScore(raw);

  const signals: string[] = [
    `created ${days} ${pluralize(days, 'day', 'days')} ago`,
    'no Stripe connection',
    profileComplete ? 'profile complete' : 'profile incomplete',
  ];

  const whyNow = `Created ${days} ${pluralize(days, 'day', 'days')} ago, has not connected Stripe.`;

  const recommendedAction =
    'Send a gentle activation nudge. Offer to help with the Stripe connection step if anything is unclear.';

  const draft = buildUnactivatedDraft(merchant);

  return {
    id: merchant.id,
    kind: 'unactivated',
    label: displayName(merchant.business_name, 'Unnamed workspace'),
    score,
    whyNow,
    recommendedAction,
    signals,
    draft,
  };
}

function buildUnactivatedDraft(merchant: MerchantRow): Draft {
  const business = displayName(merchant.business_name, 'your store');

  const lines: string[] = [
    'Hi there,',
    '',
    `Thanks for setting up ${business} on Verdact.`,
    '',
    'I noticed the Stripe connection is not in place yet. That is the one step that lets us pull your dispute history and start preparing submission-ready, network-guided evidence.',
    '',
    'It takes a minute and you stay in control of what we see. If anything in the connection step is unclear, reply here and I will walk you through it.',
    '',
    'No rush, and nothing runs on your inbox.',
    '',
    'Best,',
  ];

  return {
    subject: `One step left to get ${business} going`,
    body: lines.join('\n'),
  };
}

// ── VAMP alert draft (non-sent) ──────────────────────────────────────────────

export function draftVampAlert(args: { businessName: string | null; ratioPct: number }): Draft {
  const business = displayName(args.businessName, 'your store');
  const ratio = Number.isFinite(args.ratioPct) ? args.ratioPct : 0;
  const ratioText = ratio.toFixed(2);

  const lines: string[] = [
    'Hi there,',
    '',
    `A quick heads-up on ${business}. Your estimated dispute ratio is currently ${ratioText}%, which is above the Stripe ${VAMP_STRIPE_LINE_PCT}% line.`,
    '',
    'This is something worth getting ahead of rather than waiting on. A few things tend to help: responding to open disputes with submission-ready, network-guided evidence, tightening order communications, and clearing any backlog of winnable cases.',
    '',
    'If you connect Stripe, we can show you exactly which disputes are driving the ratio and help you work through them in order of impact.',
    '',
    'Reply here and I will help you map out the next steps.',
    '',
    'Best,',
  ];

  return {
    subject: `Heads-up: ${business} is above the Stripe dispute line`,
    body: lines.join('\n'),
  };
}

// ── Ranking ──────────────────────────────────────────────────────────────────

export function rankConvertItems(items: ConvertItem[]): ConvertItem[] {
  return [...items].sort((a, b) => b.score - a.score);
}
