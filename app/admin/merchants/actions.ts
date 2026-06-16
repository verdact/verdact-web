'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin, logPlatformAdminEvent } from '@/lib/admin/platform-admin';
import { createServiceClient } from '@/lib/supabase/server';
import type { MerchantCategory } from '@/lib/admin/categorize';

// ─────────────────────────────────────────────────────────────────────────────
// Merchants surface server actions. Both gate on requirePlatformAdmin, validate
// input, mutate via the service client, log a platform_admin_event, revalidate,
// and redirect with ?notice= / ?error=. NOTHING is ever sent: markVampDrafted
// records drafted_at only and leaves sent_at null.
// ─────────────────────────────────────────────────────────────────────────────

const MERCHANTS_PATH = '/admin/merchants';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES: ReadonlySet<MerchantCategory> = new Set(['freelancer', 'agency', 'saas', 'other']);

export async function setCategoryAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();

  const merchantId = field(formData, 'merchantId');
  const category = field(formData, 'category') as MerchantCategory;

  if (!UUID_RE.test(merchantId)) {
    redirectWithError('invalid-merchant');
  }
  if (!VALID_CATEGORIES.has(category)) {
    redirectWithError('invalid-category');
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  // Write the override onto the merchant's profile. Upsert so a merchant without
  // a profile row still gets categorized; category_source marks it founder-set.
  const { data, error } = await service
    .from('merchant_profiles')
    .upsert(
      {
        merchant_id: merchantId,
        category,
        category_source: 'admin_override',
        updated_at: now,
      },
      { onConflict: 'merchant_id' },
    )
    .select('merchant_id')
    .maybeSingle();

  if (error || !data) {
    console.error('[admin] set merchant category failed:', error?.message ?? 'missing row');
    redirectWithError('category-failed');
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'merchant_category_set',
    targetType: 'merchant',
    targetId: merchantId,
    metadata: { category, source: 'admin_override' },
  });

  revalidatePath(MERCHANTS_PATH);
  redirectWithNotice('category-set');
}

export async function markVampDraftedAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();

  const merchantId = field(formData, 'merchantId');
  const ratioRaw = field(formData, 'ratio');
  const band = field(formData, 'band') || 'atRisk';

  if (!UUID_RE.test(merchantId)) {
    redirectWithError('invalid-merchant');
  }
  // Allowlist the band rather than trusting the DB CHECK as the only guard.
  const VALID_BANDS: ReadonlySet<string> = new Set(['healthy', 'close', 'atRisk', 'unknown']);
  if (!VALID_BANDS.has(band)) {
    redirectWithError('invalid-band');
  }

  const ratio = Number(ratioRaw);
  const estimatedRatio = Number.isFinite(ratio) ? ratio : null;

  const service = createServiceClient();
  const now = new Date().toISOString();

  // Record that an alert was DRAFTED. sent_at stays null (nothing is sent from
  // Verdact). This is an append-only log (no unique merchant_id constraint), so
  // INSERT a fresh row per draft. drafted_by is the admin UUID, matching the FK
  // column. The table is new and may be absent (migration unapplied); degrade.
  const { data, error } = await service
    .from('merchant_vamp_notifications')
    .insert({
      merchant_id: merchantId,
      estimated_vamp_ratio: estimatedRatio,
      band,
      drafted_at: now,
      drafted_by: admin.userId,
      channel: 'manual',
      sent_at: null,
      updated_at: now,
    })
    .select('merchant_id')
    .maybeSingle();

  if (error || !data) {
    console.error('[admin] mark vamp drafted failed:', error?.message ?? 'missing row');
    redirectWithError('draft-failed');
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'merchant_vamp_alert_drafted',
    targetType: 'merchant',
    targetId: merchantId,
    metadata: { band, estimatedRatio },
  });

  revalidatePath(MERCHANTS_PATH);
  redirectWithNotice('vamp-drafted');
}

function field(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? '').trim();
}

function redirectWithNotice(code: string): never {
  redirect(`${MERCHANTS_PATH}?notice=${encodeURIComponent(code)}`);
}

function redirectWithError(code: string): never {
  redirect(`${MERCHANTS_PATH}?error=${encodeURIComponent(code)}`);
}
