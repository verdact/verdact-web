import type { NextConfig } from "next";

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
};

export default nextConfig;
