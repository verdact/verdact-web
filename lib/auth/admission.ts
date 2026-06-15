import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

export const BETA_ACCESS_MESSAGE =
  'Verdact beta access is invite-only right now. Join the waitlist and we will open your workspace when your account is approved.';

type AdmissionPolicyRow = {
  mode: 'invite_only' | 'open_beta';
};

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
