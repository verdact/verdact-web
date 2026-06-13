import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest/client';
import {
  accountHealthDailyFanout,
  accountHealthRecompute,
} from '../../../lib/inngest/functions/account-health-recompute';
import { rotateTokenKeys } from '../../../lib/inngest/functions/rotate-token-keys';
import { stripeWebhookReceived } from '../../../lib/inngest/functions/stripe-webhook-received';

// Expose the Inngest API route to register functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    accountHealthDailyFanout,
    accountHealthRecompute,
    rotateTokenKeys,
    stripeWebhookReceived,
  ],
});
