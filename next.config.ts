import type { NextConfig } from "next";

// --- Security headers (Content-Security-Policy + supporting headers) ----------
//
// Design choice: allowlist CSP delivered via `headers()` (NOT a per-request
// nonce in proxy.ts). A nonce-based strict CSP would force every page to
// dynamic rendering (losing static optimization + CDN caching on the marketing
// site) AND a strict `style-src` without 'unsafe-inline' would block React
// inline `style={{}}` attributes and framer-motion's injected styles — which
// the app uses throughout (gauges, meters, animations). So we use 'unsafe-inline'
// for script/style and keep real value through a tight connect-src/img-src/
// frame-src allowlist + the supporting header set. An injected XSS payload still
// cannot exfiltrate the (non-httpOnly) Supabase auth cookie to an attacker
// origin because connect-src is locked to self + the Supabase project + PostHog.
//
// connect-src/img-src are derived from NEXT_PUBLIC_SUPABASE_URL at build time so
// dev and prod each pin their own exact project origin (no wildcard). If the env
// is absent (e.g. a misconfigured preview), the Supabase origins are simply
// omitted and the directive falls back to 'self' rather than crashing the build.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHttp = supabaseUrl ? supabaseUrl.replace(/\/+$/, "") : "";
const supabaseWss = supabaseHttp.replace(/^https:/, "wss:");

// PostHog US Cloud is reverse-proxied through /ingest (→ 'self'), but list the
// real origins defensively in case the JS bootstrap reaches them directly.
const POSTHOG_ORIGINS = "https://us.i.posthog.com https://us-assets.i.posthog.com";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next.js injects inline bootstrap scripts (no nonce in static mode) + PostHog.
  // 'unsafe-eval' is intentionally NOT included (not needed in production).
  `script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com`,
  // React inline styles + framer-motion + Next inline <style> require 'unsafe-inline'.
  "style-src 'self' 'unsafe-inline'",
  // Self-hosted fonts (next/font); data: for any inline font.
  "font-src 'self' data:",
  // Evidence images are served from the Supabase project (signed URLs); blob:/data:
  // for upload previews + inline SVGs.
  `img-src 'self' data: blob: ${supabaseHttp} ${POSTHOG_ORIGINS}`.trim(),
  // Supabase REST/Auth/Realtime (https + wss) + PostHog ingest (also via 'self').
  `connect-src 'self' ${supabaseHttp} ${supabaseWss} ${POSTHOG_ORIGINS}`.trim(),
  // Stripe is integrated server-side; allow its frames defensively (Elements/3DS).
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  // PostHog session replay (rrweb) may spin up blob workers.
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
]
  // Collapse any double spaces produced by an empty env-derived origin.
  .map((d) => d.replace(/\s{2,}/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Reverse-proxy PostHog through our own origin (/ingest) so analytics and
  // session-replay assets are not blocked by ad-blockers. US Cloud endpoints.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog recommends this so the proxied paths are not 308-redirected.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
