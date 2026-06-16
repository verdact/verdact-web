import { getLeadsData } from './data';
import { AdminShell } from '../_components/admin-shell';
import { LeadsView } from './leads-view';

export const metadata = {
  title: 'Admin · Leads | Verdact',
  description: 'Founder-only convert console for the top of the funnel.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
  const data = await getLeadsData();
  return (
    <AdminShell email={data.admin.email} active="leads">
      <LeadsView data={data} />
    </AdminShell>
  );
}
