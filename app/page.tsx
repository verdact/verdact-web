import Image from 'next/image';
import { PageFrame, SectionLabel, TrustStrip } from './_components/site-chrome';

export const metadata = {
  title: 'Verdact - Chargeback Dispute Management for Stripe Merchants',
  description:
    'Verdact turns Stripe disputes into submission-ready evidence for SaaS and service businesses.',
};

export default function Home() {
  return (
    <PageFrame active="home">
      <section className="border-b border-[#d9e1dc] bg-white px-5 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <SectionLabel>Stripe dispute evidence for work delivered online</SectionLabel>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#172033] md:text-6xl">
              Verdact
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-[#43515d]">
              Build processor-ready chargeback evidence from the Gmail threads
              and Slack messages that prove delivery, support, policy
              acceptance, and customer intent.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex rounded-md bg-[#172033] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#26364f] focus:outline-none focus:ring-2 focus:ring-[#172033]/25"
                href="/signin"
              >
                Open reviewer sign-in
              </a>
              <a
                className="inline-flex rounded-md border border-[#bdc9c3] bg-white px-5 py-3 text-sm font-semibold text-[#235f5c] transition hover:border-[#235f5c] hover:bg-[#f2faf7] focus:outline-none focus:ring-2 focus:ring-[#235f5c]/25"
                href="/privacy"
              >
                View privacy policy
              </a>
            </div>
          </div>

          <div className="mt-12 overflow-hidden rounded-lg border border-[#d9e1dc] bg-[#f7f9f6] shadow-[0_24px_70px_rgba(23,32,51,0.10)]">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border-b border-[#d9e1dc] bg-white p-6 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-3">
                  <Image src="/verdact-logo.png" alt="Verdact" width={48} height={48} priority />
                  <div>
                    <p className="text-sm font-semibold text-[#172033]">Evidence packet</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#60717d]">
                      Merchant reviewed
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {[
                    ['Gmail thread', 'Refund policy accepted before onboarding'],
                    ['Slack message', 'Delivery milestone acknowledged by client'],
                    ['Stripe dispute', 'Reason code evidence mapped to packet'],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-md border border-[#dce3df] bg-[#fbfcfb] p-4"
                      key={label}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#235f5c]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#344653]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#172033] p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9fd0c4]">
                  Reviewer confidence
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Limited, explicit access.</h2>
                <p className="mt-3 text-sm leading-6 text-[#d9e5e1]">
                  Gmail is connected only after consent. Verdact reads messages
                  only during an active evidence search and does not train AI
                  models on connected workspace data.
                </p>
                <dl className="mt-6 grid gap-3 text-sm">
                  <div className="flex items-center justify-between border-t border-white/15 pt-3">
                    <dt className="text-[#b7c9c4]">Gmail scope</dt>
                    <dd className="font-semibold">gmail.readonly</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/15 pt-3">
                    <dt className="text-[#b7c9c4]">Submission control</dt>
                    <dd className="font-semibold">Merchant approved</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/15 pt-3">
                    <dt className="text-[#b7c9c4]">Background scans</dt>
                    <dd className="font-semibold">None</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <TrustStrip />
        </div>
      </section>
    </PageFrame>
  );
}
