'use server';

import { revalidatePath } from 'next/cache';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { ACCOUNT_HEALTH_RECOMPUTE_EVENT } from '@/lib/account-health/vamp-snapshots';

export type RefreshState =
  | {
      ok?: boolean;
      error?: string;
      message?: string;
    }
  | undefined;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Could not start a refresh. Please try again.';
}

// Free Refresh (Decision #11): sends the recompute event WITHOUT force, so the
// recompute function's built-in 24h cache guard serves a cached snapshot when
// one is under a day old. The reading updates asynchronously via Inngest, so the
// copy sets that expectation. revalidatePath pulls the latest stored snapshot
// (and freshness line) into the page on the next render.
export async function refreshAccountHealthAction(_prev: RefreshState): Promise<RefreshState> {
  await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    return { error: 'Workspace not found. Sign out and back in.' };
  }

  try {
    const supabase = await createClient();
    const { data: connection } = await supabase
      .from('processor_connections')
      .select('id')
      .eq('merchant_id', membership.merchant.id)
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected')
      .maybeSingle();

    if (!connection) {
      return { error: 'Connect Stripe before refreshing your account health.' };
    }

    await inngest.send({
      name: ACCOUNT_HEALTH_RECOMPUTE_EVENT,
      data: {
        merchantId: membership.merchant.id,
        processorConnectionId: connection.id,
        source: 'manual-refresh',
      },
    });

    revalidatePath('/account-health');
    return { ok: true, message: 'Refreshing. Your reading updates shortly.' };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}
