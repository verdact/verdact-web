import type { Metadata } from 'next';
import { VampChecker } from './VampChecker';

// Naming per marketing-vamp-checker-wireframe-v1 §"Naming & SEO treatment":
// VAMP stays in the SEO surface (route, title, meta) and is named on-page as
// Visa's version; the visible identity and the result are network-neutral.
export const metadata: Metadata = {
  title: { absolute: 'Dispute Rate & VAMP Checker: your real Stripe account risk' },
  description:
    'Free calculator. Estimate your overall dispute rate across every card brand and see how close you are to the 0.75% line where Stripe can limit your account. VAMP is Visa’s version; we show the line that actually applies at your volume.',
  alternates: { canonical: 'https://www.verdact.io/tools/vamp-check' },
  openGraph: {
    title: 'Dispute Rate & VAMP Checker: your real Stripe account risk',
    description:
      'Estimate your overall dispute rate across every card brand and see how close you are to the 0.75% line where Stripe can act. Free, no signup.',
    url: 'https://www.verdact.io/tools/vamp-check',
    siteName: 'Verdact',
    type: 'website',
  },
};

const SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Dispute Rate & VAMP Checker',
      url: 'https://www.verdact.io/tools/vamp-check',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Free tool to estimate your overall card dispute rate and see where your Stripe account stands against the 0.75% line where Stripe can limit accounts.',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How is the VAMP ratio / dispute rate calculated?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'It is the share of your settled card charges that end in a dispute, counting both chargebacks and early fraud warnings, across every card brand. Divide disputes plus fraud reports by settled transactions. Visa calls its version VAMP; Stripe and every card network watch the same kind of rate.',
          },
        },
        {
          '@type': 'Question',
          name: 'What dispute rate is too high for Stripe?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Stripe says network monitoring programs are likely triggered at about 0.75%, and can limit or close an account at or above that level. Under about 0.65% is normal. For most smaller merchants Stripe’s 0.75% line is the real limit, well before any single card network’s formal program applies.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the Visa VAMP threshold?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Visa’s VAMP program flags an acquirer’s merchant as excessive at a 1.5% ratio with 1,500 or more disputes and fraud reports in a month. Most smaller merchants are under that count, so Stripe’s own 0.75% line applies to them first.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does winning a dispute lower my dispute rate?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Usually no. Fighting a dispute can recover the money, but most service disputes still count toward your monitoring rate even when you win. Only fewer disputes bring the rate down. Certain Visa fraud disputes defended under Compelling Evidence 3.0 are excluded from the Visa count.',
          },
        },
      ],
    },
  ],
};

export default function VampCheckPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
      <VampChecker />
    </>
  );
}
