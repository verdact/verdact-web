import { VerdactLogo } from './verdact-logo';
import { ThemeToggle } from './theme-toggle';

type AppHeaderProps = {
  email: string | null | undefined;
  businessName?: string | null;
  active?: 'dashboard' | 'connections' | 'disputes' | 'settings';
};

const navLinks = [
  { href: '/dashboard', label: 'Overview', key: 'dashboard' },
] as const;

export function AppHeader({ email, businessName, active }: AppHeaderProps) {
  const displayName =
    (businessName && businessName.trim()) || 'Verdact workspace';

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
        <a
          className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          href="/dashboard"
        >
          <VerdactLogo variant="mark" priority className="h-10 w-10" />
          <div className="leading-none">
            <p className="label-mono">Verdact workspace</p>
            <p className="font-display mt-1.5 text-lg text-ink">
              {displayName}
            </p>
          </div>
        </a>

        <div className="flex flex-wrap items-center gap-2">
          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="App navigation"
          >
            {navLinks.map((link) => {
              const isActive = active === link.key;
              return (
                <a
                  className={`label-mono-strong rounded-sm px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                    isActive
                      ? 'bg-ink text-surface'
                      : 'text-ink-mute hover:text-ink hover:bg-surface-3'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  href={link.href}
                  key={link.key}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <span className="mx-2 hidden h-5 w-px bg-rule md:block" />

          <ThemeToggle />

          {email ? (
            <span className="meta-mono hidden text-ink-mute md:inline">
              {email}
            </span>
          ) : null}

          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost px-3 py-2 text-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  email,
  businessName,
  active,
}: {
  children: React.ReactNode;
  email: string | null | undefined;
  businessName?: string | null;
  active?: AppHeaderProps['active'];
}) {
  return (
    <main className="surface-paper flex min-h-screen flex-col text-ink">
      <AppHeader email={email} businessName={businessName} active={active} />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </main>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-5 md:px-10">
        <p className="label-mono">Verdact · Stripe dispute defense</p>
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
