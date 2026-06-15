'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { isPersona } from '@/lib/guidance';

export type OnboardingState =
  | {
      ok?: boolean;
      error?: string;
    }
  | undefined;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function field(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? '').trim();
}

// Saves the person's name (auth user_metadata.full_name) and the workspace name
// (merchants.business_name). Both are the required minimum from the onboarding
// wireframe. No DB migration: full_name lives in user_metadata.
export async function saveOnboardingBasicsAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { error: 'Workspace not found. Sign out and back in.' };

  const fullName = field(formData, 'fullName');
  const businessName = field(formData, 'businessName');

  if (!fullName) return { error: 'Enter your name so Verdact knows who to greet.' };
  if (!businessName) return { error: 'Enter your business name.' };

  try {
    const supabase = await createClient();

    const { error: nameError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (nameError) throw nameError;

    if (businessName !== (membership.merchant.business_name ?? '')) {
      const { error: bizError } = await supabase
        .from('merchants')
        .update({ business_name: businessName })
        .eq('id', membership.merchant.id);
      if (bizError) throw bizError;
    }

    revalidatePath('/onboarding');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// Saves the merchant's self-selected persona (the skippable onboarding question).
// Ask-only: there is no inference and no default — skipping leaves persona null
// and the guidance engine ranks tips generically. Stored on merchant_profiles
// (persona + persona_source='self_select') so server-side ranking can read it.
export async function savePersonaAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { error: 'Workspace not found. Sign out and back in.' };

  const persona = field(formData, 'persona');
  if (!isPersona(persona)) {
    return { error: 'Pick one of the options, or skip this question.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('merchant_profiles').upsert(
      {
        merchant_id: membership.merchant.id,
        persona,
        persona_source: 'self_select',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id' },
    );
    if (error) throw error;

    revalidatePath('/dashboard');
    return { ok: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

// Marks onboarding complete in user_metadata so the dashboard gate stops
// redirecting here. Used by "Finish" and by "Skip for now" so nobody is trapped.
// Redirects to the dashboard.
export async function completeOnboardingAction(): Promise<void> {
  await verifySession();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_completed: true },
  });
  if (error) {
    // Surface as a query param rather than a thrown 500 so the user can retry.
    redirect('/onboarding?error=complete_failed');
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
