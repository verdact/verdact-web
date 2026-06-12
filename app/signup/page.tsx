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
      <section className="mx-auto grid w-full max-w-[1040px] gap-12 py-10 md:py-16 lg:grid-cols-[1.05fr_minmax(360px,0.95fr)] lg:items-start">
        {/* LEFT - promise */}
        <div className="reveal reveal-1 lg:pt-2">
          <span className="eyebrow">Verdact · new workspace</span>
          <h1 className="section-heading mt-5 text-[2.6rem] md:text-[3.25rem]">
            Create your workspace.
          </h1>
          <p className="section-dek mt-5 max-w-md">
            One place to monitor dispute risk, assemble source-linked evidence,
            and choose how eligible Stripe filings run after subscription.
          </p>

          <ol className="surface-card mt-10 overflow-hidden rounded-[12px] shadow-sm">
            {WHAT_YOU_GET.map((item) => (
              <li
                key={item.title}
                className="grid grid-cols-[2rem_1fr] gap-3.5 border-b border-rule px-5 py-4 last:border-b-0"
              >
                <span className="label-mono mt-0.5 text-action">{item.idx}</span>
                <div>
                  <p className="text-[0.97rem] font-semibold leading-snug text-ink">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-mute">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="meta-mono mt-6 flex items-center gap-2 text-ink-mute">
            <CheckIcon className="h-3.5 w-3.5 text-trust" />
            Nothing is filed with the bank until you review and approve it.
          </p>
        </div>

        {/* RIGHT - form */}
        <div className="reveal reveal-3">
          <div className="surface-card overflow-hidden rounded-[12px] shadow-[var(--shadow-record)]">
            <div
              className="h-1.5 w-full"
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(90deg, var(--action) 0 60%, var(--trust) 60% 100%)',
              }}
            />
            <div className="p-8 md:p-10">
              <SignupForm />
            </div>
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
    body: 'Paid tier unlocks auto-file or review-then-submit. Free workspaces can view the packet, while download, export, and filing are subscribe-gated. During beta, Paid tier features are free for all.',
  },
];
