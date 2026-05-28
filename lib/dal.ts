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
