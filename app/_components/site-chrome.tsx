import { VerdactLogo } from './verdact-logo';

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
    <header className="border-b border-[#d9e1dc] bg-white/95 px-5 py-4 text-[#172033] shadow-[0_1px_0_rgba(23,32,51,0.04)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <a className="flex w-fit items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#235f5c]/25" href="/">
          <VerdactLogo variant="mark" priority className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold leading-5 text-[#172033]">Verdact</p>
            <p className="text-xs font-medium uppercase text-[#60717d]">
              Dispute evidence
            </p>
          </div>
        </a>

        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Primary navigation">
          {navLinks.map((link) => {
            const isActive = active === link.key;
            return (
              <a
                className={`rounded-md px-3 py-2 font-medium transition focus:outline-none focus:ring-2 focus:ring-[#235f5c]/25 ${
                  isActive
                    ? 'bg-[#e5f1ee] text-[#174c49]'
                    : 'text-[#4d5d69] hover:bg-[#f3f7f5] hover:text-[#172033]'
                }`}
                href={link.href}
                key={link.key}
              >
                {link.label}
              </a>
            );
          })}
          {reviewer ? (
            <span className="rounded-full border border-[#bdd9d3] bg-[#f2faf7] px-3 py-1.5 text-xs font-semibold uppercase text-[#235f5c]">
              Review mode
            </span>
          ) : null}
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
    <main className="min-h-screen bg-[#f7f9f6] text-[#172033]">
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
          className="rounded-md border border-[#d9e1dc] bg-white px-4 py-3 text-sm font-medium text-[#344653]"
          key={point}
        >
          {point}
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-xs font-semibold uppercase text-[#235f5c]">
      {children}
    </p>
  );
}
