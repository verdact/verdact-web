import { AdminShell } from '../_components/admin-shell';
import { firstParam } from '../_components/ui';
import { getMerchantsData } from './data';
import { MerchantsView } from './merchants-view';

export const metadata = {
  title: 'Admin · Merchants | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = { notice?: string | string[]; error?: string | string[] };

export default async function AdminMerchantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const data = await getMerchantsData();

  return (
    <AdminShell email={data.admin.email} active="merchants">
      <MerchantsView data={data} notice={firstParam(sp.notice)} error={firstParam(sp.error)} />
    </AdminShell>
  );
}
