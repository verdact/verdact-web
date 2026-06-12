import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
import { CheckIcon } from '../_components/auth-icons';
import { getUser } from '@/lib/dal';
import { SignupForm } from './_components/SignupForm';

export const metadata = {
  title: 'Create your workspace',
  description: 'Create a Verdact evidence workspace for Stripe disputes.',
};

// Workspace Preview artifact per wireframe — a product preview, not bullets.
const PREVIEW_ROWS = [
  { num: '1', label: 'Account risk', desc: 'Connect Stripe to see disputes and dispute-rate pressure' },
  { num: '2', label: 'Evidence record', desc: 'Add delivery, approval, policy, Slack, email, and files' },
  { num: '3', label: 'Review packet', desc: 'Check sources and approve before submission' },
];

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <AuthFrame>
      <div className="auth-split">
        <div className="auth-promise auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">New workspace</p>
          <h1 className="auth-h1">
            Create your evidence workspace<span className="auth-dot">.</span>
          </h1>
          <p className="auth-sub">
            Build source-traced dispute evidence, check account risk, and review
            the response before anything is submitted to Stripe.
          </p>
          <p className="auth-micro">
            You can create the workspace before connecting Stripe. Stripe is
            needed before Verdact can read disputes or account-risk data.
          </p>
        </div>

        <div className="auth-card auth-rise" style={{ '--i': 1 } as React.CSSProperties}>
          <SignupForm />
          <p className="auth-trust">
            <CheckIcon />
            Nothing is filed without your review and authorization.
          </p>
        </div>

        <aside
          className="wsprev auth-rise"
          style={{ '--i': 2 } as React.CSSProperties}
          aria-label="Workspace preview"
        >
          <p className="wsprev-label">Workspace preview</p>
          {PREVIEW_ROWS.map((row) => (
            <div className="wsprev-row" key={row.num}>
              <span className="wsprev-num">{row.num}</span>
              <b>{row.label}</b>
              <span>{row.desc}</span>
            </div>
          ))}
          <p className="wsprev-foot">
            Workspace created first. Stripe can connect after signup.
          </p>
        </aside>
      </div>
    </AuthFrame>
  );
}
