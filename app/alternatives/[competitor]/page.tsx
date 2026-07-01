import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompetitorDetail, COMPETITOR_DETAILS } from '@/lib/audit/competitor-details';
import styles from './detail.module.css';

interface Props {
  params: Promise<{
    competitor: string;
  }>;
}

export async function generateStaticParams() {
  return COMPETITOR_DETAILS.map((comp) => ({
    competitor: comp.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor } = await params;
  const detail = getCompetitorDetail(competitor);
  if (!detail) return {};

  const title = `Verdact vs ${detail.name}: Best Stripe Dispute Alternative`;
  const description = `Compare Verdact and ${detail.name}. Learn why B2B SaaS and service agencies choose Verdact for flat-fee pricing and merchant-controlled chargeback defense.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.verdact.io/alternatives/${competitor}`,
    },
  };
}

export default async function competitorDetailPage({ params }: Props) {
  const { competitor } = await params;
  const detail = getCompetitorDetail(competitor);
  if (!detail) {
    notFound();
  }

  const SCHEMA = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Verdact',
    description: 'Flat-fee, merchant-controlled Stripe dispute resolution and chargeback defense platform.',
    brand: {
      '@type': 'Brand',
      name: 'Verdact',
    },
    offers: {
      '@type': 'Offer',
      price: '49',
      priceCurrency: 'USD',
      priceValidUntil: '2027-01-01',
      url: 'https://www.verdact.io/',
    },
  };

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <div className={styles.breadcrumbs}>
        <Link href="/alternatives">Alternatives</Link>
        <span className={styles.separator}>/</span>
        <span className={styles.activeBreadcrumb}>Verdact vs {detail.name}</span>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Verdact vs {detail.name}</h1>
        <p className={styles.subtitle}>
          Compare pricing, integrations, filing workflows, and find the best Stripe dispute platform for your business model.
        </p>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>The Key Difference</h2>
          <p className={styles.paragraph}>{detail.verdactAdvantage}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Side-by-Side Comparison</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Feature / Capabilities</th>
                  <th className={styles.th}>{detail.name}</th>
                  <th className={styles.thHighlight}>Verdact</th>
                </tr>
              </thead>
              <tbody>
                {detail.featureComparison.map((row, idx) => (
                  <tr key={idx} className={styles.tr}>
                    <td className={styles.tdFeature}>{row.feature}</td>
                    <td className={styles.tdCompetitor}>
                      {typeof row.competitor === 'boolean' ? (
                        row.competitor ? '✓ Yes' : '✕ No'
                      ) : (
                        row.competitor
                      )}
                    </td>
                    <td className={styles.tdHighlight}>
                      {typeof row.verdact === 'boolean' ? (
                        row.verdact ? '✓ Yes' : '✕ No'
                      ) : (
                        row.verdact
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>Why SaaS Founders Choose Verdact</h2>
          <p className={styles.paragraph}>
            Unlike generic chargeback tools that charge a percentage of your won revenue, Verdact believes you should keep the money you earn. We charge a flat monthly fee for full monitoring and dynamic evidence compilation, ensuring your cost is predictable as you scale.
          </p>
          <p className={styles.paragraph}>
            Furthermore, automated "autopilot" tools often submit weak, template-based evidence to the card networks. For high-context service and software disputes, a single copy-paste response is not enough. Verdact constructs a structured <em>Chain of Intent</em> evidence record matching your exact deliverables, access logs, and communications.
          </p>
        </section>

        <section className={styles.ctaBox}>
          <h3 className={styles.ctaTitle}>Audit your Stripe dispute risk for free</h3>
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
        <Link href="/alternatives" className={styles.footerLink}>
          ← Back to Alternatives
        </Link>
      </footer>
    </div>
  );
}
