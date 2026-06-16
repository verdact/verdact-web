import { notFound } from 'next/navigation';
import { AdminShell, type AdminTab } from '../../admin/_components/admin-shell';
import { OverviewView } from '../../admin/overview-view';
import { MOCK_COMMAND } from '../../admin/command.mock';
import { GrowthView } from '../../admin/growth/growth-view';
import { MOCK_GROWTH } from '../../admin/growth/growth.mock';
import { LeadsView } from '../../admin/leads/leads-view';
import { MOCK_LEADS } from '../../admin/leads/leads.mock';
import { MerchantsView } from '../../admin/merchants/merchants-view';
import { MOCK_MERCHANTS } from '../../admin/merchants/merchants.mock';
import { DisputesView } from '../../admin/disputes/disputes-view';
import { MOCK_DISPUTES } from '../../admin/disputes/disputes.mock';
import { EconomicsView } from '../../admin/economics/economics-view';
import { MOCK_ECONOMICS } from '../../admin/economics/economics.mock';
import { AccessView } from '../../admin/access/access-view';
import { MOCK_ACCESS } from '../../admin/access/access.mock';
import { ActivityView } from '../../admin/activity/activity-view';
import { MOCK_ACTIVITY } from '../../admin/activity/activity.mock';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY visual preview of the founder admin console with sample data. The
// real /admin/* routes require a founder Supabase session; this route renders
// every surface against its own mock fixture so the views can be inspected
// without auth. 404s in production.
// Toggle: ?view=overview|growth|leads|merchants|disputes|economics|access|activity
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Admin preview · Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  const params = await searchParams;
  const view = (params.view ?? 'overview') as AdminTab;

  return (
    <AdminShell email="rishi@verdact.io" active={view} hrefFor={(tab) => `/dev/admin?view=${tab}`}>
      {view === 'growth' ? (
        <GrowthView data={MOCK_GROWTH} />
      ) : view === 'leads' ? (
        <LeadsView data={MOCK_LEADS} />
      ) : view === 'merchants' ? (
        <MerchantsView data={MOCK_MERCHANTS} notice={null} error={null} />
      ) : view === 'disputes' ? (
        <DisputesView data={MOCK_DISPUTES} />
      ) : view === 'economics' ? (
        <EconomicsView data={MOCK_ECONOMICS} notice={null} error={null} />
      ) : view === 'access' ? (
        <AccessView data={MOCK_ACCESS} notice={null} error={null} />
      ) : view === 'activity' ? (
        <ActivityView data={MOCK_ACTIVITY} />
      ) : (
        <OverviewView data={MOCK_COMMAND} />
      )}
    </AdminShell>
  );
}
