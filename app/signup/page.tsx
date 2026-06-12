import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { CheckIcon } from '../_components/auth-icons';
import { getUser } from '@/lib/dal';
import { SignupForm } from './_components/SignupForm';

export const metadata = {
  title: 'Create your workspace · Verdact',
  description: 'Create a Verdact evidence workspace for Stripe disputes.',
};

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <AuthFrame>
      <section className="w-full">
        <div className="reveal reveal-1">
          <h1 className="t-h2">Create workspace</h1>
          <p className="t-dek mt-3">
            One place to monitor dispute risk and assemble source-linked evidence.
          </p>
        </div>

        <div className="reveal reveal-2 mt-10">
          <SignupForm />
        </div>

        <p className="reveal reveal-3 mt-8 flex items-start gap-2 text-sm text-ink-mute">
          <CheckIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-verdict" />
          <span>Nothing is filed with the bank until you review and approve it.</span>
        </p>
      </section>
    </AuthFrame>
  );
}
