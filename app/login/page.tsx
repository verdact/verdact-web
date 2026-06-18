import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { LockIcon } from '../_components/auth-icons';
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

// Static sample data per redesign comp. Never live user data on the public
// page. The dispute-rate row is framed vs Stripe's 0.75% line (S41 wording)
// and uses verdict green to read as safe/healthy.
const EXAMPLE_ROWS: ReadonlyArray<{
  label: string;
  value: string;
  good?: boolean;
}> = [
  { label: 'Open disputes needing you', value: '2' },
  { label: 'Filed, awaiting the issuer', value: '1' },
  { label: 'Dispute rate vs 0.75% line', value: '0.31%', good: true },
  { label: 'Recovered to date', value: '$4,180' },
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
      <div className="auth-split">
        <div className="auth-promise auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Welcome back</p>
          <h1 className="auth-h1">
            Your dispute desk, ready when they file<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Pick up where you left off. Every case, its evidence, and your
            account health in one calm place.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          {confirmed ? (
            <div className="notice notice--info" style={{ marginBottom: 'var(--space-5)' }}>
              Email confirmed. Sign in below to continue.
            </div>
          ) : null}

          <LoginForm presetError={presetError} />

          <p className="auth-trust" style={{ marginTop: 'var(--space-6)' }}>
            <LockIcon />
            We store your Stripe account ID only, never your keys, and never
            train on your data.
          </p>
        </div>

        <aside
          className="wsprev auth-rise"
          style={{ '--i': 2 } as React.CSSProperties}
          aria-label="Example workspace preview with sample data"
        >
          <p className="wsprev-label">
            Your workspace <span className="sample">Sample</span>
          </p>
          {EXAMPLE_ROWS.map((row) => (
            <div className="wsprev-row" key={row.label}>
              <b>{row.label}</b>
              <span
                className="val"
                style={row.good ? { color: 'var(--verdict)' } : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </AuthFrame>
  );
}
