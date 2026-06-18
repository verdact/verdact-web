import { PageFrame, SectionLabel } from '../_components/site-chrome';

export const metadata = {
  title: 'Terms of Service - Verdact',
  description: 'Terms and conditions for using Verdact chargeback dispute management.',
};

const keyTerms = [
  'Verdact is a dispute evidence and filing workflow tool, not a legal service.',
  'We do not guarantee chargeback dispute outcomes.',
  'Filing automation is not enabled during the current beta period.',
  'Slack connections are entirely merchant-initiated. Gmail is not offered at launch.',
  'Verdact is operated pre-incorporation. Governing law is to be confirmed.',
] as const;

export default function TermsPage() {
  return (
    <PageFrame active="terms">
      <section className="border-b border-[#d9e1dc] bg-white px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <SectionLabel>Agreement for reviewers and merchants</SectionLabel>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-[#172033]">
                Terms of Service
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-[#43515d]">
                Please read these terms carefully before using Verdact.
              </p>
            </div>
            <p className="w-fit rounded-full border border-[#d9e1dc] bg-[#f7f9f6] px-4 py-2 text-sm font-medium text-[#43515d]">
              Last updated: May 24, 2026
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-lg border border-[#d9e1dc] bg-white p-5">
            <p className="text-sm font-semibold text-[#172033]">Key terms</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#43515d]">
              {keyTerms.map((item) => (
                <li className="border-l-2 border-[#235f5c] pl-3" key={item}>
                  {item}
                </li>
              ))}
            </ul>
            <a
              className="mt-5 inline-flex rounded-md border border-[#bdc9c3] px-3 py-2 text-sm font-semibold text-[#235f5c] transition hover:border-[#235f5c] hover:bg-[#f2faf7]"
              href="/signin"
            >
              Go to reviewer sign-in
            </a>
          </aside>

          <article className="rounded-lg border border-[#d9e1dc] bg-white px-6 py-7 text-[#344653] shadow-[0_18px_55px_rgba(23,32,51,0.08)] md:px-8">
            <TermsSection title="1. Acceptance of Terms">
              <p>
                By accessing or using Verdact (&quot;the Service&quot;), you agree to be bound
                by these Terms of Service. If you do not agree to these terms, you may not access
                or use the Service.
              </p>
              <p className="mt-3">
                In these terms, &quot;Verdact,&quot; &quot;we,&quot; &quot;us,&quot; and
                &quot;the operator&quot; refer to the operator of Verdact. Verdact is operated
                pre-incorporation and is not yet a registered legal entity. We will update
                these terms to identify the operating entity once it is formed.
              </p>
            </TermsSection>

            <TermsSection title="2. Description of Service">
              <p>
                Verdact is a chargeback dispute evidence and filing workflow platform. We help
                merchants monitor dispute rates, compile delivery, policy, and communication
                evidence, and manage filing controls for eligible dispute responses.
              </p>
              <p className="mt-3">
                Free tier accounts may view generated packets and evidence assembly, while
                download and export are positioned as Paid tier features. During the beta period,
                the Paid tier is free for all users (no separate Founding tier).
                Filing automation is not enabled during the current beta period: Verdact does not
                submit dispute responses to Stripe on your behalf. You remain responsible for
                reviewing your settings and evidence records and for any submission you make. We
                are not a payment processor, bank, or legal service.
              </p>
            </TermsSection>

            <TermsSection title="3. Account and Connection Security">
              <p>
                To use the Service, you must connect your Stripe account. You may also optionally
                connect Slack to search for and import delivery proof. Gmail connection is not
                available to merchants at launch.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Stripe Connect: We use Standard Connect OAuth to retrieve dispute data. We do not store your Stripe credentials or access tokens.</li>
                <li>Slack OAuth: We access Slack read-only, only for channels you select, and only upon your explicit request to search for evidence. We do not continuously monitor, store, or scan your communications.</li>
                <li>All access tokens are stored in encrypted format using AES-256 at rest.</li>
              </ul>
            </TermsSection>

            <TermsSection title="4. Google API Limited Use Compliance">
              <div className="rounded-md border border-[#bdd9d3] bg-[#f2faf7] p-4">
                <p>
                  Gmail connection is not offered to merchants at launch. If and when we enable
                  it, Verdact&apos;s use of information received from Google APIs will adhere to the{' '}
                  <a
                    className="font-semibold text-[#235f5c] underline"
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
              </div>
            </TermsSection>

            <TermsSection title="5. No Warranties and Limitation of Liability">
              <p>
                Verdact provides the Service &quot;as is&quot; and &quot;as available&quot; without
                any warranty of any kind, either express or implied.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>We do not warrant or guarantee that any dispute evidence prepared with Verdact will be won or decided in your favor.</li>
                <li>Card network rules, chargeback decisions, and processor evaluations are governed entirely by third-party financial institutions and card networks.</li>
                <li>Verdact shall not be liable for any direct, indirect, incidental, or consequential damages resulting from lost funds, account terminations, or dispute outcomes.</li>
              </ul>
            </TermsSection>

            <TermsSection title="6. User Conduct">
              <p>
                You agree not to use the Service to upload false evidence, fabricate communication
                threads, or submit fraudulent chargeback rebuttals. Doing so will result in immediate
                account termination.
              </p>
            </TermsSection>

            <TermsSection title="7. Governing Law">
              <p>
                Verdact is operated pre-incorporation and is not yet a registered legal entity, so
                no governing law or jurisdiction is established by these terms at this time. Once
                the operating entity is formed, we will update this section to specify the
                governing law and jurisdiction and will notify you of the change as described in
                Section 8.
              </p>
            </TermsSection>

            <TermsSection title="8. Changes to Terms">
              <p>
                We reserve the right to modify these terms at any time. We will notify you of any
                material changes by email before they take effect.
              </p>
            </TermsSection>

            <TermsSection title="9. Contact">
              <p>
                Questions about these terms should be sent to:{' '}
                <a className="font-semibold text-[#235f5c] underline" href="mailto:admin@verdact.io">
                  admin@verdact.io
                </a>
              </p>
            </TermsSection>
          </article>
        </div>
      </section>
    </PageFrame>
  );
}

function TermsSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="border-t border-[#d9e1dc] py-7 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="text-xl font-semibold text-[#172033]">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7">{children}</div>
    </section>
  );
}
