import { redirect } from 'next/navigation';
import {
  getDisputes,
  getEfwAlerts,
  getLatestVampSnapshot,
  getMerchant,
  verifySession,
  type Dispute,
  type EfwAlert,
  type VampSnapshot,
} from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { consumeAuditBackfill } from '@/lib/audit/backfill';
import { DashboardView, type StripeConnection } from './dashboard-view';

export const metadata = {
  title: 'Dashboard · Verdact',
  description: 'Dispute overview, account health, and evidence workspace.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const justConnected = params.connected === 'stripe';
  const stripeError = typeof params.stripe_error === 'string' ? params.stripe_error : null;

  const user = await verifySession();

  // First-run gate: send merchants who have not finished onboarding to the
  // wizard. Onboarding "Skip for now", "Finish", and connecting Stripe all set
  // onboarding_completed = true, so nobody is trapped or looped.
  if (user.user_metadata?.onboarding_completed !== true) {
    redirect('/onboarding');
  }

  const membership = await getMerchant();

  // Audit-funnel backfill: if this merchant arrived from the public /audit
  // funnel, their pre-signup audit data (keyed by email) is linked to the
  // workspace as historical context. Idempotent + absence-safe — already-linked
  // or missing leads are a no-op, and any failure never blocks the render.
  if (membership) {
    await consumeAuditBackfill(membership.merchant.id, user.email);
  }

  const businessName = membership?.merchant?.business_name?.trim() || null;
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  let stripeConnection: StripeConnection = null;
  let disputes: Dispute[] = [];
  let efwAlerts: EfwAlert[] = [];
  let vampSnapshot: VampSnapshot | null = null;
  let profileComplete = false;
  let proofByDispute: Record<string, string[]> = {};

  if (membership) {
    const supabase = await createClient();
    const merchantId = membership.merchant.id;

    const [connectionResult, disputesData, efwData, snapshot, profileResult] = await Promise.all([
      supabase
        .from('processor_connections')
        .select('id, processor_account_id, livemode, connected_at')
        .eq('merchant_id', merchantId)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected')
        .maybeSingle(),
      getDisputes(),
      getEfwAlerts(),
      getLatestVampSnapshot(),
      supabase
        .from('merchant_profiles')
        .select('product_description, delivery_method, refund_policy_text, refund_policy_url')
        .eq('merchant_id', merchantId)
        .maybeSingle(),
    ]);

    stripeConnection = connectionResult.data ?? null;
    disputes = disputesData;
    efwAlerts = efwData;
    vampSnapshot = snapshot;
    profileComplete = profileHasContent(profileResult.data as Record<string, unknown> | null);

    // Proof-on-file pillars for the docket rows — one batched read for the open
    // disputes, grouped by dispute. Real booleans only; never fabricated.
    const openIds = disputes.filter((d) => OPEN_STATUSES.has(d.status)).map((d) => d.id);
    if (openIds.length > 0) {
      const { data: files } = await supabase
        .from('evidence_files')
        .select('dispute_id, purpose')
        .eq('merchant_id', merchantId)
        .in('dispute_id', openIds);
      proofByDispute = groupProofByDispute((files ?? []) as ProofFileRow[]);
    }
  }

  return (
    <DashboardView
      email={user.email}
      businessName={businessName}
      fullName={fullName}
      disputes={disputes}
      efwAlerts={efwAlerts}
      vampRatio={vampSnapshot?.estimated_vamp_ratio ?? null}
      vampConfidence={vampSnapshot?.confidence_level ?? null}
      profileComplete={profileComplete}
      proofByDispute={proofByDispute}
      stripeConnection={stripeConnection}
      justConnected={justConnected}
      stripeError={stripeError}
    />
  );
}

const OPEN_STATUSES = new Set(['needs_response', 'under_review']);

// evidence_files.purpose → the proof pillar shown on a docket row.
const PROOF_PILLAR_BY_PURPOSE: Record<string, string> = {
  service_documentation: 'Delivery',
  communication: 'Comms',
  refund_policy: 'Policy',
  cancellation_policy: 'Policy',
  uncategorized: 'Document',
};

type ProofFileRow = { dispute_id: string; purpose: string };

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

// A profile "exists" only if it carries the context the evidence record leans on;
// an empty row from another flow should still read as incomplete.
function profileHasContent(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const fields = ['product_description', 'delivery_method', 'refund_policy_text', 'refund_policy_url'];
  return fields.some((f) => typeof profile[f] === 'string' && (profile[f] as string).trim().length > 0);
}
