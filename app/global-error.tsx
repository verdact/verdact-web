'use client';

// Last-resort boundary for errors thrown in the root layout itself. When this
// renders it has replaced the root layout, so it must ship its own <html> and
// <body>, and it cannot assume the layout's font variable or theme attribute
// were applied. We lean on the :root tokens from globals.css with literal
// fallbacks so the surface still reads as Verdact even in the worst case, and
// we never print a stack trace, only the correlatable digest.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1.5rem',
          background: 'var(--paper, #ffffff)',
          color: 'var(--ink, #16241d)',
          fontFamily:
            'var(--font-sans, system-ui), system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <main style={{ width: '100%', maxWidth: '28rem' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: '0.6875rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 500,
              color: 'var(--ink-mute, #6b7c74)',
              margin: '0 0 1rem',
            }}
          >
            Something interrupted
          </p>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Verdact ran into a problem
          </h1>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: 'var(--ink-soft, #4a5a52)',
            }}
          >
            Something stopped the app from loading. Your work is safe. Try again, and
            if it keeps happening, reach us at{' '}
            <a
              href="mailto:support@verdact.io"
              style={{ color: 'var(--action, #1f8f5f)', textUnderlineOffset: '4px' }}
            >
              support@verdact.io
            </a>
            .
          </p>

          {error.digest ? (
            <p
              style={{
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                fontSize: '0.6875rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-mute, #6b7c74)',
                marginTop: '1.25rem',
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: '1.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                minHeight: 44,
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-input, 8px)',
                border: '1px solid transparent',
                background: 'var(--action-solid, #1f8f5f)',
                color: 'var(--paper, #ffffff)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-input, 8px)',
                border: '1px solid var(--rule, #d8e0db)',
                background: 'transparent',
                color: 'var(--ink-2, #2c3a33)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
