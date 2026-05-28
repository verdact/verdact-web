import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest/client';
import { rotateTokenKeys } from '../../../lib/inngest/functions/rotate-token-keys';
import { stripeWebhookReceived } from '../../../lib/inngest/functions/stripe-webhook-received';

// Expose the Inngest API route to register functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    rotateTokenKeys,
    stripeWebhookReceived,
  ],
});
