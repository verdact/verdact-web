'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthFormState =
  | {
      error?: string;
      email?: string;
      businessName?: string;
    }
  | undefined;

function getOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = ((formData.get('email') as string | null) ?? '').trim();
  const password = (formData.get('password') as string | null) ?? '';

  if (!email || !password) {
    return { error: 'Email and password are required.', email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, email };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signupAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = ((formData.get('email') as string | null) ?? '').trim();
  const password = (formData.get('password') as string | null) ?? '';
  const businessName = ((formData.get('businessName') as string | null) ?? '').trim();

  if (!email || !password) {
    return { error: 'Email and password are required.', email, businessName };
  }
  if (password.length < 8) {
    return {
      error: 'Password must be at least 8 characters.',
      email,
      businessName,
    };
  }

  const supabase = await createClient();
  const origin = getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: businessName ? { business_name: businessName } : undefined,
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: error.message, email, businessName };
  }

  // If email confirmation is disabled in Supabase, a session is returned immediately.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
}

export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await createClient();
  const origin = getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) {
    redirect(data.url);
  }

  redirect('/login?error=oauth_failed');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
