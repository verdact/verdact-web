import type { ReactNode } from 'react';
import { VerdactLogo } from './verdact-logo';

type AuthFrameProps = {
  children: ReactNode;
};

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-[440px] casefile bg-panel mb-8">
        <div className="casefile__top" />
        <div className="casefile__head">
          <VerdactLogo variant="lockup" priority className="h-6 w-auto text-ink" />
          <a
            href="/"
            className="text-sm font-medium text-ink-mute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm px-1 transition-colors"
          >
            ← Back
          </a>
        </div>
        <div className="p-8 sm:p-10">
          {children}
        </div>
      </div>
      <AuthFooter />
    </main>
  );
}

function AuthFooter() {
  return (
    <footer className="w-full max-w-[440px] flex items-center justify-between text-sm text-ink-mute">
      <p className="t-meta-mono">© {new Date().getFullYear()} Verdact</p>
      <div className="flex items-center gap-4 font-medium">
        <a className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm" href="/privacy">Privacy</a>
        <a className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdict rounded-sm" href="/terms">Terms</a>
      </div>
    </footer>
  );
}
