// Verdact tokens-only design-system build (off-script).
//
// Why off-script: verdact-web is a Next.js APP, not a packaged component
// library — no dist entry, tokens live in a Tailwind-v4 globals.css, components
// are CSS-modules + server-coupled. The design-sync converter can't ingest that,
// so this script hand-produces the documented ds-bundle layout for a tokens-only
// design system. See NOTES.md.
//
// Run from the repo root (verdact-web/):  node .design-sync/build.mjs
// Then validate:  node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check
//
// Output ./ds-bundle is upload-ready once DesignSync is authorized
// (/design-login in an interactive terminal, or upload via claude.ai/design).

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DS = ROOT + '/.design-sync';
const OUT = ROOT + '/ds-bundle';

// ── 1. Extract clean tokens from globals.css (:root + dark block) ──────────────
const css = readFileSync(ROOT + '/app/globals.css', 'utf8');
function ruleBody(openRe) {
  const m = css.match(openRe);
  if (!m) throw new Error('selector not found: ' + openRe);
  let i = css.indexOf('{', m.index), depth = 0, start = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i);
  }
  throw new Error('unbalanced braces');
}
const decls = (body, indent = '  ') => body.split('\n').map(l => l.trim())
  .filter(l => /^(--[\w-]+\s*:|color-scheme\s*:)/.test(l))
  .map(l => indent + (l.endsWith(';') ? l : l + ';')).join('\n');
const light = decls(ruleBody(/:root\s*\{/));
const dark = decls(ruleBody(/html\[data-theme="dark"\][^{]*\{/));
const tokensCss = `/*
 * Verdact — Design Tokens
 * Extracted from verdact-web/app/globals.css (:root + dark-mode token blocks).
 * Two-color law: --verdict (green, action/verified) + --gap (vermilion, missing).
 * Dark tokens re-scoped to :root here (OS preference + [data-theme="dark"]) so
 * standalone designs can use both themes. In the product they scope to .app-shell.
 */

:root {
${light}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${dark.replace(/^ {2}/gm, '    ')}
  }
}

[data-theme="dark"] {
${dark}
}
`;
writeFileSync(DS + '/verdact-tokens.css', tokensCss);

// ── 2. Assemble ds-bundle ─────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + '/tokens', { recursive: true });
mkdirSync(OUT + '/components/Foundations/Tokens', { recursive: true });
writeFileSync(OUT + '/tokens/verdact-tokens.css', tokensCss);
writeFileSync(OUT + '/styles.css',
  '/* Verdact design tokens — the import closure designs built with this system receive. */\n@import "./tokens/verdact-tokens.css";\n');
writeFileSync(OUT + '/_ds_bundle.js',
  '/* @ds-bundle: {"namespace":"Verdact","components":[],"sourceHashes":{},"inlinedExternals":[],"builtBy":"cc-design-sync"} */\n(function(){window.Verdact=window.Verdact||{};})();\n');
writeFileSync(OUT + '/_ds_needs_recompile', '{"by":"design-sync-cli"}');
writeFileSync(OUT + '/.ds-build-meta.json',
  JSON.stringify({ namespace: 'Verdact', source: 'verdact@0.0.0', shape: 'package', provider: null, componentCount: 1, skippedStoryIds: [], runtimeFontPrefixes: [] }));
copyFileSync(DS + '/previews/Tokens.html', OUT + '/components/Foundations/Tokens/Tokens.html');

// README = conventions header + short footer
const footer = `

---

## What ships in this design system

Tokens-only export (no importable components):

- \`tokens/verdact-tokens.css\` — all design tokens (light \`:root\` + dark).
- \`styles.css\` — the import closure designs receive.
- \`_ds_bundle.js\` — empty namespace (\`window.Verdact\`); no components by design.
- \`components/Foundations/Tokens/Tokens.html\` — a visual token reference card.

Build UI with your own elements and style them with the \`var(--*)\` tokens.
`;
writeFileSync(OUT + '/README.md', readFileSync(DS + '/conventions.md', 'utf8') + footer);

const n = (light.match(/--/g) || []).length, d = (dark.match(/--/g) || []).length;
console.log(`ds-bundle assembled — ${n} light tokens, ${d} dark overrides, 1 showcase card`);
