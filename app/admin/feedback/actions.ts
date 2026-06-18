'use server';

import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin, logPlatformAdminEvent } from '@/lib/admin/platform-admin';
import { createServiceClient } from '@/lib/supabase/server';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '@/lib/feedback/schema';

// ─────────────────────────────────────────────────────────────────────────────
// Feedback triage action (founder-only). Mirrors merchants/actions.ts: gate on
// requirePlatformAdmin, validate the input, mutate via the service client (this
// is the founder-authenticated UPDATE path — RLS forbids anon/auth writes), log
// a platform_admin_event, and revalidate. There is no delete action: feedback is
// structurally retained. Returns a plain result the client view can toast on.
// ─────────────────────────────────────────────────────────────────────────────

const FEEDBACK_PATH = '/admin/feedback';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TriageResult = { ok: true; status: FeedbackStatus } | { ok: false; error: string };

export async function setFeedbackStatusAction(
  feedbackId: string,
  status: string,
): Promise<TriageResult> {
  const admin = await requirePlatformAdmin();

  if (!UUID_RE.test((feedbackId ?? '').trim())) {
    return { ok: false, error: 'invalid-feedback' };
  }
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: 'invalid-status' };
  }

  const nextStatus = status as FeedbackStatus;
  const service = createServiceClient();
  const now = new Date().toISOString();

  // 'new' is the un-triaged state, so clear the triage trail when reverting; any
  // other status records who triaged it and when.
  const isTriaged = nextStatus !== 'new';

  const { data, error } = await service
    .from('feedback')
    .update({
      status: nextStatus,
      triaged_at: isTriaged ? now : null,
      triaged_by: isTriaged ? admin.userId : null,
    })
    .eq('id', feedbackId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[admin] set feedback status failed:', error?.message ?? 'missing row');
    return { ok: false, error: 'save-failed' };
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'feedback_status_set',
    targetType: 'feedback',
    targetId: feedbackId,
    metadata: { status: nextStatus },
  });

  revalidatePath(FEEDBACK_PATH);
  return { ok: true, status: nextStatus };
}
