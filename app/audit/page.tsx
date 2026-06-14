import type { Metadata } from 'next';
import { AuditFunnel } from './AuditFunnel';

// Public, no-login conversion funnel. Lives under /audit so it can be staged
// separately. Leads with the comms-layer / Visa 13.1 "services not rendered"
// wedge: the service-delivery disputes Stripe-native tools mark unavailable.
export const metadata: Metadata = {
  title: { absolute: 'Dispute audit: which disputes you should have won' },
  description:
    'Upload your last 90 days of Stripe disputes, or enter them by hand. See which ones you likely should have won, where your dispute rate stands against the 0.75% line, and how many hinged on email and Slack evidence Stripe-native tools cannot reach. Free, no signup.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://www.verdact.io/audit' },
  openGraph: {
    title: 'Find the disputes you should have won',
    description:
      'A free read on your last 90 days of disputes: which were winnable, where your dispute rate stands, and how many hinged on comms evidence Stripe cannot reach.',
    url: 'https://www.verdact.io/audit',
    siteName: 'Verdact',
    type: 'website',
  },
};

export default function AuditPage() {
  return <AuditFunnel />;
}
