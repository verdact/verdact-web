import type { ReactNode } from 'react';
import { VerdactLogo } from './verdact-logo';
import { ThemeToggle } from './theme-toggle';

type AuthFrameProps = {
  children: ReactNode;
};

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="surface-paper min-h-screen text-ink">
      <AuthHeader />
      <div className="px-6 pb-16 pt-10 md:px-10 md:pt-14">{children}</div>
      <AuthFooter />
    </main>
  );
}

function AuthHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-6 py-5 md:px-10">
        <a
          href="/"
          className="flex w-fit items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
        >
          <VerdactLogo variant="lockup" priority className="h-9 w-auto" />
        </a>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <a
            href="/"
            className="label-mono rounded-sm px-1 py-0.5 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
          >
            ← Home
          </a>
        </div>
      </div>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-10">
        <p className="label-mono">
          Verdact · Stripe dispute defense
        </p>
        <div className="flex flex-wrap items-center gap-1 text-sm text-ink-mute">
          <a
            className="rounded-sm px-2 py-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
            href="/privacy"
          >
            Privacy
          </a>
          <a
            className="rounded-sm px-2 py-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
            href="/terms"
          >
            Terms
          </a>
          <a
            className="rounded-sm px-2 py-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
            href="mailto:admin@verdact.io"
          >
            admin@verdact.io
          </a>
        </div>
      </div>
    </footer>
  );
}
