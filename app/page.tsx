import Image from 'next/image';

export const metadata = {
  title: 'Verdact — Chargeback Dispute Management for Stripe Merchants',
  description: 'Verdact helps Stripe merchants monitor their VAMP ratio and submit bank-compliant chargeback dispute rebuttals. Keep your Stripe account alive.',
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
          Chargeback dispute management for Stripe merchants.
          Verdact monitors your VAMP ratio and files bank-compliant dispute
          submissions — so you keep your Stripe account and win more cases.
        </p>
        <p className="mt-3 text-gray-500 text-base">
          Connects to your Gmail and Slack to extract order confirmations,
          shipping records, and customer communications as dispute evidence.
        </p>
        <p className="mt-10 text-sm text-gray-400">
          Coming soon. &nbsp;·&nbsp;{' '}
          <a href="/privacy" className="underline hover:text-gray-600">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}
