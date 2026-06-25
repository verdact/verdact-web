import 'server-only';

import { sendEmail, type EmailSendResult } from './client';
import {
  auditRecapEmail,
  waitlistConfirmationEmail,
  welcomeConnectedEmail,
  deletionAckEmail,
  type AuditRecapInput,
} from './templates';

/**
 * Typed, intent-named send functions. Each one builds the right template and
 * hands it to the no-op-safe sendEmail wrapper. None of these ever throw.
 *
 * Callers choose how to invoke:
 *  - waitlist / audit recap: fire-and-forget (must not block the request path).
 *  - deletion ack: awaited (we want the result reflected in the request, but a
 *    failure still does not block, because sendEmail never throws).
 */

// Resolve the public app URL for links in emails. Returns null when unset so
// templates degrade to link-free copy rather than emitting a broken href.
function appUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  // Validate the configured URL so a misconfigured/compromised env var cannot
  // turn an email link into an open redirect. Return the origin only (drops any
  // path/trailing slash) so template concatenation stays clean.
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function sendAuditRecapEmail(
  to: string,
  recap: Omit<AuditRecapInput, 'appUrl'>,
): Promise<EmailSendResult> {
  const body = auditRecapEmail({ ...recap, appUrl: appUrl() });
  return sendEmail({ to, subject: body.subject, text: body.text, html: body.html });
}

export function sendWaitlistConfirmationEmail(to: string): Promise<EmailSendResult> {
  const body = waitlistConfirmationEmail({ appUrl: appUrl() });
  return sendEmail({ to, subject: body.subject, text: body.text, html: body.html });
}

export function sendDeletionAckEmail(to: string): Promise<EmailSendResult> {
  const body = deletionAckEmail({ appUrl: appUrl() });
  return sendEmail({ to, subject: body.subject, text: body.text, html: body.html });
}

export function sendWelcomeConnectedEmail(
  to: string,
  opts?: { businessName?: string | null },
): Promise<EmailSendResult> {
  const body = welcomeConnectedEmail({ appUrl: appUrl(), businessName: opts?.businessName ?? null });
  return sendEmail({ to, subject: body.subject, text: body.text, html: body.html });
}
