import { AdminShell } from '../_components/admin-shell';
import { getDisputesData } from './data';
import { DisputesView } from './disputes-view';

export const metadata = {
  title: 'Admin · Disputes | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDisputesPage() {
  const data = await getDisputesData();

  return (
    <AdminShell email={data.admin.email} active="disputes">
      <DisputesView data={data} />
    </AdminShell>
  );
}
