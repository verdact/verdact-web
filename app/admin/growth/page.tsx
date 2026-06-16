import { AdminShell } from '@/app/admin/_components/admin-shell';
import { firstParam } from '@/app/admin/_components/ui';
import { getGrowthTrends, resolveRangeKey } from './data';
import { GrowthView } from './growth-view';

export const metadata = {
  title: 'Admin · Growth | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminGrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const sp = await searchParams;
  const range = resolveRangeKey(firstParam(sp.range));
  const data = await getGrowthTrends(range);

  return (
    <AdminShell email={data.admin.email} active="growth">
      <GrowthView data={data} />
    </AdminShell>
  );
}
