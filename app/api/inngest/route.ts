import { serve } from 'inngest/next';
import { inngest } from '../../../lib/inngest/client';
import { rotateTokenKeys } from '../../../lib/inngest/functions/rotate-token-keys';

// Expose the Inngest API route to register functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    rotateTokenKeys,
  ],
});
