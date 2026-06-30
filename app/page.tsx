import type { Metadata } from 'next';
import { HomepageClient } from './_components/home/homepage-client';

export const metadata: Metadata = {
  title: { absolute: 'Verdact' },
  description:
    'Verdact reads your Stripe dispute, organizes your proof of scope, delivery, and approval into a submission-ready response, and flags what is missing before you file. For service businesses on Stripe.',
  openGraph: {
    title: 'Verdact',
    description:
      'Verdact reads your Stripe dispute, organizes your proof of scope, delivery, and approval into a submission-ready response, and flags what is missing before you file. For service businesses on Stripe.',
    url: 'https://www.verdact.io/',
    siteName: 'Verdact',
    type: 'website',
  },
};

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Verdact',
  url: 'https://www.verdact.io/',
  logo: 'https://www.verdact.io/favicon.svg',
};

const APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Verdact',
  url: 'https://www.verdact.io/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Verdact helps service businesses on Stripe turn delivered work into stronger, submission-ready dispute evidence.',
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a service chargeback?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A service chargeback is when a customer asks their card issuer to reverse a payment for a service you already delivered, rather than a physical product. The issuer weighs evidence from both sides and decides. For service work the deciding evidence is rarely a tracking number. It is proof that you scoped the work, delivered it, and got the client’s acceptance.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I just respond in the Stripe dashboard?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can. Stripe gives you a form. Verdact gives you what the form does not: the proof structure issuers expect for service disputes, a check for what is missing while there is still time to fix it, and a validated, submission-ready packet. You approve before anything is filed.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who is Verdact for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Freelancers, agencies, consultants, and service businesses on Stripe who deliver work and then have to prove it when a customer disputes the charge.',
      },
    },
    {
      '@type': 'Question',
      name: 'What evidence helps prove service delivery?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Contracts and scope documents, delivery records, access and usage logs, client approvals, the project conversation, and your accepted refund policy.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Verdact guarantee I will win?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. No honest tool can. Verdact helps you respond before the deadline with the strongest, best-organized evidence you have.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <HomepageClient />
    </>
  );
}
