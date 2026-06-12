'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LockIcon } from '../../_components/auth-icons';
import { ResetPasswordForm } from './ResetPasswordForm';

type RecoveryStatus = 'checking' | 'ready' | 'expired';

type ResetPasswordRecoveryGateProps = {
  serverCanReset: boolean;
};

export function ResetPasswordRecoveryGate({
  serverCanReset,
}: ResetPasswordRecoveryGateProps) {
  const [status, setStatus] = useState<RecoveryStatus>(
    serverCanReset ? 'ready' : 'checking',
  );

  useEffect(() => {
    if (serverCanReset) return;

    let active = true;
    let resolved = false;
    const supabase = createClient();
    const hash = window.location.hash;
    const hasRecoveryHash =
      hash.includes('type=recovery') || hash.includes('access_token=');

    function markReady() {
      if (!active || resolved) return;
      resolved = true;
      window.history.replaceState(null, '', '/reset-password');
      setStatus('ready');
    }

    function markExpired() {
      if (!active || resolved) return;
      resolved = true;
      setStatus('expired');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!hasRecoveryHash || !session) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        markReady();
      }
    });

    const timer = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && hasRecoveryHash) {
        markReady();
      } else {
        markExpired();
      }
    }, 750);

    return () => {
      active = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [serverCanReset]);

  if (status === 'ready') {
    return <ResetPasswordForm />;
  }

  if (status === 'checking') {
    return (
      <div className="notice notice--info" role="status" aria-live="polite">
        <LockIcon />
        <span>Checking reset link...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="notice notice--error" role="alert">
        <LockIcon />
        <span>This reset link has expired. Request a new link to continue.</span>
      </div>

      <Link className="btn btn--primary w-full" href="/forgot-password">
        Request a new link
      </Link>
    </div>
  );
}
