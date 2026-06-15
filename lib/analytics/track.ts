import posthog from 'posthog-js';

/**
 * Safe client-side event capture.
 *
 * No-ops when PostHog is not configured (no `NEXT_PUBLIC_POSTHOG_KEY`), so local
 * dev and preview builds without analytics keys stay silent — no console noise,
 * no buffered events. The PostHogProvider performs the actual `posthog.init`;
 * this helper just guards every call site.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
