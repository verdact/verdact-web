# design-sync notes — Verdact

## Shape: off-script, tokens-only

`verdact-web` is a **Next.js application**, not a packaged component library, so the
design-sync converter cannot ingest it:

- No `dist/` entry / package `exports` — the converter's package shape needs a built
  entry (or `node_modules/<pkg>`); this repo has neither (`node_modules/verdact` ENOENT).
- Tokens live in `app/globals.css` which starts `@import "tailwindcss";` (Tailwind v4)
  — not a shippable stylesheet; the token values are clean `:root` custom properties.
- Components are CSS-modules + server-coupled (`next/link`, server actions,
  `verifySession()`, Supabase) — not standalone-bundlable for the design agent runtime.

Decision (Rishi, 2026-07-01): **tokens-only sync.** Components deferred / out of scope.

## How it's built (reproducible, no converter)

`node .design-sync/build.mjs` (run from `verdact-web/`) hand-produces the documented
ds-bundle layout:
1. Extracts `:root` + `html[data-theme="dark"]` custom-property blocks from `app/globals.css`
   → `.design-sync/verdact-tokens.css` and `ds-bundle/tokens/verdact-tokens.css`.
2. Writes `styles.css` (@imports the tokens), an empty-namespace `_ds_bundle.js` with the
   `@ds-bundle` header, `.ds-build-meta.json`, `_ds_needs_recompile`, and `README.md`
   (= `conventions.md` + footer).
3. Copies the visual token reference card `.design-sync/previews/Tokens.html` into
   `components/Foundations/Tokens/`.

Validate: `node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check` → exits 0
(2 non-blocking warns: `_ds_sync.json` absent = off-script, and render-check skipped —
the one card was visually verified by hand instead).

Dark tokens are **re-scoped to `:root`** in the export (OS preference + `[data-theme="dark"]`)
so standalone designs get both themes; in the product they scope to `.app-shell`.

## Upload — BLOCKED on authorization (as of 2026-07-01)

`DesignSync` returned: *"needs design-system authorization, but /design-login requires an
interactive terminal and is not available in this environment."* So the project was NOT
created and nothing was uploaded. To finish:

1. In an interactive `claude` terminal, run `/design-login` (or upload the `ds-bundle/`
   contents via claude.ai/design directly).
2. Re-run `/design-sync` — the build above is deterministic; it will rebuild the same
   `ds-bundle/`, create a new design-system project, and upload.
3. After upload, record the new `projectId` in `.design-sync/config.json`.

## Re-sync risks / watch-list

- **Tokens drift**: `verdact-tokens.css` is generated from `app/globals.css`. If token
  blocks there change, re-run `build.mjs`. The extraction is brace-matched on `:root {`
  and `html[data-theme="dark"] ...{` — if those selectors are renamed, fix `build.mjs`.
- **Font**: no `@font-face` is shipped. The showcase card's type renders in system-ui
  fallback (Schibsted Grotesk is host-loaded via next/font in the app). Acceptable for a
  tokens export; if a future run wants true Schibsted in the card, add an `@font-face`.
- **No `_ds_sync.json` anchor**: every re-sync re-verifies from scratch (fine — tokens-only
  has nothing to grade; the one card is eyeballed).
- **Components**: intentionally excluded. Revisit only if the DS is extracted into a real
  bundlable component-library package.
