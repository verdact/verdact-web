import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { CheckIcon } from '../_components/auth-icons';
import { getUser } from '@/lib/dal';
import { LoginForm } from './_components/LoginForm';

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    confirmed?: string;
  }>;
};

export const metadata = {
  title: 'Sign in',
  description: 'Return to your Verdact evidence workspace.',
};

// Static sample data per wireframe — never live user data on the public page.
const EXAMPLE_ROWS = [
  { label: 'Open disputes', value: '2' },
  { label: 'Needs evidence', value: '1' },
  { label: 'Awaiting decision', value: '1' },
  { label: 'Account risk', value: 'Check dashboard' },
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const presetError = params.error ? decodeURIComponent(params.error) : undefined;
  const confirmed = params.confirmed === '1';

  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Merchant sign-in</p>
          <h1 className="auth-h1">
            Welcome back<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Return to your evidence workspace and pick up the dispute response
            where you left off.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          {confirmed ? (
            <div className="notice notice--info" style={{ marginBottom: 'var(--space-5)' }}>
              Email confirmed. Sign in below to continue.
            </div>
          ) : null}

          <LoginForm presetError={presetError} />
        </div>

        <p className="auth-trust auth-rise" style={{ '--i': 2 } as React.CSSProperties}>
          <CheckIcon />
          Your workspace opens to the dashboard after sign-in.
        </p>

        <aside
          className="wsprev auth-rise"
          style={{ '--i': 3, marginTop: 'var(--space-6)' } as React.CSSProperties}
          aria-label="Example workspace preview with sample data"
        >
          <p className="wsprev-label">
            Example workspace <span className="sample">Sample data</span>
          </p>
          {EXAMPLE_ROWS.map((row) => (
            <div className="wsprev-row" key={row.label}>
              <b>{row.label}</b>
              <span className="val">{row.value}</span>
            </div>
          ))}
        </aside>
      </div>
    </AuthFrame>
  );
}
