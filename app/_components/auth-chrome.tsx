import type { ReactNode } from 'react';
import Link from 'next/link';
import { VerdactLogo } from './verdact-logo';

// Auth shell per marketing-signin-signup-wireframe-v1: lockup links home,
// single "Home" escape on the right, no marketing nav (auth reduces choices).
// Pages own their column layout (.auth-split / .auth-center) inside children.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-hd">
        <Link href="/" aria-label="Verdact home" className="auth-hd-logo">
          <VerdactLogo variant="lockup" className="h-7 w-auto" />
        </Link>
        <Link href="/" className="auth-home">
          Home
        </Link>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-ft">
        <p>© 2026 Verdact · Chargeback responses for service businesses on Stripe.</p>
        <nav className="auth-ft-links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:support@verdact.io">support@verdact.io</a>
        </nav>
      </footer>
    </div>
  );
}
