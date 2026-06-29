import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI-assisted evidence narrative (Anthropic).
 *
 * Wires the already-provisioned @anthropic-ai/sdk + ANTHROPIC_API_KEY to draft
 * the merchant's plain-English "account of what happened" — the opener of the
 * Stripe `uncategorized_text` argument. It does NOT replace the deterministic
 * analysis blocks (lib/evidence/analyze.ts); those stay as-is. The AI output is
 * merchant-EDITABLE (it pre-fills the textarea; it never auto-submits and never
 * enters a packet without the merchant's own save).
 *
 * Safety posture (mirrors lib/evidence/submission-flag.ts):
 *  - Kill switch `VERDACT_AI_NARRATIVE_ENABLED` defaults OFF. When off, this
 *    returns a fallback WITHOUT calling the API — ships inert, like submission.
 *  - NEVER throws. Missing key, disabled flag, timeout, or any API error returns
 *    `{ ok: false }`; the caller falls back to manual drafting. The deterministic
 *    narrative path is completely unaffected either way.
 *  - server-only: the key + SDK never cross the client boundary.
 */

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_TOKENS = 700;

export function isAiNarrativeEnabled(): boolean {
  return process.env.VERDACT_AI_NARRATIVE_ENABLED === 'true';
}

export interface AiNarrativeInput {
  reasonLabel: string;
  reasonCode: string;
  amount: number | null; // minor units (cents)
  currency: string | null;
  customerName: string | null;
  productDescription: string | null;
  /** Which proof pillars are actually on file — keeps the draft honest. */
  proofSummary: {
    delivery: boolean;
    usage: boolean;
    comms: boolean;
    policyAttached: boolean;
  };
}

export type AiNarrativeResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

const SYSTEM_PROMPT = [
  'You are an evidence-drafting assistant for a merchant defending a card dispute (chargeback).',
  "You write the merchant's first-person account of what happened — the opening paragraph of their",
  'evidence submission. Rules you must follow exactly:',
  '- Plain, calm, factual language. First person ("We ...", "Our records show ...").',
  '- Use ONLY the facts provided. Never invent dates, amounts, names, delivery details, or logs.',
  '- If a proof pillar is NOT on file, do not claim it exists; you may note the merchant should attach it.',
  '- Network-neutral. Never name Visa/Mastercard rules, reason-code numbers, or "compelling evidence".',
  '- No promises, win-rate language, odds, percentages, or guarantees of any outcome.',
  '- No marketing tone. 120–220 words. Output the paragraph only — no preamble, headings, or sign-off.',
].join('\n');

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return 'an unspecified amount';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency ?? 'USD').toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${(currency ?? 'USD').toUpperCase()}`;
  }
}

function buildUserMessage(input: AiNarrativeInput): string {
  const proof = input.proofSummary;
  const present = [
    proof.delivery ? 'proof of delivery / fulfillment' : null,
    proof.usage ? 'records of the customer using the product/service' : null,
    proof.comms ? 'customer communications' : null,
    proof.policyAttached ? 'the refund / terms policy in force' : null,
  ].filter(Boolean);
  const missing = [
    !proof.delivery ? 'proof of delivery / fulfillment' : null,
    !proof.usage ? 'usage records' : null,
    !proof.comms ? 'customer communications' : null,
    !proof.policyAttached ? 'the refund / terms policy' : null,
  ].filter(Boolean);

  return [
    `Dispute reason (merchant-facing label): ${input.reasonLabel}`,
    `Disputed amount: ${formatAmount(input.amount, input.currency)}`,
    input.customerName ? `Customer: ${input.customerName}` : 'Customer name: not on file',
    input.productDescription
      ? `What the merchant sells / provided: ${input.productDescription}`
      : 'Product/service description: not on file',
    `Evidence currently ON FILE: ${present.length ? present.join('; ') : 'none yet'}`,
    `Evidence NOT yet on file: ${missing.length ? missing.join('; ') : 'none — all key pillars present'}`,
    '',
    'Draft the opening account-of-what-happened paragraph for this merchant, following all the rules.',
  ].join('\n');
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

/**
 * Generate an AI-drafted narrative. Always resolves (never throws). Returns a
 * fallback `{ ok: false }` when disabled, unconfigured, or on any API failure.
 */
export async function generateAiNarrative(
  input: AiNarrativeInput,
): Promise<AiNarrativeResult> {
  if (!isAiNarrativeEnabled()) {
    return { ok: false, error: 'AI drafting is not enabled.' };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ok: false, error: 'AI drafting is not configured.' };
  }

  const model = process.env.VERDACT_AI_NARRATIVE_MODEL || DEFAULT_MODEL;

  try {
    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const text = extractText(message);
    if (!text) {
      return { ok: false, error: 'AI returned an empty draft.' };
    }
    return { ok: true, text, model };
  } catch (error: unknown) {
    // Log the real error server-side; return a generic message so SDK detail
    // (account/quota/rate-limit/trace strings) never reaches the merchant UI.
    console.error('[ai-narrative] API error:', errorMessage(error));
    return { ok: false, error: 'AI drafting is temporarily unavailable.' };
  }
}
