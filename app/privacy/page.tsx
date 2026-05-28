import { PageFrame, SectionLabel } from '../_components/site-chrome';

export const metadata = {
  title: 'Privacy Policy - Verdact',
  description: 'How Verdact collects, uses, and protects your data.',
};

const safeguards = [
  'Gmail and Slack access starts only after user consent.',
  'Evidence searches are initiated by the merchant, not run continuously.',
  'Connected inbox or workspace data is not used to train AI models.',
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
              <DataGroup title="Gmail, if you choose to connect">
                <li>Email message content and metadata from your connected Gmail account</li>
                <li>We read emails only when you initiate an evidence search for a specific dispute</li>
                <li>We do not read, store, or scan your inbox continuously or in the background</li>
              </DataGroup>

              <DataGroup title="Slack, if you choose to connect">
                <li>Message content from channels you explicitly authorize</li>
                <li>We read messages only when you initiate an evidence search for a specific dispute</li>
              </DataGroup>

              <DataGroup title="Stripe, required">
                <li>Dispute records, transaction data, and early fraud warning events via Stripe OAuth</li>
              </DataGroup>

              <DataGroup title="Account data">
                <li>Name, email address, and login credentials for your Verdact account</li>
              </DataGroup>
            </PolicySection>

            <PolicySection title="3. How We Use Your Data">
              <p>We use your data solely to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Identify relevant evidence for a chargeback dispute you are actively working on</li>
                <li>Prepare dispute evidence drafts for merchant review</li>
                <li>Calculate and display estimated VAMP exposure</li>
                <li>Send transactional notifications about dispute deadlines and outcomes</li>
              </ul>
              <p className="mt-4 font-semibold text-[#172033]">We do not:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Sell your data to third parties</li>
                <li>Use your Gmail or Slack data to train AI models</li>
                <li>Access your Gmail or Slack outside of an active evidence search you initiate</li>
                <li>Share your data with any party other than Stripe and the infrastructure providers listed in Section 5</li>
              </ul>
            </PolicySection>

            <PolicySection title="4. Data Storage and Security">
              <ul className="list-disc space-y-2 pl-5">
                <li>All data is stored in encrypted databases using AES-256 at rest</li>
                <li>Gmail and Slack access tokens are encrypted and never stored in plain text</li>
                <li>Evidence extracted from Gmail and Slack is deleted within 90 days of dispute resolution</li>
                <li>We use Supabase for database infrastructure and Vercel for hosting</li>
              </ul>
            </PolicySection>

            <PolicySection title="5. Third-Party Services">
              <p>We share data with the following services only as necessary to operate the platform:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Stripe - dispute submission and transaction data</li>
                <li>Supabase - database storage</li>
                <li>Vercel - hosting infrastructure</li>
                <li>Anthropic - AI evidence drafting</li>
                <li>Resend - transactional email delivery</li>
              </ul>
            </PolicySection>

            <PolicySection title="6. Google API Data">
              <div className="rounded-md border border-[#bdd9d3] bg-[#f2faf7] p-4">
                <p>
                  Our use of data received from Google APIs complies with the{' '}
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
                <li>We only request Gmail access when a user explicitly initiates an evidence search</li>
                <li>Gmail data is used only to identify dispute-relevant emails such as service delivery proof, usage confirmations, refund-policy references, and customer communications</li>
                <li>We do not use Gmail data for advertising or to build user profiles</li>
                <li>We do not allow humans to read your Gmail data except where you have given explicit consent or where required by law</li>
              </ul>
            </PolicySection>

            <PolicySection title="7. Your Rights">
              <p>You may at any time:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Disconnect Gmail: Google Account &rarr; Security &rarr; Third-party apps &rarr; Verdact &rarr; Remove access</li>
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
                <li>Raw Gmail or Slack imports not included in an evidence record: deleted within 90 days of dispute resolution</li>
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
