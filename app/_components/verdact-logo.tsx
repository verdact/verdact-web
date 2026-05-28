type VerdactLogoProps = {
  variant?: 'lockup' | 'wordmark' | 'mark';
  priority?: boolean;
  className?: string;
};

// Inline SVG so the fills adapt to the active theme tokens (var(--ink),
// var(--surface), var(--accent), var(--trust)) and so the wordmark scales
// crisply with the height utility on `className` (h-7 / h-9 / h-10 ...).
//
// The wordmark sets its font-family from the theme display serif via the
// CSS custom property (--font-display, Fraunces). SVG <text> honours a
// font-family supplied through the `style` attribute, so referencing the
// variable picks up the next/font-hashed family name. Previously the family
// was hardcoded to "Instrument Sans", which is no longer loaded and silently
// fell back to a system sans.
const DISPLAY_FONT = 'var(--font-display)';

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
        viewBox="0 0 188 50"
        role="img"
        aria-labelledby="verdact-wordmark-title"
        className={className}
      >
        <title id="verdact-wordmark-title">Verdact</title>
        <text
          x="0"
          y="38"
          fill="var(--ink)"
          style={{ fontFamily: DISPLAY_FONT }}
          fontSize="42"
          fontWeight="600"
          letterSpacing="-0.5"
        >
          Verdact<tspan fill="var(--action)">.</tspan>
        </text>
      </svg>
    );
  }

  // Lockup: mark + serif wordmark on one baseline.
  return (
    <svg
      viewBox="0 0 264 64"
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
        y="46"
        fill="var(--ink)"
        style={{ fontFamily: DISPLAY_FONT }}
        fontSize="42"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        Verdact<tspan fill="var(--action)">.</tspan>
      </text>
    </svg>
  );
}
