# Verdact design tokens

Verdact is an AI-assisted Stripe dispute-response tool. This is a **tokens-only**
design system: CSS custom properties for color, type, spacing, radius, elevation,
and motion. There are no importable components — build UI with your own elements
and style them **exclusively** with these `var(--*)` tokens so every design is
on-brand. All tokens are defined in `tokens/verdact-tokens.css` (reachable through
`styles.css`); read it before styling — the names below are the vocabulary, that
file is the source of truth.

## The two-color law (do not break)
- **`--verdict`** (green `#0A5C44`) is the ONLY action/brand/verified color —
  primary buttons, links, success, focus. Pressed/darker: `--verdict-press`,
  `--verdict-deep`, `--verdict-abyss`; soft fill `--verdict-tint`; light accent
  `--mint`. Text on a verdict fill: `--on-verdict`.
- **`--gap`** (vermilion `#D14418`) is reserved for a genuine gap/missing/error
  state ONLY — never decorative. Text-safe `--gap-text`; soft fill `--gap-tint`.
- Do not introduce other hues. Status is always icon + text, never color alone.

## Color roles
- Surfaces (light→raised): `--paper`, `--paper-2`, `--panel`, `--panel-wash`,
  `--panel-2`, `--panel-3`; aliases `--surface`, `--surface-2`, `--surface-3`.
- Text: `--ink` (primary), `--ink-2` (secondary), `--ink-3` (muted).
- Lines: `--hairline` (default border), `--rule`, `--rule-strong`, `--edge-green`.
- Semantic aliases (prefer these for intent): `--action` (=verdict),
  `--danger` (=gap), `--watch` / `--watch-tint` (calm monitoring),
  `--focus-ring-color`.

## Theming
Light is the default (`:root`). Dark tokens re-scope automatically under
`@media (prefers-color-scheme: dark)` and via `[data-theme="dark"]` on an
ancestor — the SAME token names resolve to dark values, so build with the role
tokens above and both themes work for free. Never hardcode a hex; use the token.

## Typography
One family: **Schibsted Grotesk**, via `--font-body` / `--font-display` (both
resolve to `var(--font-sans)` → Schibsted). `--font-mono` for labels/eyebrows.
The host app loads Schibsted Grotesk; if unavailable, it falls back to system-ui.

## Spacing, radius, elevation, motion
- Spacing scale (use for padding/gap/margins): `--space-1` 4px, `-2` 8, `-3` 12,
  `-4` 16, `-5` 20, `-6` 24, `-8` 32, `-10` 40, `-12` 48, `-14` 56, `-16` 64,
  `-20` 80, `-24` 96, `-32` 128.
- Radius: `--radius-chip` 5, `--radius-input` 8, `--radius-card` 12,
  `--radius-md` 14, `--radius-lg` 16, `--radius-xl` 18, `--radius-pill` 9999.
- Elevation: `--elev-1` (subtle), `--elev-2` (card), `--elev-pop` (overlay);
  aliases `--shadow-elev-1/2`, `--shadow-record`.
- Motion: durations `--duration-fast` 150ms, `--duration-normal` 250ms,
  `--duration-slow` 400ms (aliases `--d-fast`, `--d-normal`); easing
  `--ease-out`, `--ease-in-out`, `--ease-spring`.
- Focus: `outline: var(--focus-ring-width) solid var(--focus-ring-color)` with
  `outline-offset: var(--focus-ring-offset)`.

## Idiomatic snippet
```css
.btn-primary {
  background: var(--verdict);
  color: var(--on-verdict);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-pill);
  box-shadow: var(--elev-1);
  transition: background var(--d-fast) var(--ease-out);
}
.btn-primary:hover { background: var(--verdict-press); }
.btn-primary:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```
