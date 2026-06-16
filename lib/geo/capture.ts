import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { readEdgeGeo, geoColumns } from './edge';

type ServiceClient = ReturnType<typeof createServiceClient>;

// ─────────────────────────────────────────────────────────────────────────────
// Best-effort, env-gated geo capture for public lead inserts.
//
// SAFETY CONTRACT: this NEVER blocks or fails the host request (waitlist / audit
// signup). It is a SEPARATE write that runs only when ADMIN_GEO_CAPTURE === 'on'
// (set by the founder AFTER migration 20260616060000 is applied, which adds the
// geo columns). It updates the just-inserted row by a stable match column. Any
// error — including "column does not exist" before the migration — is logged and
// swallowed. Default OFF means the geo columns are never touched, so live
// signups are completely unaffected until the founder opts in.
// ─────────────────────────────────────────────────────────────────────────────

export async function captureGeoBestEffort(
  service: ServiceClient,
  table: 'waitlist_signups' | 'audit_leads',
  matchColumn: 'email' | 'id',
  matchValue: string,
  headers: Headers,
): Promise<void> {
  if (process.env.ADMIN_GEO_CAPTURE !== 'on') return;
  const geo = geoColumns(readEdgeGeo(headers));
  if (Object.keys(geo).length === 0) return;
  try {
    const { error } = await service.from(table).update(geo).eq(matchColumn, matchValue);
    if (error) {
      console.error('[geo] best-effort capture failed:', error.message);
    }
  } catch (err) {
    console.error('[geo] best-effort capture threw:', err instanceof Error ? err.message : err);
  }
}
