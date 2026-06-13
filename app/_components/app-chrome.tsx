import { ThemeToggle } from "./theme-toggle";
import { VerdactLogo } from "./verdact-logo";

type ActiveKey = "dashboard" | "account-health" | "disputes" | "customers" | "settings";

type AppShellProps = {
  children: React.ReactNode;
  email: string | null | undefined;
  businessName?: string | null;
  active?: ActiveKey;
};

const NAV_ITEMS: Array<{ key: ActiveKey; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "disputes", label: "Disputes", href: "/dashboard/disputes" },
  { key: "customers", label: "Customers", href: "/dashboard/customers" },
  { key: "account-health", label: "Account health", href: "/account-health" },
  { key: "settings", label: "Settings", href: "/settings" },
];

export function AppShell({
  children,
  email,
  businessName,
  active,
}: AppShellProps) {
  const displayName = businessName?.trim() || "Verdact workspace";

  return (
    <div className="app-shell">
      {/* ── Left rail (desktop) ─────────────────────────────────────── */}
      <aside className="app-rail">
        <div className="app-rail__head">
          <a href="/dashboard" className="app-rail__logo">
            <VerdactLogo variant="mark" className="h-8 w-8 shrink-0" />
            <div className="app-rail__workspace">
              <span className="app-rail__workspace-label">workspace</span>
              <span className="app-rail__workspace-name">{displayName}</span>
            </div>
          </a>
        </div>

        <nav className="app-rail__nav" aria-label="App navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={`app-rail__link${active === item.key ? " is-active" : ""}`}
              aria-current={active === item.key ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="app-rail__foot">
          <div className="app-rail__user">
            {email ? (
              <span className="app-rail__email" title={email}>
                {email}
              </span>
            ) : null}
            <form action="/auth/signout" method="post">
              <button type="submit" className="app-rail__signout">
                Sign out
              </button>
            </form>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <header className="app-topbar">
        <a href="/dashboard" className="app-topbar__logo" aria-label="Dashboard">
          <VerdactLogo variant="lockup" className="h-6 w-auto" />
        </a>
        <span className="app-topbar__workspace">{displayName}</span>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="app-content" id="main" tabIndex={-1}>
        {children}
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="app-bottom-nav" aria-label="App navigation">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={`app-bottom-nav__item${active === item.key ? " is-active" : ""}`}
            aria-current={active === item.key ? "page" : undefined}
          >
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

// ── Narrow top-bar header (used on marketing/auth pages) ────────────────────
// Kept for backward compatibility with non-app pages.

type AppHeaderProps = {
  email: string | null | undefined;
  businessName?: string | null;
  active?: ActiveKey;
};

export function AppHeader({ email, businessName }: AppHeaderProps) {
  const displayName = businessName?.trim() || "Verdact workspace";

  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <a
          href="/dashboard"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]/30"
        >
          <VerdactLogo variant="mark" className="h-9 w-9" />
          <span className="text-sm font-semibold text-[var(--ink)]">
            {displayName}
          </span>
        </a>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden text-xs text-[var(--ink-3)] md:inline">
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
