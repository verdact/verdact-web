import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../use-cases.module.css';

export const metadata: Metadata = {
  title: 'Stripe Chargeback Defense for SaaS Companies | Verdact',
  description:
    'SaaS businesses lose millions to Visa 13.1 (Services Not Rendered) disputes. Verdact’s Chain of Intent architecture helps you build the right evidence to win SaaS chargebacks on Stripe.',
  alternates: { canonical: 'https://www.verdact.io/use-cases/saas' },
};

const PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Stripe Chargeback Defense for SaaS',
  description: 'How Verdact helps B2B and B2C SaaS companies win Stripe disputes.',
};

export default function SaaSUseCasePage() {
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
        <h1 className={styles.title}>Stripe Chargeback Defense for SaaS</h1>
        <p className={styles.subtitle}>
          Stop losing "Services Not Rendered" disputes because your automated chargeback tool submitted raw database logs instead of proof of usage.
        </p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The SaaS Chargeback Problem</h2>
          <p className={styles.paragraph}>
            SaaS businesses face a unique challenge: unlike physical goods, you can't provide a FedEx tracking number when a customer files a chargeback. When a subscriber forgets they didn't cancel and files a Visa 13.1 (Services Not Rendered) dispute, the burden of proof is on you.
          </p>
          <p className={styles.paragraph}>
            Standard chargeback tools (and native Stripe integrations) simply dump your raw server logs or generic terms of service into a PDF. This isn't enough. Banks don't understand JSON logs. They want clear, human-readable proof that the customer actively used the software.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How Verdact Helps SaaS Win</h2>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>🔗</div>
              <div className={styles.featureContent}>
                <h3>The Chain of Intent</h3>
                <p>
                  Verdact guides you to build a 4-layer evidence packet: Authorization, Identity, Agreement, and Delivery. We help you structure your app's metadata into a compelling narrative that banks understand.
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>📊</div>
              <div className={styles.featureContent}>
                <h3>VAMP Threshold Monitoring</h3>
                <p>
                  SaaS companies with high chargeback volumes are at risk of being placed in the Visa/Mastercard monitoring programs (VAMP). Verdact tracks your standing dispute rate against the strict 0.75% network line.
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <div className={styles.featureIcon}>🔒</div>
              <div className={styles.featureContent}>
                <h3>No Auto-Filing (Strict Approval Lock)</h3>
                <p>
                  SaaS disputes require nuance. Verdact never auto-submits on your behalf. You review every piece of evidence in our Generative UI Workbench before it goes to Stripe.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <div className={styles.ctaBox}>
          <h2 className={styles.ctaTitle}>Ready to protect your MRR?</h2>
          <p className={styles.ctaText}>
            Connect your Stripe account in minutes and start building your evidence. Free during beta.
          </p>
          <Link href="/signup" className={styles.ctaButton}>
            Start free during beta
          </Link>
        </div>
      </main>
    </div>
  );
}
