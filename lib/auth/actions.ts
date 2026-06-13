'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthFormState =
  | {
      error?: string;
      email?: string;
      businessName?: string;
      fullName?: string;
    }
  | undefined;

export type PasswordResetState =
  | {
      error?: string;
      email?: string;
      sent?: boolean;
      updated?: boolean;
    }
  | undefined;

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;
const PASSWORD_RECOVERY_COOKIE = 'verdact_password_recovery';

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
  const fullName = ((formData.get('fullName') as string | null) ?? '').trim();

  if (!email || !password) {
    return { error: 'Email and password are required.', email, businessName, fullName };
  }
  if (password.length < 8) {
    return {
      error: 'Password must be at least 8 characters.',
      email,
      businessName,
      fullName,
    };
  }

  const supabase = await createClient();
  const origin = getOrigin();

  // Person name and company name are distinct: full_name greets the human,
  // business_name labels the workspace. Both live in auth user_metadata, no DB
  // migration needed.
  const metadata: Record<string, string> = {};
  if (fullName) metadata.full_name = fullName;
  if (businessName) metadata.business_name = businessName;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: Object.keys(metadata).length > 0 ? metadata : undefined,
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: error.message, email, businessName, fullName };
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

export async function requestPasswordResetAction(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = ((formData.get('email') as string | null) ?? '').trim();

  if (!email) {
    return { error: 'Enter your email address.', email };
  }
  if (!EMAIL_SHAPE.test(email)) {
    return {
      error: 'That email does not look right. Check for typos.',
      email,
    };
  }

  const supabase = await createClient();
  const origin = getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    return { error: error.message, email };
  }

  return { sent: true, email };
}

export async function updatePasswordAction(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const password = (formData.get('password') as string | null) ?? '';
  const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

  if (!password || !confirmPassword) {
    return { error: 'Enter and confirm your new password.' };
  }
  if (password.length < 8) {
    return { error: 'Use at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const cookieStore = await cookies();
  const canRecover = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === '1';
  if (!canRecover) {
    return {
      error: 'This reset link has expired. Request a new link to continue.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: 'This reset link has expired. Request a new link to continue.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  revalidatePath('/', 'layout');
  return { updated: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
