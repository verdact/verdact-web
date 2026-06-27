// Root 404. Friendly, low-blame, and gives one clear way back. Light marketing
// surface (no app shell, so NOT tagged data-app-surface — it stays light like
// the rest of the public site), matching the calm tone of the rest of the site.
//
// Redesign 2026-06-27: renders the shared AppErrorCard so the 404 shares the
// calm reassurance language of the app's error boundaries. "Go home" is the one
// primary action; "Open dashboard" is the ghost secondary. Copy unchanged.
//
// Stays a SERVER component so it can export `metadata` (the page title). The
// primary action is a plain link via `primaryHref` instead of a client onClick.
import type { Metadata } from 'next';
import { AppErrorCard } from './_components/ui/app-error-card';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-12 text-ink">
      <AppErrorCard
        eyebrow="Error 404"
        title="We could not find that page"
        primaryHref="/"
        primaryLabel="Go home"
        secondaryHref="/dashboard"
        secondaryLabel="Open dashboard"
        body="The link may be out of date or the page may have moved. Let us point you somewhere useful."
      />
    </main>
  );
}
