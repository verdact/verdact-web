import Link from 'next/link';

const PRODUCT_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'What it costs', href: '/#plans' },
  { label: 'Account health', href: '/#health' },
  { label: 'Dispute rate checker', href: '/tools/vamp-check' },
  { label: 'Security', href: '/#control' },
];

const ACCOUNT_LINKS = [
  { label: 'Sign in', href: '/login' },
  { label: 'support@verdact.io', href: 'mailto:support@verdact.io' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
];

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-2)',
  marginBottom: 6,
};

const LINK_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 36,
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--ink-2)',
  textDecoration: 'none',
};

export function MarketingFooter() {
  return (
    <footer style={{ padding: '0 0 52px', background: 'var(--paper-2)' }}>
      {/* the rule returns with its gap bridged */}
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: 44 }}
        aria-hidden="true"
      >
        <i style={{ display: 'block', height: 1, background: 'var(--hairline)', flex: 1 }} />
        <b style={{ display: 'block', width: 36, height: 3, borderRadius: 2, background: 'var(--verdict)' }} />
        <i style={{ display: 'block', height: 1, background: 'var(--hairline)', flex: 1 }} />
      </div>

      <div className="wrap">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '28px 48px',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
                <path d="M19.52 6.35 L20.5 4.7" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" />
              </svg>
              Verdact
            </Link>
            <p style={{ marginTop: 8, fontSize: 14.5, color: 'var(--ink-2)' }}>
              Chargeback responses for service businesses on Stripe.
            </p>
          </div>

          {/* Nav columns */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <nav
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              aria-label="Product"
            >
              <span style={LABEL_STYLE}>Product</span>
              {PRODUCT_LINKS.map(({ label, href }) => (
                <Link key={href} href={href} style={LINK_STYLE}>
                  {label}
                </Link>
              ))}
            </nav>
            <nav
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              aria-label="Account and legal"
            >
              <span style={LABEL_STYLE}>Account</span>
              {ACCOUNT_LINKS.map(({ label, href }) =>
                href.startsWith('mailto:') ? (
                  <a key={href} href={href} style={LINK_STYLE}>
                    {label}
                  </a>
                ) : (
                  <Link key={href} href={href} style={LINK_STYLE}>
                    {label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>

        <p style={{ marginTop: 30, fontSize: 13.5, color: 'var(--ink-2)' }}>© 2026 Verdact</p>
      </div>
    </footer>
  );
}
