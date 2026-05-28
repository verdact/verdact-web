type VerdactLogoProps = {
  variant?: 'lockup' | 'wordmark' | 'mark';
  priority?: boolean;
  className?: string;
};

// Inline SVG so the dark fills can adapt to the system color scheme.
// Mark background and wordmark text use var(--ink). The white stroke inside
// the V mark uses var(--surface) so it always contrasts against the mark fill.

export function VerdactLogo({ variant = 'lockup', className }: VerdactLogoProps) {
  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 56 56"
        role="img"
        aria-labelledby="verdact-mark-title"
        className={className}
      >
        <title id="verdact-mark-title">Verdact</title>
        <rect x="4" y="4" width="48" height="48" rx="8" fill="var(--ink)" />
        <path d="M17 15 29 44" fill="none" stroke="var(--surface)" strokeWidth="6.5" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M43 15 29 44" fill="none" stroke="var(--accent)" strokeWidth="6.5" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M19 17h12M21 23h10" fill="none" stroke="var(--ink-faint)" strokeWidth="1.7" strokeLinecap="square" />
        <path d="M34 38h8" fill="none" stroke="var(--trust)" strokeWidth="2.5" strokeLinecap="square" />
      </svg>
    );
  }

  if (variant === 'wordmark') {
    return (
      <svg
        viewBox="0 0 200 50"
        role="img"
        aria-labelledby="verdact-wordmark-title"
        className={className}
      >
        <title id="verdact-wordmark-title">Verdact</title>
        <text
          x="0"
          y="38"
          fill="var(--ink)"
          fontFamily="Instrument Sans, Avenir Next, Segoe UI, sans-serif"
          fontSize="42"
          fontWeight="760"
        >
          Verdact
        </text>
        <path d="M130 44h50" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 276 64"
      role="img"
      aria-labelledby="verdact-lockup-title"
      className={className}
    >
      <title id="verdact-lockup-title">Verdact</title>
      <rect x="4" y="8" width="48" height="48" rx="8" fill="var(--ink)" />
      <path d="M17 19 29 48" fill="none" stroke="var(--surface)" strokeWidth="6.5" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M43 19 29 48" fill="none" stroke="var(--accent)" strokeWidth="6.5" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M19 21h12M21 27h10" fill="none" stroke="var(--ink-faint)" strokeWidth="1.7" strokeLinecap="square" />
      <path d="M34 42h8" fill="none" stroke="var(--trust)" strokeWidth="2.5" strokeLinecap="square" />
      <text
        x="68"
        y="44"
        fill="var(--ink)"
        fontFamily="Instrument Sans, Avenir Next, Segoe UI, sans-serif"
        fontSize="42"
        fontWeight="760"
      >
        Verdact
      </text>
      <path d="M195 49h50" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}
