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
  title: 'Sign in · Verdact',
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
      <section className="w-full">
        <div className="reveal reveal-1">
          <h1 className="t-h2">Sign in to Verdact</h1>
          <p className="t-dek mt-3">
            Pick up where you left off, organizing dispute evidence before you decide your next action.
          </p>
        </div>

        <div className="reveal reveal-2 mt-10">
          {confirmed ? (
            <div className="notice notice--info mb-6">
              Email confirmed. Sign in below to continue.
            </div>
          ) : null}

          <LoginForm presetError={presetError} />
        </div>

        <p className="reveal reveal-3 mt-8 flex items-center gap-2 text-sm text-ink-mute">
          <LockIcon className="h-4 w-4 text-verdict" />
          Encrypted in transit. We never train AI on your data.
        </p>
      </section>
    </AuthFrame>
  );
}
