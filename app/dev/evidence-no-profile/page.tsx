import { notFound } from 'next/navigation';
import { AppShell } from '../../_components/app-chrome';
import { NoProfileFirstOpen } from '../../dashboard/disputes/[id]/no-profile-first-open';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview of the Evidence Record "no profile yet" first-open state.
// The real workbench is auth-gated and DB-backed. 404s in production.
// Use ?reason=product_not_received|subscription_canceled to vary the copy.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Evidence no-profile preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EvidenceNoProfilePreview({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { reason } = await searchParams;

  return (
    <AppShell email="founder@acmesoftware.com" businessName="Acme Software" active="disputes">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
        <NoProfileFirstOpen reason={reason ?? 'product_not_received'} />
      </div>
    </AppShell>
  );
}
