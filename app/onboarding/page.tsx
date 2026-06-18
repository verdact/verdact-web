import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from './onboarding-client';
import { OnboardingWorkspaceMissing } from './onboarding-workspace-missing';

export const metadata = {
  title: 'Set up Verdact',
  description: 'Set up your dispute workbench and connect Stripe.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

// completeOnboardingAction redirects here with ?error=complete_failed when the
// final write fails. Map known codes to copy the user can act on; ignore
// anything unrecognised so a stray param never shows a raw code.
const ERROR_MESSAGES: Record<string, string> = {
  complete_failed: 'We could not finish setting up your workspace. Please try again.',
};

function resolveError(raw: string | string[] | undefined): string | undefined {
  const code = Array.isArray(raw) ? raw[0] : raw;
  if (!code) return undefined;
  return ERROR_MESSAGES[code];
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await verifySession();
  const membership = await getMerchant();

  // The wizard's write steps require an active merchant membership; without one
  // they hard-error. Guide the user to recover instead of rendering a form that
  // cannot save.
  if (!membership) {
    return <OnboardingWorkspaceMissing />;
  }

  const params = await searchParams;
  const initialError = resolveError(params.error);

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const businessName = membership.merchant.business_name?.trim() ?? '';

  const supabase = await createClient();
  const { data } = await supabase
    .from('processor_connections')
    .select('id')
    .eq('merchant_id', membership.merchant.id)
    .eq('processor', 'stripe')
    .eq('connection_status', 'connected')
    .maybeSingle();
  const stripeConnected = Boolean(data);

  return (
    <OnboardingClient
      initialFullName={fullName}
      initialBusinessName={businessName}
      stripeConnected={stripeConnected}
      initialError={initialError}
    />
  );
}
