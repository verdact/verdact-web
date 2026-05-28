import { VerdactLogo } from './verdact-logo';

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
        <a className="flex items-center gap-3" href="/dashboard">
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
                  className={`label-mono-strong rounded-sm px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ink/30 ${
                    isActive
                      ? 'bg-ink text-surface'
                      : 'text-ink-mute hover:text-ink hover:bg-surface-3'
                  }`}
                  href={link.href}
                  key={link.key}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <span className="mx-2 hidden h-5 w-px bg-rule md:block" />

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
    <main className="surface-paper min-h-screen text-ink">
      <AppHeader email={email} businessName={businessName} active={active} />
      {children}
    </main>
  );
}
