import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import type { AuditScore } from './types';

/**
 * Audit-lead backfill consumer.
 *
 * A prospect can run the public /audit funnel (no login) and land at
 * /signup?from=audit&email=… . That funnel captures their last ~90 days of
 * disputes + Stripe volume into `audit_leads` (a pre-signup table, service-role
 * only). When they create an account, we want that data to become the new
 * merchant's HISTORICAL BACKFILL so account-health and the workbench start with
 * real context instead of an empty slate.
 *
 * Linkage strategy (idempotent, absence-safe):
 *   - Match unconverted `audit_leads` rows by lower(email) == lower(user email).
 *   - Stamp `converted_merchant_id` + `converted_at` so the rows are owned by
 *     the merchant and never re-consumed.
 *   - Account-health / workbench then read the merchant's audit history via
 *     `getAuditBackfillForMerchant()`.
 *
 * We deliberately do NOT synthesize `disputes` rows here: real disputes carry a
 * processor_dispute_id and arrive through the Stripe webhook. The audit data is
 * merchant-asserted history, so it lives in `audit_leads` (linked) and is read
 * as context, not minted as processor-backed disputes.
 *
 * Every failure is swallowed and logged: a backfill miss must never block a
 * signup or a dashboard render. The table may also be unmigrated in some
 * environments (the migration is applied separately), which is handled as a
 * no-op.
 */

export interface AuditBackfill {
  leadId: string;
  email: string;
  settledTransactionCount: number;
  windowDays: number;
  totalDisputes: number;
  lostDisputes: number;
  shouldHaveWonCount: number;
  commsHingedCount: number;
  estimatedDisputeRate: number | null; // FRACTION (e.g. 0.0042), not percent
  standingBand: string | null;
  score: AuditScore | null;
  capturedAt: string;
}

type AuditLeadRow = {
  id: string;
  email: string;
  settled_transaction_count: number | null;
  window_days: number | null;
  total_disputes: number | null;
  lost_disputes: number | null;
  should_have_won_count: number | null;
  comms_hinged_count: number | null;
  estimated_dispute_rate: number | null;
  standing_band: string | null;
  computed_score: AuditScore | null;
  created_at: string;
};

const SELECT_COLUMNS =
  'id, email, settled_transaction_count, window_days, total_disputes, lost_disputes, should_have_won_count, comms_hinged_count, estimated_dispute_rate, standing_band, computed_score, created_at';

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function toBackfill(row: AuditLeadRow): AuditBackfill {
  return {
    leadId: row.id,
    email: row.email,
    settledTransactionCount: row.settled_transaction_count ?? 0,
    windowDays: row.window_days ?? 90,
    totalDisputes: row.total_disputes ?? 0,
    lostDisputes: row.lost_disputes ?? 0,
    shouldHaveWonCount: row.should_have_won_count ?? 0,
    commsHingedCount: row.comms_hinged_count ?? 0,
    estimatedDisputeRate: row.estimated_dispute_rate,
    standingBand: row.standing_band,
    score: row.computed_score,
    capturedAt: row.created_at,
  };
}

/**
 * Link any unconverted audit leads for `email` to `merchantId` as historical
 * backfill. Idempotent: rows already converted (to this or any merchant) are
 * skipped. Returns the number of leads newly attached (0 when none / on error).
 */
export async function consumeAuditBackfill(
  merchantId: string,
  email: string | null | undefined,
): Promise<number> {
  const normalized = normalizeEmail(email);
  if (!merchantId || !normalized) {
    return 0;
  }

  try {
    const supabase = createServiceClient();

    // Only claim leads that are not yet converted. `ilike` on the exact string
    // gives a case-insensitive match without depending on a functional index.
    const { data, error } = await supabase
      .from('audit_leads')
      .update({
        converted_merchant_id: merchantId,
        converted_at: new Date().toISOString(),
      })
      .ilike('email', normalized)
      .is('converted_merchant_id', null)
      .select('id');

    if (error) {
      // Unmigrated table or transient failure: never block the caller.
      console.error('[audit/backfill] link failed:', error.message);
      return 0;
    }

    return data?.length ?? 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[audit/backfill] link threw:', message);
    return 0;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the email captured on a single audit lead, by its row id. Used ONLY to
 * prefill the signup email field when a prospect arrives via the /audit handoff
 * (/signup?from=audit&lead=<uuid>) — this keeps the email OUT of the URL/query
 * string (no PII in links, logs, or analytics) while preserving the prefill UX.
 *
 * Safe by construction: the lead id is an unguessable UUID handed only to the
 * person who ran that audit, and the sole effect is prefilling a form field they
 * are about to fill themselves. Validates the UUID shape before querying and
 * returns null on any miss/error so it can never block the signup render.
 */
export async function getAuditLeadEmailById(leadId: string | null | undefined): Promise<string | null> {
  if (!leadId || !UUID_RE.test(leadId)) return null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('audit_leads')
      .select('email')
      .eq('id', leadId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[audit/backfill] lead email read failed:', error.message);
      return null;
    }
    const email = (data as { email: string | null }).email;
    return email && email.trim().length > 0 ? email.trim() : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[audit/backfill] lead email read threw:', message);
    return null;
  }
}

/**
 * Read the audit backfill rows attached to a merchant, newest first. Used by
 * account-health and the workbench to seed real context for a just-signed-up
 * merchant. Returns [] when none exist or the table is unavailable.
 */
export async function getAuditBackfillForMerchant(
  merchantId: string,
): Promise<AuditBackfill[]> {
  if (!merchantId) {
    return [];
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('audit_leads')
      .select(SELECT_COLUMNS)
      .eq('converted_merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (error) console.error('[audit/backfill] read failed:', error.message);
      return [];
    }

    return (data as AuditLeadRow[]).map(toBackfill);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[audit/backfill] read threw:', message);
    return [];
  }
}

/**
 * Has this merchant already had an audit backfill attached? Cheap existence
 * check the dashboard uses to decide whether to attempt consumption. Returns
 * false on any error (so consumption is retried, which is safe — it's idempotent).
 */
export async function hasAuditBackfill(merchantId: string): Promise<boolean> {
  if (!merchantId) return false;
  try {
    const supabase = createServiceClient();
    const { count, error } = await supabase
      .from('audit_leads')
      .select('id', { count: 'exact', head: true })
      .eq('converted_merchant_id', merchantId);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
