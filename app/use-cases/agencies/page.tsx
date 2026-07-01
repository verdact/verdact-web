import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../use-cases.module.css';

export const metadata: Metadata = {
  title: 'Stripe Dispute Management for Agencies & Consultants | Verdact',
  description:
    'Protect your high-ticket agency retainers from friendly fraud. Verdact brings your Slack sign-offs and email evidence directly into your Stripe dispute response.',
  alternates: { canonical: 'https://www.verdact.io/use-cases/agencies' },
};

const PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Stripe Dispute Management for Agencies',
  description: 'How Verdact helps digital agencies, consultants, and service businesses win Stripe disputes.',
};

export default function AgenciesUseCasePage() {
  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_SCHEMA) }}
      />

      <header className={styles.header}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: 'var(--verdict)', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to Verdact
          </Link>
        </div>
        <h1 className={styles.title}>Dispute Management for Agencies</h1>
        <p className={styles.subtitle}>
          High-ticket service disputes require high-context evidence. Bring your Slack sign-offs and email threads directly into your Stripe chargeback defense.
        </p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The Agency Chargeback Problem</h2>
          <p className={styles.paragraph}>
            Digital agencies and consultants process high-ticket invoices via Stripe. When a client disputes a $10,000 retainer claiming "Services Not Rendered" (Reason Code 13.1), the financial impact is devastating.
          </p>
          <p className={styles.paragraph}>
            Your proof of delivery doesn't live in a database log; it lives in Slack channels, Zoom transcripts, and email threads where the client said, "Looks great, approved!" Traditional dispute tools can't ingest this unstructured, high-context communication data.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How Verdact Helps Agencies Win</h2>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>💬</div>
              <div className={styles.featureContent}>
                <h3>Comms Evidence (Slack & Email)</h3>
                <p>
                  Connect Slack to import approval threads directly into your evidence packet. Bring in email correspondence too (upload, paste, or screenshot) to help you build a stronger record of customer acceptance.
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>📄</div>
              <div className={styles.featureContent}>
                <h3>SOW & Scope Linking</h3>
                <p>
                  We help you construct a "Chain of Intent" that maps the original Statement of Work (SOW) directly to the delivered assets, making it far harder for a reviewer to side with a friendly-fraud claim.
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>⚖️</div>
              <div className={styles.featureContent}>
                <h3>You Choose How You Pay</h3>
                <p>
                  No forced cut of your recovered revenue. When you file, you pick the pricing that fits the dispute size, so a single high-ticket win doesn't disappear into someone else's success fee.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <div className={styles.ctaBox}>
          <h2 className={styles.ctaTitle}>Ready to protect your retainers?</h2>
          <p className={styles.ctaText}>
            Connect your Stripe account in minutes and build evidence that actually wins. Free during beta.
          </p>
          <Link href="/signup" className={styles.ctaButton}>
            Start free during beta
          </Link>
        </div>
      </main>
    </div>
  );
}
