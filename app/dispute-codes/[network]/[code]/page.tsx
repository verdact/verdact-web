import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDetailsForCode, REASON_CODE_DETAILS } from '@/lib/audit/reason-code-details';
import styles from './detail.module.css';

interface Props {
  params: Promise<{
    network: string;
    code: string;
  }>;
}

export async function generateStaticParams() {
  return REASON_CODE_DETAILS.map((detail) => ({
    network: detail.network,
    code: detail.code,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { network, code } = await params;
  const detail = getDetailsForCode(network, code);
  if (!detail) return {};

  const title = `Defending ${detail.title} Disputes | Verdact`;
  const description = `Learn how to fight and win Stripe disputes mapped to ${detail.title}. Structured evidence strategies, proof checklist, and representment guidelines.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.verdact.io/dispute-codes/${network}/${code}`,
    },
  };
}

export default async function ReasonCodeDetailPage({ params }: Props) {
  const { network, code } = await params;
  const detail = getDetailsForCode(network, code);
  if (!detail) {
    notFound();
  }

  const SCHEMA = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `How to Defend and Win ${detail.title} Chargebacks`,
    description: detail.description,
    author: {
      '@type': 'Organization',
      name: 'Verdact',
      url: 'https://www.verdact.io/',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Verdact',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.verdact.io/favicon.svg',
      },
    },
    mainEntityOfPage: `https://www.verdact.io/dispute-codes/${network}/${code}`,
  };

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <div className={styles.breadcrumbs}>
        <Link href="/dispute-codes">Reason Codes</Link>
        <span className={styles.separator}>/</span>
        <span className={styles.activeBreadcrumb}>{detail.network.toUpperCase()} {detail.code.replace('-', '.')}</span>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>{detail.title}</h1>
        <p className={styles.meta}>Card Network Reference Guide</p>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>What is this reason code?</h2>
          <p className={styles.paragraph}>{detail.description}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Representment & Winning Strategy</h2>
          <p className={styles.paragraph}>{detail.winStrategy}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Required Evidence Checklist</h2>
          <p className={styles.checklistIntro}>
            To successfully reverse this chargeback, you should gather the following evidence. Verdact automates the ingestion of these files and links them to the dispute details:
          </p>
          <ul className={styles.checklist}>
            {detail.requiredEvidence.map((item, idx) => (
              <li key={idx} className={styles.checkItem}>
                <span className={styles.checkIcon}>✓</span>
                <span className={styles.checkText}>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.ctaBox}>
          <h3 className={styles.ctaTitle}>Fight this dispute before the network deadline</h3>
          <p className={styles.ctaDesc}>
            Connect your Stripe account in test mode to automatically scan your dispute profiles, build a Chain of Intent evidence record, and review the final response packet.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/signup" className={styles.primaryButton}>
              Create Free Testing Workspace
            </Link>
            <Link href="/audit" className={styles.secondaryButton}>
              Scan Past Disputes
            </Link>
          </div>
          <p className={styles.ctaTrust}>
            Free during beta. Nothing is filed without you. We never take a cut.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/dispute-codes" className={styles.footerLink}>
          ← Back to All Reason Codes
        </Link>
      </footer>
    </div>
  );
}
