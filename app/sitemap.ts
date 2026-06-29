import type { MetadataRoute } from 'next';

// Public, indexable surface only. Auth-gated app routes (/dashboard, /settings,
// /account-health, /onboarding), the admin console, API, /dev previews, and the
// reviewer path are intentionally excluded (and disallowed in robots.ts).
const BASE = 'https://www.verdact.io';
const lastModified = new Date('2026-06-28');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    // The two no-login tools are the primary acquisition + capture surfaces.
    { url: `${BASE}/audit`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/tools/vamp-check`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/login`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
