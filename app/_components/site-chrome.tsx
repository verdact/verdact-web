import { VerdactLogo } from './verdact-logo';
import { ThemeToggle } from './theme-toggle';

type SiteHeaderProps = {
  active?: 'home' | 'privacy' | 'signin' | 'connections' | 'evidence' | 'terms';
  reviewer?: boolean;
};

const navLinks = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/privacy', label: 'Privacy', key: 'privacy' },
  { href: '/terms', label: 'Terms', key: 'terms' },
  { href: '/signin', label: 'Reviewer sign-in', key: 'signin' },
] as const;

export function SiteHeader({ active, reviewer = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-surface/85 px-5 py-4 text-ink backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <a
          className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
          href="/"
        >
          <VerdactLogo variant="mark" priority className="h-10 w-10" />
          <div className="leading-none">
            <p className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
              Verdact<span className="text-action">.</span>
            </p>
            <p className="label-mono mt-1">Dispute evidence</p>
          </div>
        </a>

        <nav
          className="flex flex-wrap items-center gap-2 text-sm"
          aria-label="Primary navigation"
        >
          {navLinks.map((link) => {
            const isActive = active === link.key;
            return (
              <a
                className={`rounded-md px-3 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40 ${
                  isActive
                    ? 'bg-action-soft text-action'
                    : 'text-ink-soft hover:bg-surface-3 hover:text-ink'
                }`}
                aria-current={isActive ? 'page' : undefined}
                href={link.href}
                key={link.key}
              >
                {link.label}
              </a>
            );
          })}
          {reviewer ? (
            <span className="pill-action">Review mode</span>
          ) : null}
          <span className="mx-1 hidden h-5 w-px bg-rule sm:block" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function PageFrame({
  children,
  active,
  reviewer,
}: Readonly<{
  children: React.ReactNode;
  active?: SiteHeaderProps['active'];
  reviewer?: boolean;
}>) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <SiteHeader active={active} reviewer={reviewer} />
      {children}
    </main>
  );
}

export const trustPoints = [
  'User-initiated Gmail access only',
  'Read-only Gmail scope',
  'No background inbox scanning',
  'No model training on inbox data',
] as const;

export function TrustStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {trustPoints.map((point) => (
        <div
          className="rounded-md border border-rule-strong bg-surface-2 px-4 py-3 text-sm font-medium text-ink-soft"
          key={point}
        >
          {point}
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="eyebrow">{children}</p>;
}
