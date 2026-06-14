/**
 * Zod schema for the public /api/waitlist boundary.
 *
 * Public sign-up is gated behind a "launching soon" panel. The only thing that
 * crosses this no-auth endpoint is an email (plus an optional source tag), and
 * it is validated here before it touches the database. Never trust the body.
 */

import { z } from 'zod';

export const MAX_SOURCE_LENGTH = 64;

export const waitlistSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Optional provenance tag (e.g. 'launching_soon'). Never trusted for anything
  // security-sensitive; bounded so it cannot be used as a payload smuggler.
  source: z.string().max(MAX_SOURCE_LENGTH).optional(),
});

export type WaitlistSignup = z.infer<typeof waitlistSignupSchema>;
