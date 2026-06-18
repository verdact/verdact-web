/**
 * Shared schema + type for the public write-feedback boundary.
 *
 * "Send feedback from anywhere": anyone (signed-in merchant, signed-out, or a
 * marketing visitor) can write feedback. This schema is the single contract
 * validated at BOTH ends:
 *   - the client widget (app/_components/feedback/FeedbackWidget.tsx) validates
 *     before it POSTs, for fast inline errors, and
 *   - the public route (app/api/feedback/route.ts) re-validates server-side,
 *     because the body is never trusted.
 *
 * Server-controlled fields (created_at, user_agent, merchant_id, status) are NOT
 * part of this input. The server sets them from the request, never from the body
 * (see route.ts) so a caller cannot spoof another merchant, forge a user agent,
 * or pre-set a triage status.
 */

import { z } from 'zod';

// Enums kept in one place so the client radiogroup, the server validator, and
// the DB CHECK constraints can never drift apart.
export const FEEDBACK_CATEGORIES = [
  'idea',
  'problem',
  'confusing',
  'praise',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_SURFACES = ['app', 'auth', 'marketing', 'prompt'] as const;
export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number];

export const FEEDBACK_STATUSES = ['new', 'triaged', 'closed'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

// Length caps mirror the DB CHECK constraints in the feedback migration.
export const MESSAGE_MAX = 4000;
export const ACTIVITY_MAX = 160;
export const ROUTE_MAX = 512;
export const SCREEN_MAX = 120;
export const EMAIL_MAX = 254;

// Human-readable category labels (used by the widget and the admin inbox tag).
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  idea: 'Idea',
  problem: 'Something is broken',
  confusing: 'Confusing',
  praise: 'Praise',
  other: 'Other',
};

// Optional free-text fields collapse '' to undefined so an empty input is stored
// as NULL, not an empty string. Email stays anonymous when blank.
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const feedbackInputSchema = z.object({
  surface: z.enum(FEEDBACK_SURFACES),
  category: z.enum(FEEDBACK_CATEGORIES),
  // The only required free-text field. Trimmed, bounded, and non-empty.
  message: z.string().trim().min(1).max(MESSAGE_MAX),
  route: optionalTrimmed(ROUTE_MAX),
  screen: optionalTrimmed(SCREEN_MAX),
  activity: optionalTrimmed(ACTIVITY_MAX),
  // "Leave blank to stay anonymous." Validated only when present.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(EMAIL_MAX)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Manual-first: the user only NOTES a screenshot is available. We never
  // auto-capture the screen; the founder follows up by email to receive it.
  has_screenshot: z.boolean().optional().default(false),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
