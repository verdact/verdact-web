import { ThemeToggle } from '@/app/_components/theme-toggle';
import { VerdactLogo } from '@/app/_components/verdact-logo';

export type AdminTab =
  | 'overview'
  | 'growth'
  | 'leads'
  | 'merchants'
  | 'disputes'
  | 'economics'
  | 'access'
  | 'activity';

const NAV: { tab: AdminTab; label: string; href: string }[] = [
  { tab: 'overview', label: 'Command', href: '/admin' },
  { tab: 'growth', label: 'Growth', href: '/admin/growth' },
  { tab: 'leads', label: 'Leads', href: '/admin/leads' },
  { tab: 'merchants', label: 'Merchants', href: '/admin/merchants' },
  { tab: 'disputes', label: 'Disputes', href: '/admin/disputes' },
  { tab: 'economics', label: 'Economics', href: '/admin/economics' },
  { tab: 'access', label: 'Access', href: '/admin/access' },
  { tab: 'activity', label: 'Activity', href: '/admin/activity' },
];

export function AdminShell({
  email,
  active,
  children,
  hrefFor,
}: {
  email: string;
  active: AdminTab;
  children: React.ReactNode;
  /** Override tab link targets (e.g. the dev preview points them at ?view=). */
  hrefFor?: (tab: AdminTab) => string;
}) {
  const tabHref = (tab: AdminTab): string =>
    hrefFor ? hrefFor(tab) : NAV.find((n) => n.tab === tab)?.href ?? '/admin';
  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="app-rail__head">
          <a href={tabHref('overview')} className="app-rail__logo">
            <VerdactLogo variant="mark" className="h-8 w-8 shrink-0" />
            <div className="app-rail__workspace">
              <span className="app-rail__workspace-label">admin</span>
              <span className="app-rail__workspace-name">Verdact platform</span>
            </div>
          </a>
        </div>
        <nav className="app-rail__nav" aria-label="Admin navigation">
          {NAV.map((item) => (
            <a
              key={item.tab}
              className={`app-rail__link${active === item.tab ? ' is-active' : ''}`}
              href={tabHref(item.tab)}
              aria-current={active === item.tab ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
          <a className="app-rail__link" href="/dashboard">
            App dashboard
          </a>
        </nav>
        <div className="app-rail__foot">
          <div className="app-rail__user">
            <span className="app-rail__email" title={email}>
              {email}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="app-rail__signout">
                Sign out
              </button>
            </form>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <header className="app-topbar">
        <a href={tabHref('overview')} className="app-topbar__logo" aria-label="Admin">
          <VerdactLogo variant="lockup" className="h-6 w-auto" />
        </a>
        <span className="app-topbar__workspace">Founder admin</span>
      </header>

      <main className="app-content" id="main" tabIndex={-1}>
        {children}
      </main>

      <nav className="app-bottom-nav" aria-label="Admin navigation">
        {NAV.map((item) => (
          <a
            key={item.tab}
            className={`app-bottom-nav__item${active === item.tab ? ' is-active' : ''}`}
            href={tabHref(item.tab)}
          >
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
