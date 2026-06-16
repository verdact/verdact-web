import { getActivityData } from './data';
import { AdminShell } from '../_components/admin-shell';
import { ActivityView } from './activity-view';

export const metadata = {
  title: 'Admin · Activity | Verdact',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminActivityPage() {
  const data = await getActivityData();
  return (
    <AdminShell email={data.admin.email} active="activity">
      <ActivityView data={data} />
    </AdminShell>
  );
}
