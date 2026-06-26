import { getDisputes, getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { DisputesView, isDisputeFilter, type DisputeFilter } from './disputes-view';

// Statuses that can still take a response — the only rows where a "Worth
// responding" readiness chip is meaningful. Closed/resolved cases never get one.
const RESPONDABLE_STATUSES = new Set(['needs_response', 'under_review']);

// evidence_files.purpose → the proof pillar shown on a dispute. Mirrors the
// dashboard docket so present-vs-missing reads identically across both surfaces.
const PROOF_PILLAR_BY_PURPOSE: Record<string, string> = {
  service_documentation: 'Delivery',
  communication: 'Comms',
  refund_policy: 'Policy',
  cancellation_policy: 'Policy',
  uncategorized: 'Document',
};

type ProofFileRow = { dispute_id: string; purpose: string };

// Groups attached evidence into the set of present pillars per dispute. Real
// booleans from evidence_files only — never fabricated.
function groupProofByDispute(rows: ProofFileRow[]): Record<string, string[]> {
  const byDispute = new Map<string, Set<string>>();
  for (const row of rows) {
    const pillar = PROOF_PILLAR_BY_PURPOSE[row.purpose] ?? 'Document';
    const set = byDispute.get(row.dispute_id) ?? new Set<string>();
    set.add(pillar);
    byDispute.set(row.dispute_id, set);
  }
  return Object.fromEntries([...byDispute].map(([id, set]) => [id, [...set]]));
}

export const metadata = {
  title: 'Disputes · Verdact',
  description: 'Every dispute Verdact is watching, with the nearest deadlines first.',
};

export const dynamic = 'force-dynamic';

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filterParam = typeof params.filter === 'string' ? params.filter : undefined;
  const explicitFilter: DisputeFilter | null = isDisputeFilter(filterParam) ? filterParam : null;

  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;

  let stripeConnected = false;
  if (membership) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('processor_connections')
      .select('id')
      .eq('merchant_id', membership.merchant.id)
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected')
      .maybeSingle();
    stripeConnected = Boolean(data);
  }

  const disputes = membership ? await getDisputes() : [];

  // Default view: needs-action, but fall back to a non-empty filter when nothing
  // needs a response yet, so a freshly-synced merchant whose disputes are all
  // under_review/closed does not misread "Nothing needs you right now" as "no
  // disputes". An explicit ?filter= in the URL always wins.
  let filter: DisputeFilter = explicitFilter ?? 'needs-action';
  if (!explicitFilter && disputes.length > 0) {
    const needsActionCount = disputes.filter((d) => d.status === 'needs_response').length;
    if (needsActionCount === 0) {
      const openCount = disputes.filter(
        (d) => d.status === 'needs_response' || d.status === 'under_review' || d.status === 'submitted',
      ).length;
      filter = openCount > 0 ? 'open' : 'all';
    }
  }

  // Proof-on-file pillars for the respondable disputes — one batched read,
  // grouped by dispute. Powers the honest "Worth responding" chip (present vs
  // missing required elements). Real booleans only; never fabricated.
  let proofByDispute: Record<string, string[]> = {};
  if (membership) {
    const respondableIds = disputes
      .filter((d) => RESPONDABLE_STATUSES.has(d.status))
      .map((d) => d.id);
    if (respondableIds.length > 0) {
      const supabase = await createClient();
      const { data: files } = await supabase
        .from('evidence_files')
        .select('dispute_id, purpose')
        .eq('merchant_id', membership.merchant.id)
        .in('dispute_id', respondableIds);
      proofByDispute = groupProofByDispute((files ?? []) as ProofFileRow[]);
    }
  }

  return (
    <DisputesView
      email={user.email}
      businessName={businessName}
      disputes={disputes}
      stripeConnected={stripeConnected}
      filter={filter}
      proofByDispute={proofByDispute}
    />
  );
}
