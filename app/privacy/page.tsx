import { PageFrame, SectionLabel } from '../_components/site-chrome';

export const metadata = {
  title: 'Privacy Policy - Verdact',
  description: 'How Verdact collects, uses, and protects your data.',
};

const safeguards = [
  'Slack access starts only after merchant consent. Gmail is not offered at launch.',
  'Evidence searches are initiated by the merchant, not run continuously.',
  'Connected workspace data is not used to train AI models.',
  'Tokens are encrypted and kept separate from public reviewer pages.',
] as const;

export default function PrivacyPage() {
  return (
    <PageFrame active="privacy">
      <section className="border-b border-[#d9e1dc] bg-white px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <SectionLabel>Policy for reviewers and merchants</SectionLabel>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-[#172033]">
                Privacy Policy
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-[#43515d]">
                Verdact uses connected account data only to prepare
                merchant-reviewed chargeback evidence records.
              </p>
            </div>
            <p className="w-fit rounded-full border border-[#d9e1dc] bg-[#f7f9f6] px-4 py-2 text-sm font-medium text-[#43515d]">
              Last updated: May 23, 2026
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-10">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-lg border border-[#d9e1dc] bg-white p-5">
            <p className="text-sm font-semibold text-[#172033]">Reviewer summary</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#43515d]">
              {safeguards.map((item) => (
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
            <PolicySection title="1. Who We Are">
              <p>
                Verdact is a chargeback dispute management platform for Stripe
                merchants. We help merchants monitor dispute-rate risk and
                organize dispute evidence records for merchant review.
              </p>
              <p className="mt-3">
                Contact:{' '}
                <a className="font-semibold text-[#235f5c] underline" href="mailto:admin@verdact.io">
                  admin@verdact.io
                </a>
              </p>
            </PolicySection>

            <PolicySection title="2. Data We Collect">
              <DataGroup title="Slack, if you choose to connect">
                <li>Read-only access to message content from channels you explicitly select</li>
                <li>We read messages only when you initiate an evidence search for a specific dispute</li>
                <li>We do not read, store, or scan your workspace continuously or in the background</li>
              </DataGroup>

              <DataGroup title="Gmail (not offered at launch)">
                <li>Gmail connection is not available to merchants at launch. If and when we enable it, we will read email content only when you initiate an evidence search for a specific dispute, and we will update this policy before turning it on.</li>
              </DataGroup>

              <DataGroup title="Stripe, required">
                <li>Dispute records, transaction data, and early fraud warning events via Stripe OAuth</li>
              </DataGroup>

              <DataGroup title="Account data">
                <li>Name, email address, and login credentials for your Verdact account</li>
              </DataGroup>

              <DataGroup title="Audit tool, if you use it">
                <li>The public dispute audit tool collects the email address and optional business name you enter, plus the dispute figures you submit (such as transaction counts, dispute amounts, reason codes, outcomes, and which evidence types you say you hold)</li>
                <li>We store these submissions and the score we calculate so we can follow up about your results</li>
                <li>We store a one-way hashed form of your IP address and your browser user-agent string for rate limiting and abuse prevention, not your raw IP</li>
              </DataGroup>

              <DataGroup title="Waitlist, if you join">
                <li>Sign-up is invite-only during the launch period. If you join the waitlist, we collect the email address you submit and a tag noting where you signed up</li>
                <li>As with the audit tool, we store a one-way hashed form of your IP address and your browser user-agent string for rate limiting and abuse prevention</li>
              </DataGroup>

              <DataGroup title="Product analytics">
                <li>We use PostHog to understand how the product is used. This captures pageviews, clicks, and similar interaction events</li>
                <li>For signed-in merchants, events are tied to a pseudonymous account identifier, never to your name or email</li>
                <li>In production we record anonymized session replays. Replay is configured to mask all form inputs and all on-screen text, so customer names, evidence, and dispute detail are not legible in a recording. Session replay is disabled in local development</li>
                <li>If coarse country and region capture is enabled, we may record an approximate location derived from request headers. We do not store your raw IP address for this purpose</li>
              </DataGroup>
            </PolicySection>

            <PolicySection title="3. How We Use Your Data">
              <p>We use your data to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Identify relevant evidence for a chargeback dispute you are actively working on</li>
                <li>Prepare submission-ready dispute evidence records for merchant review</li>
                <li>Calculate and display your estimated dispute-rate standing</li>
                <li>Send transactional notifications about dispute deadlines and outcomes</li>
                <li>Follow up about audit results or waitlist sign-ups you submit to us</li>
                <li>Understand product usage and improve the service through analytics</li>
              </ul>
              <p className="mt-4 font-semibold text-[#172033]">We do not:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Sell your data to third parties</li>
                <li>Use your connected Slack data to train AI models</li>
                <li>Access your connected Slack workspace outside of an active evidence search you initiate</li>
                <li>Share your data with any party other than Stripe and the service providers listed in Section 5</li>
              </ul>
            </PolicySection>

            <PolicySection title="4. Data Storage and Security">
              <ul className="list-disc space-y-2 pl-5">
                <li>All data is stored in encrypted databases using AES-256 at rest</li>
                <li>Slack access tokens are encrypted and never stored in plain text</li>
                <li>Evidence extracted from connected sources is deleted within 90 days of dispute resolution</li>
                <li>We use Supabase for database infrastructure and Vercel for hosting</li>
              </ul>
            </PolicySection>

            <PolicySection title="5. Third-Party Services">
              <p>We share data with the following services only as necessary to operate the platform:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Stripe - dispute and transaction data</li>
                <li>Supabase - database storage</li>
                <li>Vercel - hosting infrastructure</li>
                <li>Anthropic - AI evidence drafting</li>
                <li>Resend - transactional email delivery</li>
                <li>PostHog - product analytics and anonymized session replay</li>
              </ul>
            </PolicySection>

            <PolicySection title="6. Google API Data">
              <div className="rounded-md border border-[#bdd9d3] bg-[#f2faf7] p-4">
                <p>
                  Gmail connection is not available to merchants at launch. The
                  commitments below describe how we would handle Google API data
                  if and when we enable Gmail, in line with the{' '}
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
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>We would request Gmail access only when a user explicitly initiates an evidence search</li>
                <li>Gmail data would be used only to identify dispute-relevant emails such as service delivery proof, usage confirmations, refund-policy references, and customer communications</li>
                <li>We would not use Gmail data for advertising or to build user profiles</li>
                <li>We would not allow humans to read your Gmail data except where you have given explicit consent or where required by law</li>
              </ul>
            </PolicySection>

            <PolicySection title="7. Your Rights">
              <p>You may at any time:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Disconnect Slack: Slack admin settings &rarr; Installed apps &rarr; Verdact &rarr; Remove</li>
                <li>Disconnect Stripe: Verdact dashboard &rarr; Settings &rarr; Integrations &rarr; Disconnect</li>
                <li>
                  Request data deletion: email{' '}
                  <a className="font-semibold text-[#235f5c] underline" href="mailto:admin@verdact.io">
                    admin@verdact.io
                  </a>{' '}
                  with subject "Data Deletion Request" - processed within 30 days
                </li>
                <li>
                  Request data export: email{' '}
                  <a className="font-semibold text-[#235f5c] underline" href="mailto:admin@verdact.io">
                    admin@verdact.io
                  </a>{' '}
                  with subject "Data Export Request"
                </li>
              </ul>
            </PolicySection>

            <PolicySection title="8. Data Retention">
              <ul className="list-disc space-y-2 pl-5">
                <li>Active account data: retained while your account is active</li>
                <li>Raw imports from connected sources not included in an evidence record: deleted within 90 days of dispute resolution</li>
                <li>Evidence records: retained for at least 24 months or longer where card-network, legal, tax, fraud-prevention, or audit obligations require it</li>
                <li>Customer PII in retained records: redacted on valid deletion request where retention rules allow</li>
                <li>Account data after deletion request: purged or de-identified within 30 days unless retention rules require preservation</li>
              </ul>
            </PolicySection>

            <PolicySection title="9. Changes to This Policy">
              <p>We will notify you by email at the address on your account before making material changes to this policy.</p>
            </PolicySection>

            <PolicySection title="10. Contact">
              <p>
                Questions about this policy:{' '}
                <a className="font-semibold text-[#235f5c] underline" href="mailto:admin@verdact.io">
                  admin@verdact.io
                </a>
              </p>
            </PolicySection>
          </article>
        </div>
      </section>
    </PageFrame>
  );
}

function PolicySection({
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

function DataGroup({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="mt-5">
      <p className="font-semibold text-[#172033]">{title}</p>
      <ul className="mt-2 list-disc space-y-2 pl-5">{children}</ul>
    </div>
  );
}
