import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
};

// Root 404. Friendly, low-blame, and gives one clear way back. Light marketing
// surface (no app shell), matching the calm tone of the rest of the site.
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-16 text-ink"
    >
      <div className="w-full max-w-md text-center">
        <p className="label-mono mb-4">Error 404</p>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-ink">
          We could not find that page
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          The link may be out of date or the page may have moved. Let us point you
          somewhere useful.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn btn--primary">
            Go home
          </Link>
          <Link href="/dashboard" className="btn btn--ghost">
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
