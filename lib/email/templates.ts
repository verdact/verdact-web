import 'server-only';

/**
 * Plain, S41-compliant transactional email templates.
 *
 * Copy rules enforced here (locked):
 *  - No em dashes anywhere.
 *  - No pricing, no guarantees, no win-rate or exact-VAMP claims.
 *  - No "we read your inbox" framing.
 *  - Use "processor-ready" / "submission-ready" / "network-guided" language.
 *  - Audit recap is a read on the proof profile, never a promise of an outcome.
 *
 * Each builder returns both a text and an HTML body. Text is the source of
 * truth; HTML is a light, inline-styled wrapper of the same words so the email
 * renders cleanly without a design system.
 */

const BRAND = 'Verdact';

// Light, inline-styled shell. No external CSS, no images, no tracking pixels.
// Deliberately minimal so it renders the same everywhere and stays honest.
function layout(args: { heading: string; bodyHtml: string; appUrl: string | null }): string {
  const footer = args.appUrl
    ? `You are receiving this because you used ${BRAND} at ${escapeHtml(args.appUrl)}.`
    : `You are receiving this because you used ${BRAND}.`;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin:0;padding:0;background:#f5f6f4;">',
    '<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#1c2421;line-height:1.6;">',
    `<p style="font-size:15px;font-weight:600;letter-spacing:0.02em;color:#0f6b4f;margin:0 0 24px;">${BRAND}</p>`,
    `<h1 style="font-size:20px;font-weight:650;margin:0 0 16px;color:#1c2421;">${escapeHtml(args.heading)}</h1>`,
    args.bodyHtml,
    `<p style="font-size:12px;color:#7a857f;margin:32px 0 0;border-top:1px solid #e3e6e2;padding-top:16px;">${footer}</p>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

function paragraphHtml(text: string): string {
  return `<p style="font-size:15px;margin:0 0 16px;color:#1c2421;">${escapeHtml(text)}</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailBody {
  subject: string;
  text: string;
  html: string;
}

// ─── Audit result recap ──────────────────────────────────────────────────────

export interface AuditRecapInput {
  totalDisputes: number;
  shouldHaveWonCount: number;
  commsHingedCount: number;
  // Optional appUrl so the email can link back to the audit. No pricing page.
  appUrl: string | null;
}

export function auditRecapEmail(input: AuditRecapInput): EmailBody {
  const { totalDisputes, shouldHaveWonCount, commsHingedCount, appUrl } = input;

  const disputeWord = totalDisputes === 1 ? 'dispute' : 'disputes';
  const wonLine =
    shouldHaveWonCount > 0
      ? `${shouldHaveWonCount} of them had a proof profile that typically wins on representment.`
      : 'We did not flag a clear should-have-won case in this set, so the read points to where your leverage is instead.';
  const commsLine =
    commsHingedCount > 0
      ? `${commsHingedCount} hinged on email and Slack evidence that processor-native tools cannot reach.`
      : 'None of them hinged on comms evidence in this set.';

  const lines = [
    'Thanks for running the free dispute audit.',
    `We looked at ${totalDisputes} ${disputeWord} across your window. ${wonLine} ${commsLine}`,
    'This is a read on your proof profile, not a guarantee of any outcome.',
    appUrl
      ? `When you are ready, you can revisit your audit and join the waitlist here: ${appUrl}/audit`
      : 'When new workspaces open, you will be able to pre-load these disputes as your starting history.',
    'Nothing is ever filed without your sign-off.',
  ];

  const bodyHtml = [
    paragraphHtml(lines[0]),
    paragraphHtml(lines[1]),
    paragraphHtml(lines[2]),
    appUrl
      ? `<p style="font-size:15px;margin:0 0 16px;"><a href="${escapeHtml(appUrl)}/audit" style="color:#0f6b4f;font-weight:600;">Revisit your audit and join the waitlist</a></p>`
      : paragraphHtml(lines[3]),
    paragraphHtml(lines[4]),
  ].join('');

  return {
    subject: 'Your Verdact dispute audit',
    text: lines.join('\n\n'),
    html: layout({ heading: 'Your dispute audit', bodyHtml, appUrl }),
  };
}

// ─── Waitlist confirmation ───────────────────────────────────────────────────

export function waitlistConfirmationEmail(input: { appUrl: string | null }): EmailBody {
  const lines = [
    'You are on the list.',
    `${BRAND} is launching soon. New workspaces are not open to the public yet, and we will tell you the moment you can create yours.`,
    'There is nothing you need to do right now. We will be in touch.',
  ];

  const bodyHtml = lines.map(paragraphHtml).join('');

  return {
    subject: 'You are on the Verdact waitlist',
    text: lines.join('\n\n'),
    html: layout({ heading: 'You are on the list', bodyHtml, appUrl: input.appUrl }),
  };
}

// ─── Welcome on Stripe connect ───────────────────────────────────────────────

export function welcomeConnectedEmail(input: {
  appUrl: string | null;
  businessName?: string | null;
}): EmailBody {
  const name = input.businessName?.trim();
  const opener = name ? `Stripe is connected for ${name}.` : 'Your Stripe account is connected to Verdact.';

  const lines = [
    opener,
    'We are pulling your recent disputes now so you can build and view a structured evidence packet for each one. Building and viewing is free during the beta.',
    'Filing is off during the beta. Nothing is ever submitted to Stripe without your sign-off, and we will tell you the moment filing opens.',
    input.appUrl
      ? `You can pick up where the disputes land here: ${input.appUrl}/dashboard`
      : 'Open your dashboard to see your disputes as they land.',
  ];

  const bodyHtml = [
    paragraphHtml(lines[0]),
    paragraphHtml(lines[1]),
    paragraphHtml(lines[2]),
    input.appUrl
      ? `<p style="font-size:15px;margin:0 0 16px;"><a href="${escapeHtml(input.appUrl)}/dashboard" style="color:#0f6b4f;font-weight:600;">Open your dashboard</a></p>`
      : paragraphHtml(lines[3]),
  ].join('');

  return {
    subject: 'Stripe is connected to Verdact',
    text: lines.join('\n\n'),
    html: layout({ heading: 'Stripe is connected', bodyHtml, appUrl: input.appUrl }),
  };
}

// ─── Account-deletion acknowledgement ────────────────────────────────────────

export function deletionAckEmail(input: { appUrl: string | null }): EmailBody {
  const lines = [
    'We received your account deletion request.',
    'Our team will action it within 2 business days and email you again once it is done. Your data is not removed immediately.',
    'If you did not make this request, reply to this email and we will stop it.',
  ];

  const bodyHtml = lines.map(paragraphHtml).join('');

  return {
    subject: 'We received your Verdact deletion request',
    text: lines.join('\n\n'),
    html: layout({ heading: 'Deletion request received', bodyHtml, appUrl: input.appUrl }),
  };
}
