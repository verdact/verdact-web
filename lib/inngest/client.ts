import { Inngest } from 'inngest';

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'verdact-web',
  // Inngest automatically reads INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY from env
});
