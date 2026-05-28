import { redirect } from 'next/navigation';
import { AuthFrame } from '../_components/auth-chrome';
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
      <section className="mx-auto grid w-full max-w-[1040px] gap-12 py-10 md:py-16 lg:grid-cols-[1.05fr_minmax(360px,0.95fr)] lg:items-start">
        {/* LEFT - promise */}
        <div className="reveal reveal-1 lg:pt-2">
          <p className="label-mono">Verdact · new workspace</p>
          <h1 className="font-display-light mt-5 text-[2.6rem] leading-[1.02] text-ink md:text-[3.5rem]">
            Create your workspace.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-soft">
            One place to monitor dispute risk, assemble source-linked evidence,
            and choose how eligible Stripe filings run after subscription.
          </p>

          <ul className="mt-10 space-y-4">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="flex items-start gap-3.5">
                <span className="label-mono mt-1 w-8 shrink-0 text-ink-faint">
                  {item.idx}
                </span>
                <div>
                  <p className="text-[0.97rem] font-medium leading-snug text-ink">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-mute">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT - form */}
        <div className="reveal reveal-3">
          <div className="surface-card p-6 md:p-7">
            <SignupForm />
          </div>
        </div>
      </section>
    </AuthFrame>
  );
}

const WHAT_YOU_GET = [
  {
    idx: '01',
    title: 'Create the evidence workspace',
    body: 'Sign up and your merchant workspace is ready.',
  },
  {
    idx: '02',
    title: 'Connect Stripe and source-linked proof',
    body: 'Authorize Stripe through Standard OAuth. Add usage, policy, support, communication, and file evidence as needed.',
  },
  {
    idx: '03',
    title: 'Choose filing controls',
    body: 'Paid plans unlock auto-file or review-then-submit. Non-subscribed workspaces prepare evidence and file manually.',
  },
];
