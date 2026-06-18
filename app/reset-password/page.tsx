import { cookies } from 'next/headers';
import { AuthFrame } from '../_components/auth-chrome';
import { LockIcon } from '../_components/auth-icons';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordRecoveryGate } from './_components/ResetPasswordRecoveryGate';

const PASSWORD_RECOVERY_COOKIE = 'verdact_password_recovery';

export const metadata = {
  title: 'Choose new password',
  description: 'Choose a new password for your Verdact workspace.',
};

async function hasRecoverySession() {
  const cookieStore = await cookies();
  const canRecover = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === '1';
  if (!canRecover) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export default async function ResetPasswordPage() {
  const canReset = await hasRecoverySession();

  return (
    <AuthFrame>
      <div className="auth-center">
        <div className="auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">Account recovery</p>
          <h1 className="auth-h1">
            Choose a new password<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Set a new password for your Verdact account. You will use it the next
            time you sign in.
          </p>
        </div>

        <div
          className="auth-card auth-rise"
          style={{ '--i': 1, marginTop: 'var(--space-6)' } as React.CSSProperties}
        >
          <ResetPasswordRecoveryGate serverCanReset={canReset} />

          <p className="auth-trust" style={{ marginTop: 'var(--space-6)' }}>
            <LockIcon />
            We store your Stripe account ID only, never your keys, and never
            train on your data.
          </p>
        </div>
      </div>
    </AuthFrame>
  );
}
