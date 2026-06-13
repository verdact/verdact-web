'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

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
