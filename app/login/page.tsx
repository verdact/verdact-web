import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
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
        <div className="reveal reveal-1">
          <p className="label-mono">Verdact · sign in</p>
          <h1 className="font-display-light mt-5 text-[2.6rem] leading-[1.02] text-ink md:text-[3.25rem]">
            Welcome back.
          </h1>
          <p className="mt-4 text-base leading-7 text-ink-soft">
            Continue organizing dispute evidence before deciding your next action.
          </p>
        </div>

        <div className="reveal reveal-2 mt-9">
          {confirmed ? (
            <div className="notice-info mb-5">
              Email confirmed. Sign in below to continue.
            </div>
          ) : null}

          <LoginForm presetError={presetError} />
        </div>
      </section>
    </AuthFrame>
  );
}
