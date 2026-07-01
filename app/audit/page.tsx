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

const APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Stripe Dispute Audit',
  url: 'https://www.verdact.io/audit',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Free, no-login audit of your recent Stripe disputes: which you likely should have won, where your dispute rate stands against the 0.75% line, and how many hinged on email and Slack evidence Stripe-native tools cannot reach.',
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the Stripe dispute audit free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The audit is free and needs no login or Stripe connection. You enter your last 90 days of disputes by CSV export or by hand and see your read instantly.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does the dispute audit check?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'For each dispute it reads the reason code and the proof you hold, flags the ones with a profile that typically wins on representment, and shows your overall dispute rate against the 0.75% line where Stripe can limit an account.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which Stripe disputes are hardest to win?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Services-not-rendered and cancelled-subscription chargebacks, because the deciding proof lives in your email and delivery logs rather than in Stripe, so Stripe marks them unavailable. The audit flags how many of yours hinge on that communications evidence.',
      },
    },
  ],
};

export default function AuditPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <AuditFunnel />
    </>
  );
}
