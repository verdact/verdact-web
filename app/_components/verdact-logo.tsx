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
        viewBox="0 0 26 26"
        fill="none"
        role="img"
        aria-labelledby="verdact-mark-title"
        className={className}
      >
        <title id="verdact-mark-title">Verdact</title>
        <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M19.52 6.35 L20.5 4.7" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" />
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

  // Lockup: mark + wordmark on one baseline.
  return (
    <svg
      viewBox="0 0 188 26"
      fill="none"
      role="img"
      aria-labelledby="verdact-lockup-title"
      className={className}
    >
      <title id="verdact-lockup-title">Verdact</title>
      <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M19.52 6.35 L20.5 4.7" stroke="var(--verdict)" strokeWidth="4.4" strokeLinecap="square" />
      <text
        x="32"
        y="20"
        fill="var(--ink)"
        style={{ fontFamily: DISPLAY_FONT }}
        fontSize="20"
        fontWeight="700"
        letterSpacing="-0.3"
      >
        Verdact
      </text>
    </svg>
  );
}
