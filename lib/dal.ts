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

// Most recent VAMP snapshot for the current merchant, or null if none exist.
export const getLatestVampSnapshot = cache(async (): Promise<VampSnapshot | null> => {
  const membership = await getMerchant();
  if (!membership) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vamp_snapshots')
    .select('estimated_vamp_ratio, confidence_level, calculated_at')
    .eq('merchant_id', membership.merchant.id)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as VampSnapshot;
});
