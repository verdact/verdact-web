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
  description: 'Sign in to your Verdact evidence workspace.',
};

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
      <p className="eyebrow">Merchant workspace</p>
      <h1>Sign in<span className="auth-dot">.</span></h1>
      <p className="auth-sub">Your dispute evidence workspace for Stripe.</p>

      {confirmed ? (
        <div className="notice notice--info" style={{ marginBottom: '20px' }}>
          Email confirmed. Sign in below to continue.
        </div>
      ) : null}

      <LoginForm presetError={presetError} />

      <p className="auth-trust">
        <LockIcon />
        Encrypted in transit. We never train AI on your data.
      </p>
    </AuthFrame>
  );
}
