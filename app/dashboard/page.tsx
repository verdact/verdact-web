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
import {
  evaluateGuidance,
  computeSuppressedRuleIds,
  ruleIdsShownOnDay,
  isPersona,
  type GuidanceItem,
  type GuidancePersona,
  type GuidanceImpression,
  type GuidanceResult,
} from '@/lib/guidance';
import { DashboardView, type StripeConnection } from './dashboard-view';
import { deriveGuidanceSignals, OPEN_STATUSES } from './signals';

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
  let guidance: GuidanceResult = { band: [], inline: [], primers: [] };

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
        .select('product_description, delivery_method, refund_policy_text, refund_policy_url, persona')
        .eq('merchant_id', merchantId)
        .maybeSingle(),
    ]);

    stripeConnection = connectionResult.data ?? null;
    disputes = disputesData;
    efwAlerts = efwData;
    vampSnapshot = snapshot;

    const profileData = profileResult.data as Record<string, unknown> | null;
    profileComplete = profileHasContent(profileData);
    const personaValue = typeof profileData?.persona === 'string' ? profileData.persona : null;
    const persona: GuidancePersona | undefined = isPersona(personaValue) ? personaValue : undefined;
    const hasStripe = stripeConnection !== null;

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

    // Guidance (Layer 1 band + Layer 4 primers). Signals are derived server-side
    // here so the engine + cadence run with DB access; the view just renders the
    // result. The band only renders once Stripe is connected, so cadence
    // reads/writes are gated on that — best-effort and never blocking the render.
    const signals = deriveGuidanceSignals({
      hasStripe,
      disputes,
      efwAlerts,
      vampRatio: vampSnapshot?.estimated_vamp_ratio ?? null,
      vampConfidence: vampSnapshot?.confidence_level ?? null,
      profileComplete,
      personaKnown: persona !== undefined,
    });

    let suppressedRuleIds: ReadonlySet<string> = new Set();
    let impressions: GuidanceImpression[] = [];
    if (hasStripe) {
      impressions = await readGuidanceImpressions(supabase, merchantId);
      suppressedRuleIds = computeSuppressedRuleIds(impressions, Date.now());
    }

    guidance = evaluateGuidance(signals, { target: 'dashboard', persona, suppressedRuleIds });

    if (hasStripe && guidance.band.length > 0) {
      await recordGuidanceImpressions(supabase, merchantId, guidance.band, persona, impressions);
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
      proofByDispute={proofByDispute}
      stripeConnection={stripeConnection}
      justConnected={justConnected}
      stripeError={stripeError}
      guidance={guidance}
    />
  );
}

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Recent dashboard tip history for the cadence math. The window covers the
// longest rest (7-day dismiss) with margin so nothing older still matters.
async function readGuidanceImpressions(
  supabase: DbClient,
  merchantId: string,
): Promise<GuidanceImpression[]> {
  const since = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('guidance_impressions')
    .select('rule_id, shown_at, dismissed_at')
    .eq('merchant_id', merchantId)
    .eq('target', 'dashboard')
    .gte('shown_at', since)
    .order('shown_at', { ascending: false });
  return (data ?? []) as GuidanceImpression[];
}

// Records a "shown" row for each rendered band tip, at most once per
// (merchant, rule, UTC-day) so refreshes don't spam rows or move the cooldown
// clock. Fire-and-forget: instrumentation never blocks or breaks the render.
async function recordGuidanceImpressions(
  supabase: DbClient,
  merchantId: string,
  band: GuidanceItem[],
  persona: GuidancePersona | undefined,
  existing: GuidanceImpression[],
): Promise<void> {
  const shownToday = ruleIdsShownOnDay(existing, Date.now());
  const rows = band
    .filter((item) => !shownToday.has(item.id))
    .map((item) => ({
      merchant_id: merchantId,
      rule_id: item.id,
      target: 'dashboard',
      severity: item.severity,
      is_urgent: item.urgent,
      target_ref: item.targetRef ?? null,
      persona: persona ?? null,
    }));
  if (rows.length === 0) return;

  try {
    await supabase.from('guidance_impressions').insert(rows);
  } catch {
    // Fire-and-forget: a failed insert just means this render isn't logged.
  }
}

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
