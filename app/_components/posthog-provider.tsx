'use client';

import { useEffect } from 'react';
import posthog, { type CaptureResult } from 'posthog-js';
import { PostHogProvider as PHProvider } from '@posthog/react';
import { createClient } from '@/lib/supabase/client';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Routes that render merchant PII (customer names, dispute detail, evidence).
const APP_ROUTE = /^\/(dashboard|settings|onboarding)(\/|$)/;
// Routes whose query strings can carry tokens / one-time codes / emails.
const AUTH_ROUTE = /^\/(login|signup|forgot-password|reset-password|auth)(\/|$)/;

/**
 * Privacy guard applied to every outgoing event (on top of session-replay text
 * masking). Two jobs:
 *   1. On auth routes, strip query strings from captured URLs so recovery
 *      tokens / emails never reach PostHog.
 *   2. On authed app routes, drop autocaptured element text/markup so a clicked
 *      element bearing a customer name cannot leak as an event property.
 */
function sanitize(event: CaptureResult | null): CaptureResult | null {
  if (!event?.properties || typeof window === 'undefined') return event;
  const path = window.location.pathname;
  const props = event.properties;

  if (AUTH_ROUTE.test(path)) {
    for (const key of ['$current_url', '$referrer', '$pathname']) {
      const value = props[key];
      if (typeof value === 'string') props[key] = value.split('?')[0];
    }
  }

  if (APP_ROUTE.test(path)) {
    delete props.$el_text;
    if (typeof props.$elements_chain === 'string') props.$elements_chain = '';
    if (Array.isArray(props.$elements)) {
      props.$elements = props.$elements.map((el: unknown) => {
        if (el && typeof el === 'object') {
          const next = { ...(el as Record<string, unknown>) };
          delete next.$el_text;
          delete next.text;
          return next;
        }
        return el;
      });
    }
  }

  return event;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    posthog.init(POSTHOG_KEY, {
      // Reverse-proxied through next.config rewrites (/ingest) to dodge
      // ad-blockers; ui_host keeps "open in PostHog" links pointing at the app.
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      // Auto-capture pageviews on first load and on App Router history changes.
      capture_pageview: 'history_change',
      capture_pageleave: true,
      // Only create person profiles for identified (logged-in) merchants.
      person_profiles: 'identified_only',
      autocapture: true,
      // Replay records in production/preview only, never local dev.
      disable_session_recording: process.env.NODE_ENV !== 'production',
      session_recording: {
        // Private by default: mask every input and all text content. Evidence,
        // customer names, and dispute detail are never legible in a recording.
        maskAllInputs: true,
        maskTextSelector: '*',
        maskInputOptions: { password: true },
      },
      before_send: sanitize,
    });

    // Tie logged-in merchants to a person profile by their pseudonymous Supabase
    // UUID — never email or name. Identify on load + sign-in; reset on sign-out
    // so a shared browser never mixes two merchants. Anonymous visitors are
    // never identified (person_profiles: 'identified_only').
    const supabase = createClient();
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        posthog.identify(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
