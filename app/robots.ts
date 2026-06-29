import type { MetadataRoute } from 'next';

const BASE = 'https://www.verdact.io';

// Allow crawl of the public marketing + tool surface; keep the authenticated app,
// admin, API, dev previews, and the reviewer path out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/admin',
        '/settings',
        '/account-health',
        '/onboarding',
        '/api/',
        '/dev/',
        '/reviewer/',
        '/evidence/',
        '/signin',
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
