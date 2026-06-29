import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/server';

export const BETA_ACCESS_MESSAGE =
  'Verdact beta access is invite-only right now. Join the waitlist and we will open your workspace when your account is approved.';

export type AdmissionMode = 'invite_only' | 'open_beta';

type AdmissionPolicyRow = {
  mode: AdmissionMode;
};

/**
 * Read the platform admission mode. Drives whether `/signup` renders the real
 * account-creation form as the public default (open_beta) or the launching-soon
 * waitlist (invite_only). Fail-closed: any read error returns 'invite_only' so a
 * transient failure never accidentally opens public signup. This is a UI/render
 * signal only — account creation is still independently enforced server-side by
 * `emailHasBetaAccess()` (and the auth.users DB trigger). Wrapped in React.cache
 * so the per-request callers (generateMetadata + the page render) share one read.
 */
export const getAdmissionMode = cache(async (): Promise<AdmissionMode> => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('platform_admission_policy')
      .select('mode')
      .eq('id', true)
      .maybeSingle();

    if (error) {
      console.error('[auth/admission] mode read failed:', error.message);
      return 'invite_only';
    }

    return (data as AdmissionPolicyRow | null)?.mode === 'open_beta'
      ? 'open_beta'
      : 'invite_only';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[auth/admission] mode read threw:', message);
    return 'invite_only';
  }
});

type InviteRow = {
  id: string;
};

export async function emailHasBetaAccess(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  try {
    const supabase = createServiceClient();
    const { data: policy, error: policyError } = await supabase
      .from('platform_admission_policy')
      .select('mode')
      .eq('id', true)
      .maybeSingle();

    if (policyError) {
      console.error('[auth/admission] policy read failed:', policyError.message);
      return false;
    }

    if ((policy as AdmissionPolicyRow | null)?.mode === 'open_beta') {
      return true;
    }

    const now = new Date().toISOString();
    const { data: invite, error: inviteError } = await supabase
      .from('platform_invites')
      .select('id')
      .eq('email_normalized', normalized)
      .eq('status', 'approved')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      console.error('[auth/admission] invite read failed:', inviteError.message);
      return false;
    }

    return Boolean((invite as InviteRow | null)?.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[auth/admission] check threw:', message);
    return false;
  }
}
