import type { Metadata } from 'next';
import Link from 'next/link';
import { REASON_CODE_DETAILS } from '@/lib/audit/reason-code-details';
import styles from './dispute-codes.module.css';

export const metadata: Metadata = {
  title: 'Stripe Dispute & Chargeback Reason Codes Reference | Verdact',
  description:
    'Complete guide to Visa, Mastercard, and American Express dispute reason codes on Stripe. Learn what they mean, how to gather evidence, and how to defend them.',
  alternates: { canonical: 'https://www.verdact.io/dispute-codes' },
  openGraph: {
    title: 'Stripe Dispute & Chargeback Reason Codes Reference | Verdact',
    description: 'Complete guide to Visa, Mastercard, and American Express dispute reason codes on Stripe.',
    url: 'https://www.verdact.io/dispute-codes',
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

export default function DisputeCodesIndex() {
  // Group details by network
  const visaCodes = REASON_CODE_DETAILS.filter((c) => c.network === 'visa');
  const mcCodes = REASON_CODE_DETAILS.filter((c) => c.network === 'mastercard');
  const amexCodes = REASON_CODE_DETAILS.filter((c) => c.network === 'amex');

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
        <h1 className={styles.title}>Stripe Dispute & Chargeback Reason Codes</h1>
        <p className={styles.subtitle}>
          When a Stripe dispute is filed, it is mapped to a card network reason code. Use this reference directory to understand what each card network requires to win on representment.
        </p>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.networkHeading}>Visa Reason Codes</h2>
          <div className={styles.grid}>
            {visaCodes.map((item) => (
              <div key={item.code} className={styles.card}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
                <div className={styles.cardFooter}>
                  <Link href={`/dispute-codes/visa/${item.code}`} className={styles.link}>
                    Read Defending Guide →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.networkHeading}>Mastercard Reason Codes</h2>
          <div className={styles.grid}>
            {mcCodes.map((item) => (
              <div key={item.code} className={styles.card}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
                <div className={styles.cardFooter}>
                  <Link href={`/dispute-codes/mastercard/${item.code}`} className={styles.link}>
                    Read Defending Guide →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.networkHeading}>American Express Reason Codes</h2>
          <div className={styles.grid}>
            {amexCodes.map((item) => (
              <div key={item.code} className={styles.card}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
                <div className={styles.cardFooter}>
                  <Link href={`/dispute-codes/amex/${item.code}`} className={styles.link}>
                    Read Defending Guide →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          Need to audit your standing chargebacks? Use our free no-signup{' '}
          <Link href="/audit" className={styles.footerLink}>
            Dispute Audit Tool
          </Link>{' '}
          or calculate your VAMP rate on the{' '}
          <Link href="/tools/vamp-check" className={styles.footerLink}>
            VAMP Threshold Checker
          </Link>.
        </p>
      </footer>
    </div>
  );
}
