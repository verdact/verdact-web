import { notFound } from 'next/navigation';
import { OnboardingClient } from '../../onboarding/onboarding-client';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of /onboarding. The real route is auth-gated. Use
// ?stripe=on to preview the post-connect finish step. 404s in production.
// Server actions (save basics / complete) are no-ops here without a session.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Onboarding preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OnboardingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const params = await searchParams;
  const stripeConnected = params.stripe === 'on';

  return (
    <OnboardingClient
      initialFullName="Rishi Verma"
      initialBusinessName="Northstar Studio"
      stripeConnected={stripeConnected}
    />
  );
}
