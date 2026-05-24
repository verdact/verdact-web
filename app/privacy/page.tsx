export const metadata = {
  title: 'Privacy Policy — Verdact',
  description: 'How Verdact collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: May 23, 2026</p>

      <div className="space-y-10">

        <section>
          <h2 className="text-xl font-semibold mb-2">1. Who We Are</h2>
          <p>Verdact is a chargeback dispute management platform for Stripe merchants. We help merchants monitor dispute-rate risk and prepare processor-ready dispute packets for Stripe submission.</p>
          <p className="mt-2">Contact: <a href="mailto:admin@verdact.io" className="text-blue-600 underline">admin@verdact.io</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Data We Collect</h2>

          <p className="font-medium mt-3">Gmail (if you choose to connect):</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Email message content and metadata from your connected Gmail account</li>
            <li>We read emails only when you initiate an evidence search for a specific dispute</li>
            <li>We do not read, store, or scan your inbox continuously or in the background</li>
          </ul>

          <p className="font-medium mt-4">Slack (if you choose to connect):</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Message content from channels you explicitly authorize</li>
            <li>We read messages only when you initiate an evidence search for a specific dispute</li>
          </ul>

          <p className="font-medium mt-4">Stripe (required):</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Dispute records, transaction data, and early fraud warning events via Stripe OAuth</li>
          </ul>

          <p className="font-medium mt-4">Account data:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Name, email address, and login credentials for your Verdact account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. How We Use Your Data</h2>
          <p>We use your data solely to:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Identify relevant evidence for a chargeback dispute you are actively working on</li>
            <li>Generate a dispute rebuttal submission to Stripe after your approval</li>
            <li>Calculate and display estimated VAMP exposure</li>
            <li>Send transactional notifications about dispute deadlines and outcomes</li>
          </ul>
          <p className="mt-3">We do not:</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Sell your data to third parties</li>
            <li>Use your Gmail or Slack data to train AI models</li>
            <li>Access your Gmail or Slack outside of an active evidence search you initiate</li>
            <li>Share your data with any party other than Stripe and the infrastructure providers listed in Section 5</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Data Storage and Security</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>All data is stored in encrypted databases (AES-256 at rest)</li>
            <li>Gmail and Slack access tokens are encrypted and never stored in plain text</li>
            <li>Evidence extracted from Gmail and Slack is deleted within 90 days of dispute resolution</li>
            <li>We use Supabase for database infrastructure and Vercel for hosting</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Third-Party Services</h2>
          <p>We share data with the following services only as necessary to operate the platform:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Stripe — dispute submission and transaction data</li>
            <li>Supabase — database storage</li>
            <li>Vercel — hosting infrastructure</li>
            <li>Anthropic — AI evidence drafting</li>
            <li>Resend — transactional email delivery</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">6. Google API Data</h2>
          <p>
            Our use of data received from Google APIs complies with the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements:
          </p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>We only request Gmail access when a user explicitly initiates an evidence search</li>
            <li>Gmail data is used only to identify dispute-relevant emails such as service delivery proof, usage confirmations, refund-policy references, and customer communications</li>
            <li>We do not use Gmail data for advertising or to build user profiles</li>
            <li>We do not allow humans to read your Gmail data except where you have given explicit consent or where required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. Your Rights</h2>
          <p>You may at any time:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Disconnect Gmail: Google Account &rarr; Security &rarr; Third-party apps &rarr; Verdact &rarr; Remove access</li>
            <li>Disconnect Slack: Slack admin settings &rarr; Installed apps &rarr; Verdact &rarr; Remove</li>
            <li>Disconnect Stripe: Verdact dashboard &rarr; Settings &rarr; Integrations &rarr; Disconnect</li>
            <li>Request data deletion: email <a href="mailto:admin@verdact.io" className="text-blue-600 underline">admin@verdact.io</a> with subject "Data Deletion Request" — processed within 30 days</li>
            <li>Request data export: email <a href="mailto:admin@verdact.io" className="text-blue-600 underline">admin@verdact.io</a> with subject "Data Export Request"</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">8. Data Retention</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Active account data: retained while your account is active</li>
            <li>Raw Gmail/Slack imports not included in a submitted evidence packet: deleted within 90 days of dispute resolution</li>
            <li>Submitted evidence packets: retained for at least 24 months or longer where card-network, legal, tax, fraud-prevention, or audit obligations require it</li>
            <li>Customer PII in retained records: redacted on valid deletion request where retention rules allow</li>
            <li>Account data after deletion request: purged or de-identified within 30 days unless retention rules require preservation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">9. Changes to This Policy</h2>
          <p>We will notify you by email at the address on your account before making material changes to this policy.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">10. Contact</h2>
          <p>Questions about this policy: <a href="mailto:admin@verdact.io" className="text-blue-600 underline">admin@verdact.io</a></p>
        </section>

      </div>
    </main>
  );
}
