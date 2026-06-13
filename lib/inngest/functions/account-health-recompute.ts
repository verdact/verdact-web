import { inngest } from '../client';
import { createStripeClient } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import {
  ACCOUNT_HEALTH_RECOMPUTE_EVENT,
  computeVampSnapshot,
  writeVampSnapshot,
  type ProcessorConnectionRow,
} from '@/lib/account-health/vamp-snapshots';

const DAILY_CRON = 'TZ=UTC 0 7 * * *';
const PAGE_SIZE = 500;
const JITTER_WINDOW_SECONDS = 300;
const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

type RecomputeEventData = {
  merchantId?: string;
  processorConnectionId?: string;
  force?: boolean;
  source?: string;
  jitterSeconds?: number;
};

type ConnectedMerchant = {
  id: string;
  merchant_id: string;
};

export const accountHealthRecompute = inngest.createFunction(
  { id: 'account-health-recompute', name: 'Recompute Account Health Snapshot', retries: 3 },
  { event: ACCOUNT_HEALTH_RECOMPUTE_EVENT },
  async ({ event, step, logger }) => {
    const data = (event.data ?? {}) as RecomputeEventData;
    const merchantId = data.merchantId;

    if (!merchantId) {
      logger.error('account-health recompute missing merchantId', { data });
      return { skipped: 'missing-merchant-id' };
    }

    const jitterSeconds = Math.max(0, Math.min(data.jitterSeconds ?? 0, JITTER_WINDOW_SECONDS));
    if (jitterSeconds > 0) {
      await step.sleep('stripe-rate-limit-jitter', `${jitterSeconds}s`);
    }

    const supabase = createServiceClient();

    const freshSnapshot = await step.run('check-24h-cache', async () => {
      if (data.force === true) return null;
      const cacheCutoff = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();
      const { data: row, error } = await supabase
        .from('vamp_snapshots')
        .select('id, calculated_at')
        .eq('merchant_id', merchantId)
        .gte('calculated_at', cacheCutoff)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return row;
    });

    if (freshSnapshot) {
      return {
        skipped: 'fresh-cache',
        merchantId,
        snapshotId: freshSnapshot.id,
        calculatedAt: freshSnapshot.calculated_at,
      };
    }

    const connection = await step.run('load-stripe-connection', async () => {
      let query = supabase
        .from('processor_connections')
        .select('id, merchant_id, processor_account_id, processor_api_version')
        .eq('merchant_id', merchantId)
        .eq('processor', 'stripe')
        .eq('connection_status', 'connected');

      if (data.processorConnectionId) {
        query = query.eq('id', data.processorConnectionId);
      }

      const { data: rows, error } = await query
        .order('connected_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (error) throw error;
      return ((rows ?? [])[0] as ProcessorConnectionRow | undefined) ?? null;
    });

    if (!connection) {
      logger.warn('No connected Stripe account for account-health recompute', { merchantId });
      return { skipped: 'no-connected-stripe-account', merchantId };
    }

    const snapshot = await step.run('compute-vamp-snapshot', async () => {
      const stripe = createStripeClient();
      return computeVampSnapshot({ supabase, stripe, connection });
    });

    const stored = await step.run('write-vamp-snapshot', async () => {
      return writeVampSnapshot({ supabase, snapshot });
    });

    return {
      merchantId,
      snapshotId: stored.id,
      calculatedAt: stored.calculated_at,
      confidenceLevel: snapshot.confidence_level,
      estimatedVampRatio: snapshot.estimated_vamp_ratio,
      source: data.source ?? 'event',
    };
  },
);

export const accountHealthDailyFanout = inngest.createFunction(
  { id: 'account-health-daily-fanout', name: 'Daily Account Health Fan-out', retries: 2 },
  { cron: DAILY_CRON },
  async ({ step }) => {
    const supabase = createServiceClient();

    const connectedMerchants = await step.run('load-connected-stripe-merchants', async () => {
      const uniqueByMerchant = new Map<string, ConnectedMerchant>();
      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('processor_connections')
          .select('id, merchant_id')
          .eq('processor', 'stripe')
          .eq('connection_status', 'connected')
          .order('connected_at', { ascending: false, nullsFirst: false })
          .range(from, to);

        if (error) throw error;

        for (const row of data ?? []) {
          const connected = row as ConnectedMerchant;
          if (!uniqueByMerchant.has(connected.merchant_id)) {
            uniqueByMerchant.set(connected.merchant_id, connected);
          }
        }

        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return Array.from(uniqueByMerchant.values());
    });

    if (connectedMerchants.length === 0) {
      return { sent: 0 };
    }

    await step.sendEvent(
      'send-account-health-recompute-events',
      connectedMerchants.map((connection, index) => ({
        name: ACCOUNT_HEALTH_RECOMPUTE_EVENT,
        data: {
          merchantId: connection.merchant_id,
          processorConnectionId: connection.id,
          source: 'daily-cron',
          jitterSeconds: index % JITTER_WINDOW_SECONDS,
        },
      })),
    );

    return { sent: connectedMerchants.length };
  },
);
