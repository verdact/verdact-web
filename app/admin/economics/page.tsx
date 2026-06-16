import { AdminShell } from '../_components/admin-shell';
import { firstParam } from '../_components/ui';
import { getEconomicsCockpitData } from './data';
import { EconomicsView } from './economics-view';

export const metadata = {
  title: 'Admin · Economics | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = { notice?: string | string[]; error?: string | string[] };

export default async function AdminEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const data = await getEconomicsCockpitData();

  return (
    <AdminShell email={data.admin.email} active="economics">
      <EconomicsView data={data} notice={firstParam(sp.notice)} error={firstParam(sp.error)} />
    </AdminShell>
  );
}
