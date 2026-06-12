import type { ReactNode } from 'react';
import Link from 'next/link';
import { VerdactLogo } from './verdact-logo';

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-hd">
          <VerdactLogo variant="lockup" className="h-7 w-auto" />
          <Link href="/" className="auth-back">← Back</Link>
        </div>
        <div className="auth-card-body">
          {children}
        </div>
      </div>
      <footer className="auth-foot">
        <span>© 2026 Verdact</span>
        <nav className="auth-foot-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
