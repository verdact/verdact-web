import Link from "next/link";
import type { ReactNode } from "react";
// NavItem + ThemeToggleButton are client components co-located in theme-toggle
// (an existing client module): keeping them there lets AppShell stay a SERVER
// component (server/client boundary unchanged) while still owning the chrome.
import { ThemeToggle, ThemeToggleButton, NavItem } from "./theme-toggle";
import { VerdactLogo } from "./verdact-logo";
import {
  ListIcon,
  DocIcon,
  UserCheckIcon,
  ShieldIcon,
  PencilIcon,
} from "@/app/dashboard/dash-icons";

type ActiveKey = "dashboard" | "account-health" | "disputes" | "customers" | "settings";

type AppShellProps = {
  children: React.ReactNode;
  email: string | null | undefined;
  businessName?: string | null;
  active?: ActiveKey;
};

type NavDef = {
  key: ActiveKey;
  /** Full label for the desktop rail. */
  label: string;
  /** Shorter label for the cramped mobile bottom nav (falls back to label). */
  shortLabel?: string;
  href: string;
  /** Leading icon so active state is icon-weight + colour, never colour alone. */
  icon: ReactNode;
};

// Each item carries a leading icon (icon + text law). Account health uses the
// shield/seal so the "am I in trouble?" destination reads as the calm, safe one.
const NAV_ITEMS: NavDef[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <ListIcon /> },
  { key: "disputes", label: "Disputes", href: "/dashboard/disputes", icon: <DocIcon /> },
  { key: "customers", label: "Customers", href: "/dashboard/customers", icon: <UserCheckIcon /> },
  {
    key: "account-health",
    label: "Account health",
    shortLabel: "Health",
    href: "/account-health",
    icon: <ShieldIcon />,
  },
  { key: "settings", label: "Settings", href: "/settings", icon: <PencilIcon /> },
];

export function AppShell({
  children,
  email,
  businessName,
  active,
}: AppShellProps) {
  const displayName = businessName?.trim() || "Your workspace";

  return (
    <div className="app-shell">
      {/* ── Left rail (desktop) ─────────────────────────────────────── */}
      <aside className="app-rail">
        <div className="app-rail__head">
          <Link href="/dashboard" className="app-rail__logo">
            <VerdactLogo variant="mark" className="h-8 w-8 shrink-0" />
            <div className="app-rail__workspace">
              <span className="app-rail__workspace-label">Workspace</span>
              <span className="app-rail__workspace-name" title={displayName}>
                {displayName}
              </span>
            </div>
          </Link>
        </div>

        <nav className="app-rail__nav" aria-label="App navigation">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.key}
              href={item.href}
              className="app-rail__link"
              icon={item.icon}
              isActive={active === item.key}
            >
              {item.label}
            </NavItem>
          ))}
        </nav>

        <div className="app-rail__foot">
          {/* The shell's single always-present safety anchor (X3). */}
          <p className="app-rail__assure">
            <ShieldIcon className="app-rail__assure-icon" />
            <span>Nothing is filed without you.</span>
          </p>

          <div className="app-rail__account">
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
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <header className="app-topbar">
        <Link href="/dashboard" className="app-topbar__logo" aria-label="Dashboard">
          <VerdactLogo variant="lockup" className="h-6 w-auto" />
        </Link>
        <div className="app-topbar__right">
          <span className="app-topbar__workspace" title={displayName}>
            {displayName}
          </span>
          {/* Mobile theme home (S5): the rail is hidden below 1023px, so the
              compact cycling button is the phone user's only way to switch. */}
          <ThemeToggleButton className="app-topbar__theme" />
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="app-content" id="main" tabIndex={-1}>
        {children}
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="app-bottom-nav" aria-label="App navigation">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            href={item.href}
            className="app-bottom-nav__item"
            icon={item.icon}
            isActive={active === item.key}
            stacked
          >
            {item.shortLabel ?? item.label}
          </NavItem>
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
  const displayName = businessName?.trim() || "Your workspace";

  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <a
          href="/dashboard"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]/30"
        >
          <VerdactLogo variant="mark" className="h-9 w-9" />
          <span className="text-sm font-semibold text-[var(--ink)]" title={displayName}>
            {displayName}
          </span>
        </a>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden text-xs text-[var(--ink-3)] md:inline" title={email}>
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
