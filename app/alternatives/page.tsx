import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPETITOR_DETAILS } from '@/lib/audit/competitor-details';
import styles from './alternatives.module.css';

export const metadata: Metadata = {
  title: 'Stripe Dispute Software Alternatives & Comparisons | Verdact',
  description:
    'Compare Verdact with Chargeflow, Disputifier, and Revano. Discover flat-fee, merchant-controlled alternatives for SaaS and agency dispute resolution.',
  alternates: { canonical: 'https://www.verdact.io/alternatives' },
  openGraph: {
    title: 'Stripe Dispute Software Alternatives & Comparisons | Verdact',
    description: 'Compare the leading Stripe chargeback software solutions to find the best fit for your SaaS or agency.',
    url: 'https://www.verdact.io/alternatives',
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

export default function AlternativesIndex() {
  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
      />

      <header className={styles.header}>
        <div className={styles.backLink}>
          <Link href="/">← Back to Verdact</Link>
        </div>
        <h1 className={styles.title}>Stripe Dispute Software Alternatives</h1>
        <p className={styles.subtitle}>
          Traditional chargeback services charge high commission success fees and file templates automatically without your review. Compare the leading platforms to find the best fit for your SaaS or agency.
        </p>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>
          {COMPETITOR_DETAILS.map((comp) => (
            <div key={comp.slug} className={styles.card}>
              <div>
                <h2 className={styles.cardTitle}>Verdact vs {comp.name}</h2>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Pricing:</span>
                  <span className={styles.metaValue}>{comp.pricingModel}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Filing Mode:</span>
                  <span className={styles.metaValue}>{comp.filingPosture}</span>
                </div>
                <p className={styles.cardDesc}>{comp.keyVulnerability}</p>
              </div>
              <div className={styles.cardFooter}>
                <Link href={`/alternatives/${comp.slug}`} className={styles.link}>
                  View Full Comparison Review →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          Ready to scan your account risk for free? Try our{' '}
          <Link href="/tools/vamp-check" className={styles.footerLink}>
            VAMP Threshold Checker
          </Link>{' '}
          or run a direct{' '}
          <Link href="/audit" className={styles.footerLink}>
            Dispute Audit
          </Link>.
        </p>
      </footer>
    </div>
  );
}
