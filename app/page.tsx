import Image from 'next/image';

export const metadata = {
  title: 'Verdact — Chargeback Dispute Management for Stripe Merchants',
  description: 'Verdact turns Stripe disputes into submission-ready evidence for SaaS and service businesses.',
};

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-xl">
        <div className="flex justify-center mb-6">
          <Image
            src="/verdact-logo.png"
            alt="Verdact"
            width={140}
            height={140}
            priority
          />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Verdact</h1>
        <p className="mt-4 text-lg text-gray-600 leading-relaxed">
          Dispute evidence for work delivered over email and Slack.
        </p>
        <p className="mt-3 text-gray-500 text-base">
          Verdact turns Stripe disputes into submission-ready evidence for SaaS
          and service businesses. Connect Stripe, select the Gmail threads and
          Slack messages that prove delivery, and Verdact organizes them into a
          processor-ready dispute packet you review before submission.
        </p>
        <p className="mt-3 text-gray-500 text-base">
          AI-assisted. Merchant-approved. No training on your inbox or workspace
          data.
        </p>
        <p className="mt-10 text-sm text-gray-400">
          Coming soon. &nbsp;·&nbsp;{' '}
          <a href="/signin" className="underline hover:text-gray-600">
            Sign in
          </a>
          &nbsp;·&nbsp;{' '}
          <a href="/privacy" className="underline hover:text-gray-600">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}
