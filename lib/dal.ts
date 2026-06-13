import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Merchant = {
  id: string;
  business_name: string | null;
  created_at: string;
};

export type MerchantMembership = {
  merchant: Merchant;
  role: 'owner' | 'admin' | 'member' | 'viewer';
};

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const verifySession = cache(async () => {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  return user;
});

export const getMerchant = cache(async (): Promise<MerchantMembership | null> => {
  await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('merchant_users')
    .select(
      `
        role,
        merchant:merchants ( id, business_name, created_at )
      `,
    )
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const merchant = Array.isArray(data.merchant) ? data.merchant[0] : data.merchant;
  if (!merchant) {
    return null;
  }

  return {
    merchant: merchant as Merchant,
    role: data.role as MerchantMembership['role'],
  };
});

export type DisputeStatus =
  | 'needs_response'
  | 'under_review'
  | 'won'
  | 'lost'
  | 'warning_closed'
  | 'submitted';

export type Dispute = {
  id: string;
  processor_dispute_id: string;
  processor_charge_id: string | null;
  amount: number | null;
  currency: string | null;
  reason: string | null;
  network: string | null;
  status: DisputeStatus;
  due_by: string | null;
  ce3_eligible: boolean | null;
  outcome: string | null;
  created_at: string;
};

export type EfwAlert = {
  id: string;
  processor_alert_id: string;
  processor_charge_id: string | null;
  fraud_type: string | null;
  actionable: boolean | null;
  merchant_decision: 'pending' | 'refund' | 'fight';
  created_at: string;
};

export type VampSnapshot = {
  estimated_vamp_ratio: number | null;
  confidence_level: 'low' | 'medium' | 'high' | null;
  visa_settled_transaction_count: number;
  visa_dispute_count: number;
  visa_efw_count: number;
  calculation_window_start: string;
  calculation_window_end: string;
  raw_components: Record<string, unknown> | null;
  calculated_at: string;
};

const OPEN_DISPUTE_STATUSES: DisputeStatus[] = ['needs_response', 'under_review', 'submitted'];

// Disputes for the current merchant. RLS already scopes rows to the caller's
// merchant; the explicit merchant_id filter keeps the query intent clear.
export const getDisputes = cache(async (): Promise<Dispute[]> => {
  const membership = await getMerchant();
  if (!membership) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('disputes')
    .select(
      'id, processor_dispute_id, processor_charge_id, amount, currency, reason, network, status, due_by, ce3_eligible, outcome, created_at',
    )
    .eq('merchant_id', membership.merchant.id)
    .order('due_by', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Dispute[];
});

// Early fraud warnings for the current merchant, newest first.
export const getEfwAlerts = cache(async (): Promise<EfwAlert[]> => {
  const membership = await getMerchant();
  if (!membership) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('efw_alerts')
    .select(
      'id, processor_alert_id, processor_charge_id, fraud_type, actionable, merchant_decision, created_at',
    )
    .eq('merchant_id', membership.merchant.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as EfwAlert[];
});

// ─── Per-customer evidence grouping (R8 — subscription-customer linkage) ─────
// Groups a merchant's disputes by the customer they came from, so a merchant
// facing the same customer disputing across months reuses one record instead of
// rebuilding. Linkage is by normalized customer_email (a stable key for
// subscription / repeat clients). Fuzzy name/agency entity-resolution is
// deliberately deferred — only exact-email matches group here.

export type CustomerDisputeRef = {
  id: string;
  processor_dispute_id: string;
  amount: number | null;
  currency: string | null;
  reason: string | null;
  network: string | null;
  status: DisputeStatus;
  due_by: string | null;
  outcome: string | null;
  created_at: string;
};

export type CustomerGroup = {
  // Lower-cased customer email — the linkage key. Null bucket = unlinked.
  customerKey: string | null;
  customerEmail: string | null;
  customerName: string | null;
  disputes: CustomerDisputeRef[];
  totalAmount: number; // cents, summed across the group
  openCount: number;
  wonCount: number;
  lostCount: number;
};

type DisputeWithPiiRow = CustomerDisputeRef & {
  dispute_pii: { customer_email: string | null; customer_name: string | null } | null;
};

const OPEN_FOR_CUSTOMER: DisputeStatus[] = ['needs_response', 'under_review', 'submitted'];

export const getDisputesByCustomer = cache(async (): Promise<CustomerGroup[]> => {
  const membership = await getMerchant();
  if (!membership) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('disputes')
    .select(
      `id, processor_dispute_id, amount, currency, reason, network, status, due_by, outcome, created_at,
       dispute_pii ( customer_email, customer_name )`,
    )
    .eq('merchant_id', membership.merchant.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return groupDisputesByCustomer(data as unknown as DisputeWithPiiRow[]);
});

// Pure, exported for testing. Groups rows by normalized email; rows without an
// email fall into a single null bucket (unlinked).
export function groupDisputesByCustomer(rows: DisputeWithPiiRow[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>();

  for (const row of rows) {
    const pii = Array.isArray(row.dispute_pii) ? row.dispute_pii[0] : row.dispute_pii;
    const email = pii?.customer_email?.trim().toLowerCase() || null;
    const key = email ?? '__unlinked__';

    let group = groups.get(key);
    if (!group) {
      group = {
        customerKey: email,
        customerEmail: pii?.customer_email?.trim() || null,
        customerName: pii?.customer_name?.trim() || null,
        disputes: [],
        totalAmount: 0,
        openCount: 0,
        wonCount: 0,
        lostCount: 0,
      };
      groups.set(key, group);
    }

    group.disputes.push({
      id: row.id,
      processor_dispute_id: row.processor_dispute_id,
      amount: row.amount,
      currency: row.currency,
      reason: row.reason,
      network: row.network,
      status: row.status,
      due_by: row.due_by,
      outcome: row.outcome,
      created_at: row.created_at,
    });
    group.totalAmount += row.amount ?? 0;
    if (OPEN_FOR_CUSTOMER.includes(row.status)) group.openCount += 1;
    if (row.outcome === 'won') group.wonCount += 1;
    if (row.outcome === 'lost') group.lostCount += 1;
    if (!group.customerName && pii?.customer_name?.trim()) {
      group.customerName = pii.customer_name.trim();
    }
  }

  // Repeat-offender groups (2+ disputes) first, then by total amount.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.disputes.length !== b.disputes.length) return b.disputes.length - a.disputes.length;
    return b.totalAmount - a.totalAmount;
  });
}

// Most recent VAMP snapshot for the current merchant, or null if none exist.
export const getLatestVampSnapshot = cache(async (): Promise<VampSnapshot | null> => {
  const membership = await getMerchant();
  if (!membership) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vamp_snapshots')
    .select(
      'estimated_vamp_ratio, confidence_level, visa_settled_transaction_count, visa_dispute_count, visa_efw_count, calculation_window_start, calculation_window_end, raw_components, calculated_at',
    )
    .eq('merchant_id', membership.merchant.id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as VampSnapshot;
});
