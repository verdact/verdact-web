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
  { label: 'Contact Support', href: 'mailto:support@verdact.io' },
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
            <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
              <a
                href="https://www.linkedin.com/company/verdact/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Verdact on LinkedIn"
                style={{ color: 'var(--ink-2)', display: 'inline-flex' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://x.com/verdact_io"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Verdact on X"
                style={{ color: 'var(--ink-2)', display: 'inline-flex' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
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
