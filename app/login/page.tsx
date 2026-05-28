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
      <section className="mx-auto w-full max-w-md py-10 md:py-16">
        <div className="reveal reveal-1 text-center">
          <span className="eyebrow eyebrow-center">Verdact · sign in</span>
          <h1 className="section-heading mt-5">Welcome back.</h1>
          <p className="section-dek mt-4">
            Pick up where you left off, organizing dispute evidence before you
            decide your next action.
          </p>
        </div>

        <div className="reveal reveal-2 surface-card mt-9 overflow-hidden">
          <div
            className="h-1.5 w-full"
            aria-hidden="true"
            style={{
              background:
                'linear-gradient(90deg, var(--action) 0 60%, var(--trust) 60% 100%)',
            }}
          />
          <div className="p-6 md:p-7">
            {confirmed ? (
              <div className="notice-info mb-5">
                Email confirmed. Sign in below to continue.
              </div>
            ) : null}

            <LoginForm presetError={presetError} />
          </div>
        </div>

        <p className="reveal reveal-3 meta-mono mt-6 flex items-center justify-center gap-2 text-center text-ink-mute">
          <LockIcon className="h-3.5 w-3.5 text-trust" />
          Encrypted in transit. Verdact never trains AI on your data.
        </p>
      </section>
    </AuthFrame>
  );
}
