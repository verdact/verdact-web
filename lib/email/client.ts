import 'server-only';

import { Resend } from 'resend';

/**
 * Server-only Resend wrapper.
 *
 * Contract for every caller in this module:
 *  - If RESEND_API_KEY is unset, we log ONE warning and NO-OP. We never throw
 *    and never block the request path. Email is an additive nicety, not a
 *    correctness requirement, so a missing key must not fail a signup, an audit,
 *    or an account-deletion request.
 *  - A send failure (bad key, Resend outage, invalid address) is caught, logged,
 *    and swallowed. Callers decide whether to await (correctness-sensitive) or
 *    fire-and-forget (must-not-block), but either way the result is a typed
 *    EmailSendResult, never an exception.
 */

const DEFAULT_FROM = 'Verdact <hello@verdact.io>';

export type EmailSendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true } // no API key configured — intentional no-op
  | { ok: false; skipped: false; error: string };

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Optional override for the reply-to address; falls back to the from address.
  replyTo?: string;
}

// The from address comes from env so it can be moved per-environment without a
// code change. Falls back to the documented default sender.
export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/**
 * Cheap synchronous check: is transactional email configured at all?
 * Used to make UI copy honest (claim "we emailed a copy" only when true),
 * without coupling callers to whether a specific send actually succeeded.
 */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

// Memoize the client so we don't re-read env / re-instantiate on every send.
let cachedClient: Resend | null = null;
let warnedMissingKey = false;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (!warnedMissingKey) {
      // One warning per process, not per send — avoids log spam in dev.
      console.warn('[email] RESEND_API_KEY is not set. Transactional email is disabled (no-op).');
      warnedMissingKey = true;
    }
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

/**
 * Send one transactional email. Never throws. Returns a typed result so callers
 * can log/branch without a try/catch of their own.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const client = getClient();
  if (!client) {
    return { ok: false, skipped: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from: emailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      // Resend v3 uses snake_case reply_to on the wire.
      reply_to: message.replyTo,
    });

    if (error) {
      console.error('[email] send failed:', error.message);
      return { ok: false, skipped: false, error: error.message };
    }

    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown error';
    console.error('[email] send threw:', errorMessage);
    return { ok: false, skipped: false, error: errorMessage };
  }
}
