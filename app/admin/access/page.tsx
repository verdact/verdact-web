import { getAccessData } from '@/lib/admin/queries';
import { AdminShell } from '../_components/admin-shell';
import { firstParam } from '../_components/ui';
import { AccessView } from './access-view';

export const metadata = {
  title: 'Admin · Access | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = { notice?: string | string[]; error?: string | string[] };

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const data = await getAccessData();

  return (
    <AdminShell email={data.admin.email} active="access">
      <AccessView data={data} notice={firstParam(sp.notice)} error={firstParam(sp.error)} />
    </AdminShell>
  );
}
