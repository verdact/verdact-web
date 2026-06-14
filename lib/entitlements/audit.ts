import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Immutable pre-action audit writer for gated / money-adjacent actions.
 *
 * Entitlements decision #3, axis C1 (CRITICAL acceptance criteria): every
 * would-be submission writes an immutable audit row BEFORE the action, recording
 * who approved and when. The submission pathway fails closed: if this write does
 * not succeed, the action does NOT proceed (the caller treats a falsy return as
 * a hard stop).
 *
 * Rows are written with the service-role client into `public.audit_log`
 * (append-only by convention; no update/delete path is exposed). The table is
 * RLS-protected and only the service role writes here.
 */

export interface AuditEntry {
  merchantId: string | null;
  userId: string | null;
  action: string; // e.g. 'auto_submit.attempt', 'submit_to_stripe.attempt'
  resource?: string | null; // e.g. dispute id
  metadata?: Record<string, unknown> | null;
  requestIp?: string | null;
  requestUserAgent?: string | null;
}

/**
 * Write a pre-action audit row. Returns the inserted row id on success, or null
 * on any failure. Callers in a fail-closed path MUST treat null as "do not
 * proceed".
 */
export async function writePreActionAudit(entry: AuditEntry): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        merchant_id: entry.merchantId,
        user_id: entry.userId,
        action: entry.action,
        resource: entry.resource ?? null,
        metadata: entry.metadata ?? null,
        request_ip: entry.requestIp ?? null,
        request_user_agent: entry.requestUserAgent ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[entitlements/audit] pre-action write failed:', error?.message);
      return null;
    }
    return data.id as string;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[entitlements/audit] pre-action write threw:', message);
    return null;
  }
}
