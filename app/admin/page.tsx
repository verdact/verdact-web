import { AdminShell } from './_components/admin-shell';
import { firstParam } from './_components/ui';
import { getCommandData } from './command-data';
import { OverviewView } from './overview-view';
import { RANGE_KEYS, type RangeKey } from '@/lib/admin/ranges';

export const metadata = {
  title: 'Admin · Command | Verdact',
  description: 'Founder-only platform operations for Verdact.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE: RangeKey = '1m';

function resolveRange(value: string | null): RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(value ?? '') ? (value as RangeKey) : DEFAULT_RANGE;
}

export default async function AdminCommandPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(firstParam(sp.range));
  const data = await getCommandData(range);

  return (
    <AdminShell email={data.admin.email} active="overview">
      <OverviewView data={data} />
    </AdminShell>
  );
}
