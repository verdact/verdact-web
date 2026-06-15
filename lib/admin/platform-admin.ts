import 'server-only';

import { cache } from 'react';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { createServiceClient } from '@/lib/supabase/server';

export type PlatformAdminRole = 'owner' | 'admin';

export type PlatformAdmin = {
  userId: string;
  email: string;
  emailNormalized: string;
  role: PlatformAdminRole;
  source: 'database' | 'env';
};

type PlatformAdminRow = {
  role: PlatformAdminRole;
  status: 'active' | 'revoked';
};

type ServiceClient = ReturnType<typeof createServiceClient>;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export const requirePlatformAdmin = cache(async (): Promise<PlatformAdmin> => {
  const user = await verifySession();
  const emailNormalized = normalizeEmail(user.email);

  if (!emailNormalized) {
    notFound();
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('platform_admins')
    .select('role, status')
    .eq('email_normalized', emailNormalized)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify platform admin access: ${error.message}`);
  }

  if (data) {
    await markAdminSeen(service, user.id, emailNormalized);
    const row = data as PlatformAdminRow;
    return {
      userId: user.id,
      email: user.email ?? emailNormalized,
      emailNormalized,
      role: row.role,
      source: 'database',
    };
  }

  if (isEnvAdmin(emailNormalized)) {
    return {
      userId: user.id,
      email: user.email ?? emailNormalized,
      emailNormalized,
      role: 'owner',
      source: 'env',
    };
  }

  notFound();
});

async function markAdminSeen(
  service: ServiceClient,
  userId: string,
  emailNormalized: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await service
    .from('platform_admins')
    .update({ user_id: userId, last_seen_at: now, updated_at: now })
    .eq('email_normalized', emailNormalized);

  if (error) {
    console.error('[admin] failed to mark admin seen:', error.message);
  }
}

function isEnvAdmin(emailNormalized: string): boolean {
  const configured = process.env.VERDACT_ADMIN_EMAILS ?? '';
  return configured
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(emailNormalized);
}

export async function logPlatformAdminEvent({
  service,
  admin,
  action,
  targetType,
  targetId,
  metadata,
}: {
  service: ServiceClient;
  admin: PlatformAdmin;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await service.from('platform_admin_events').insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata: {
      schema_version: 'v1',
      ...(metadata ?? {}),
    },
  });

  if (error) {
    console.error('[admin] failed to record admin event:', error.message);
  }
}
