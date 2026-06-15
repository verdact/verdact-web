'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin, logPlatformAdminEvent, normalizeEmail } from '@/lib/admin/platform-admin';
import { createServiceClient } from '@/lib/supabase/server';

type AdmissionMode = 'invite_only' | 'open_beta';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function approveInviteAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const email = normalizeEmail(field(formData, 'email'));
  const notes = optionalText(field(formData, 'notes'), 500);

  if (!EMAIL_RE.test(email)) {
    redirectWithError('invalid-email');
  }

  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from('platform_invites')
    .upsert(
      {
        email,
        status: 'approved',
        source: 'admin',
        notes,
        created_by: admin.userId,
        updated_at: now,
      },
      { onConflict: 'email_normalized' },
    )
    .select('id, email')
    .maybeSingle();

  if (error || !data) {
    console.error('[admin] approve invite failed:', error?.message ?? 'missing row');
    redirectWithError('invite-failed');
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'platform_invite_approved',
    targetType: 'platform_invite',
    targetId: data.id,
    metadata: { email },
  });

  revalidatePath('/admin');
  redirectWithNotice('invite-approved');
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const inviteId = field(formData, 'inviteId');

  if (!UUID_RE.test(inviteId)) {
    redirectWithError('invalid-invite');
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('platform_invites')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select('id, email')
    .maybeSingle();

  if (error || !data) {
    console.error('[admin] revoke invite failed:', error?.message ?? 'missing row');
    redirectWithError('revoke-failed');
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'platform_invite_revoked',
    targetType: 'platform_invite',
    targetId: data.id,
    metadata: { email: data.email },
  });

  revalidatePath('/admin');
  redirectWithNotice('invite-revoked');
}

export async function setAdmissionModeAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const mode = field(formData, 'mode') as AdmissionMode;
  const confirmation = field(formData, 'confirmation').toUpperCase();

  if (mode !== 'invite_only' && mode !== 'open_beta') {
    redirectWithError('invalid-mode');
  }

  if (mode === 'open_beta' && confirmation !== 'OPEN BETA') {
    redirectWithError('open-beta-confirmation');
  }

  const service = createServiceClient();
  const { error } = await service
    .from('platform_admission_policy')
    .update({
      mode,
      updated_by: admin.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);

  if (error) {
    console.error('[admin] set admission mode failed:', error.message);
    redirectWithError('mode-failed');
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'admission_mode_changed',
    targetType: 'platform_admission_policy',
    targetId: 'singleton',
    metadata: { mode },
  });

  revalidatePath('/admin');
  redirectWithNotice(mode === 'open_beta' ? 'open-beta-enabled' : 'invite-only-enabled');
}

function field(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? '').trim();
}

function optionalText(value: string, maxLength: number): string | null {
  if (!value) return null;
  return value.slice(0, maxLength);
}

function redirectWithNotice(code: string): never {
  redirect(`/admin?notice=${encodeURIComponent(code)}`);
}

function redirectWithError(code: string): never {
  redirect(`/admin?error=${encodeURIComponent(code)}`);
}
