import { AdminShell } from '../_components/admin-shell';
import { firstParam } from '../_components/ui';
import { getFeedbackData, type StatusFilter } from './data';
import { FeedbackView } from './feedback-view';

export const metadata = {
  title: 'Admin · Feedback | Verdact',
  description: 'Founder-only feedback inbox for Verdact.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function resolveStatus(value: string | null): StatusFilter {
  return value === 'new' || value === 'triaged' || value === 'closed' ? value : 'all';
}

function resolvePage(value: string | null): number {
  const n = Number(value ?? '1');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(firstParam(sp.status));
  const query = firstParam(sp.q) ?? '';
  const page = resolvePage(firstParam(sp.page));

  const data = await getFeedbackData({ status, query, page });

  return (
    <AdminShell email={data.admin.email} active="feedback" feedbackNewCount={data.counts.new}>
      <FeedbackView data={data} />
    </AdminShell>
  );
}
