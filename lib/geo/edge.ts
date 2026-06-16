// ─────────────────────────────────────────────────────────────────────────────
// Coarse request geo from Vercel edge headers.
//
// On Vercel, the inbound request carries x-vercel-ip-country (ISO-3166-1
// alpha-2) and x-vercel-ip-country-region (subdivision). We capture only
// COUNTRY + REGION (never the raw IP) so the founder console can show a
// traffic-region read without re-introducing PII the codebase deliberately
// hashes away. Off Vercel (local dev, other hosts) these headers are absent and
// this returns null, so callers degrade to "no region" rather than failing.
//
// Pure read of a Headers object — safe to call from any route handler or server
// action. NEVER let a geo read block or break the host request (signup/lead
// capture): treat the result as optional analytics.
// ─────────────────────────────────────────────────────────────────────────────

export type EdgeGeo = {
  country: string | null;
  region: string | null;
  source: string;
};

const COUNTRY_HEADER = 'x-vercel-ip-country';
const REGION_HEADER = 'x-vercel-ip-country-region';

function clean(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 16) return null;
  return trimmed.toUpperCase();
}

/**
 * Read coarse country/region from Vercel edge headers. Returns null when no
 * country is present (off-Vercel or stripped), so callers can omit geo entirely.
 */
export function readEdgeGeo(headers: Headers): EdgeGeo | null {
  const country = clean(headers.get(COUNTRY_HEADER));
  if (!country) return null;
  return {
    country,
    region: clean(headers.get(REGION_HEADER)),
    source: 'vercel-edge',
  };
}

/**
 * Geo columns for an insert/update payload, or an empty object when no geo is
 * available. Spread this into a Supabase insert. SAFETY: only spread these into
 * a SEPARATE best-effort write, or guard the columns' existence — they are added
 * by migration 20260616060000 (unapplied), so a primary signup insert must not
 * depend on them.
 */
export function geoColumns(geo: EdgeGeo | null): {
  geo_country?: string;
  geo_region?: string;
  geo_source?: string;
} {
  if (!geo || !geo.country) return {};
  return {
    geo_country: geo.country,
    ...(geo.region ? { geo_region: geo.region } : {}),
    geo_source: geo.source,
  };
}
