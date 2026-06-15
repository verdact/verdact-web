'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, getUser, verifySession } from '@/lib/dal';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { PERSONA_IDS } from '@/lib/guidance';

export type SettingsState =
  | {
      ok?: boolean;
      error?: string;
      message?: string;
    }
  | undefined;

const DELIVERY_METHODS = ['app', 'email', 'download', 'combination'] as const;
const CUSTOMER_TYPES = ['b2b', 'b2c', 'both'] as const;
const DISCLOSURE_LOCATIONS = ['checkout', 'email', 'in_app', 'all'] as const;
const ACTIVITY_LOGGING = ['yes', 'no', 'sometimes'] as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function field(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? '').trim();
}

// Normalizes an optional text value: empty string becomes null so we don't store blanks.
function optional(value: string): string | null {
  return value.length > 0 ? value : null;
}

// Validates an optional enum value; throws on an unexpected non-empty value.
function optionalEnum<T extends string>(value: string, allowed: readonly T[], label: string): T | null {
  if (value.length === 0) return null;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Invalid ${label}.`);
}

function optionalUrl(value: string, label: string): string | null {
  if (value.length === 0) return null;
  if (!/^https?:\/\/\S+$/i.test(value)) {
    throw new Error(`${label} must be a full URL starting with http:// or https://.`);
  }
  return value;
}

export async function updateBusinessAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { error: 'Workspace not found. Sign out and back in.' };

  const merchantId = membership.merchant.id;
  const businessName = field(formData, 'businessName');

  try {
    const supabase = await createClient();

    if (businessName.length > 0 && businessName !== (membership.merchant.business_name ?? '')) {
      const { error: nameError } = await supabase
        .from('merchants')
        .update({ business_name: businessName })
        .eq('id', merchantId);
      if (nameError) throw nameError;
    }

    // Persona is ask-only and editable here; clearing it back to null is allowed
    // (unknown → generic guidance ranking). Setting it records 'self_select'.
    const persona = optionalEnum(field(formData, 'persona'), PERSONA_IDS, 'business type');

    const { error } = await supabase.from('merchant_profiles').upsert(
      {
        merchant_id: merchantId,
        product_description: optional(field(formData, 'productDescription')),
        delivery_method: optionalEnum(field(formData, 'deliveryMethod'), DELIVERY_METHODS, 'delivery method'),
        customer_type: optionalEnum(field(formData, 'customerType'), CUSTOMER_TYPES, 'customer type'),
        persona,
        persona_source: persona ? 'self_select' : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id' },
    );
    if (error) throw error;

    revalidatePath('/settings');
    return { ok: true, message: 'Business details saved.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updatePoliciesAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) return { error: 'Workspace not found. Sign out and back in.' };

  try {
    const { error } = await (await createClient()).from('merchant_profiles').upsert(
      {
        merchant_id: membership.merchant.id,
        refund_policy_text: optional(field(formData, 'refundPolicyText')),
        refund_policy_url: optionalUrl(field(formData, 'refundPolicyUrl'), 'Refund policy URL'),
        cancellation_policy_text: optional(field(formData, 'cancellationPolicyText')),
        cancellation_policy_url: optionalUrl(field(formData, 'cancellationPolicyUrl'), 'Cancellation policy URL'),
        tos_url: optionalUrl(field(formData, 'tosUrl'), 'Terms of service URL'),
        policy_disclosure_location: optionalEnum(
          field(formData, 'policyDisclosureLocation'),
          DISCLOSURE_LOCATIONS,
          'disclosure location',
        ),
        transaction_description_template: optional(field(formData, 'transactionDescriptionTemplate')),
        logs_user_activity: optionalEnum(field(formData, 'logsUserActivity'), ACTIVITY_LOGGING, 'activity logging'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id' },
    );
    if (error) throw error;

    revalidatePath('/settings');
    return { ok: true, message: 'Policies saved. These help Verdact build stronger evidence.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updateNameAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const fullName = field(formData, 'fullName');
  if (fullName.length === 0) {
    return { error: 'Enter your name.' };
  }

  try {
    const supabase = await createClient();
    // Stored in auth user_metadata.full_name (no DB migration). This is the
    // name Verdact uses to greet the person, separate from the workspace name.
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (error) throw error;
    revalidatePath('/dashboard');
    return { ok: true, message: 'Name saved.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updateEmailAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const email = field(formData, 'email');
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
    return { ok: true, message: 'Check both inboxes to confirm the change to your new address.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function updatePasswordAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const password = (formData.get('password') as string | null) ?? '';
  const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  if (password !== confirmPassword) return { error: 'Passwords do not match.' };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return { ok: true, message: 'Password updated.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function requestAccountDeletionAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await verifySession();
  const membership = await getMerchant();
  const user = await getUser();
  if (!membership || !user) return { error: 'Workspace not found. Sign out and back in.' };

  const confirmation = field(formData, 'confirm');
  if (confirmation.toLowerCase() !== 'delete') {
    return { error: 'Type DELETE to confirm your request.' };
  }

  try {
    // Authenticated users have no insert policy on audit_log, so this durable
    // record is written with the service-role client. Deletion is a request,
    // not an immediate cascade (retention/erasure split is unresolved).
    const service = createServiceClient();
    const { error } = await service.from('audit_log').insert({
      merchant_id: membership.merchant.id,
      user_id: user.id,
      action: 'account_deletion_requested',
      resource: 'merchant',
      metadata: {
        schema_version: 'v1',
        email: user.email ?? null,
        requested_at: new Date().toISOString(),
      },
    });
    if (error) throw error;

    return {
      ok: true,
      message: 'Request received. We will action it within 2 business days and email you to confirm.',
    };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}
