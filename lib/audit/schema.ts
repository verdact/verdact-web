/**
 * Zod schemas for the public /audit API boundary.
 *
 * Everything crossing the no-auth endpoint is validated here before it touches
 * the scoring brain or the database. Manual-entry rows and the uploaded-CSV
 * payload share one envelope so the result page can carry either forward.
 */

import { z } from 'zod';

export const MAX_MANUAL_DISPUTES = 200;
export const MAX_SETTLED_COUNT = 50_000_000;

const reasonCodeSchema = z.enum([
  'fraudulent',
  'product_not_received',
  'product_unacceptable',
  'subscription_canceled',
  'credit_not_processed',
  'duplicate',
  'unrecognized',
  'general',
  'other',
]);

const outcomeSchema = z.enum(['won', 'lost', 'open', 'unknown']);

export const auditDisputeSchema = z.object({
  id: z.string().min(1).max(64),
  amount: z.number().nonnegative().max(10_000_000).nullable(),
  currency: z.string().max(8).nullable(),
  reasonCode: reasonCodeSchema,
  reasonRaw: z.string().max(200).nullable(),
  createdAt: z.string().max(40).nullable(),
  outcome: outcomeSchema,
  proof: z.object({
    delivery: z.boolean(),
    usage: z.boolean(),
    comms: z.boolean(),
  }),
  source: z.enum(['csv', 'manual']),
});

export const auditSubmissionSchema = z.object({
  email: z.string().email().max(254),
  settledTransactionCount: z.number().int().nonnegative().max(MAX_SETTLED_COUNT),
  windowDays: z.number().int().min(1).max(400),
  disputes: z.array(auditDisputeSchema).min(1).max(MAX_MANUAL_DISPUTES),
  // Optional context, never trusted for anything security-sensitive.
  businessName: z.string().max(120).optional(),
});

export type AuditSubmission = z.infer<typeof auditSubmissionSchema>;
