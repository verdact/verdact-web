import type { MetadataRoute } from 'next';
import { REASON_CODE_DETAILS } from '@/lib/audit/reason-code-details';
import { COMPETITOR_DETAILS } from '@/lib/audit/competitor-details';

// Public, indexable surface only. Auth-gated app routes (/dashboard, /settings,
// /account-health, /onboarding), the admin console, API, /dev previews, and the
// reviewer path are intentionally excluded (and disallowed in robots.ts).
const BASE = 'https://www.verdact.io';
const lastModified = new Date('2026-07-01');

export default function sitemap(): MetadataRoute.Sitemap {
  const reasonCodeEntries = REASON_CODE_DETAILS.map((detail) => ({
    url: `${BASE}/dispute-codes/${detail.network}/${detail.code}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const competitorEntries = COMPETITOR_DETAILS.map((comp) => ({
    url: `${BASE}/alternatives/${comp.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    { url: `${BASE}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/dispute-codes`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/alternatives`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    // The two no-login tools are the primary acquisition + capture surfaces.
    { url: `${BASE}/audit`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/tools/vamp-check`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/login`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    ...reasonCodeEntries,
    ...competitorEntries,
  ];
}
