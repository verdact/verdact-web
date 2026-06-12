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
      <h1>Create workspace.</h1>
      <p className="auth-sub">Monitor risk. Build evidence. File when ready.</p>

      <SignupForm />

      <p className="auth-trust">
        <CheckIcon />
        Nothing is filed with the bank until you review and approve it.
      </p>
    </AuthFrame>
  );
}
