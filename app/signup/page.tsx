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

type SignupPageProps = {
  searchParams: Promise<{ intent?: string; from?: string; email?: string }>;
};

function isPlausibleEmail(value: string | undefined): value is string {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value) && value.length <= 254;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getUser();
  if (user) {
    redirect('/dashboard');
  }

  const { intent, from, email } = await searchParams;
  const fightDispute = intent === 'fight-dispute';
  const fromAudit = from === 'audit';
  // Only trust the email enough to prefill the field; signup still validates it.
  const auditEmail = fromAudit && isPlausibleEmail(email) ? email : undefined;

  return (
    <AuthFrame>
      <div className="auth-split">
        <div className="auth-promise auth-rise" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow auth-eyebrow-row">
            {fromAudit ? 'Keep your audit' : fightDispute ? 'Fight this dispute' : 'New workspace'}
          </p>
          <h1 className="auth-h1">
            {fromAudit
              ? <>Carry your audit into a workspace<span className="auth-dot">.</span></>
              : fightDispute
              ? <>Build your evidence<span className="auth-dot">.</span></>
              : <>Create your evidence workspace<span className="auth-dot">.</span></>}
          </h1>
          <p className="auth-sub">
            {fromAudit
              ? 'We pre-load the disputes from your audit as your starting history, so account health and your evidence records open with real context.'
              : fightDispute
              ? 'Verdact reads the dispute, organizes your evidence, and flags what\'s missing before the deadline.'
              : 'Build source-traced dispute evidence, check account risk, and review the response before anything is submitted to Stripe.'}
          </p>
          <p className="auth-micro">
            {fromAudit
              ? 'Use the same email from your audit so we attach it automatically. You build and view your evidence record for free, and nothing is filed without your approval.'
              : fightDispute
              ? 'Create your workspace first. Connect Stripe after signup so Verdact can read the dispute details.'
              : 'You can create the workspace before connecting Stripe. Stripe is needed before Verdact can read disputes or account-risk data.'}
          </p>
        </div>

        <div className="auth-card auth-rise" style={{ '--i': 1 } as React.CSSProperties}>
          <SignupForm initialEmail={auditEmail} />
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
