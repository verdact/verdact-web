import { VerdactLogo } from './_components/verdact-logo';

export const metadata = {
  title: 'Verdact | Dispute-ready evidence for Stripe merchants',
  description:
    'Verdact helps Stripe SaaS and digital-service merchants track dispute risk, prepare source-linked evidence, and choose paid, merchant-controlled filing modes.',
};

export default function Home() {
  return (
    <main className="bg-surface min-h-screen text-ink">
      <Header />

      <section className="relative overflow-hidden border-b border-rule">
        <div className="record-field absolute inset-0 opacity-75" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[78svh] w-full max-w-[1200px] flex-col justify-between gap-12 px-6 py-14 md:px-10 md:py-20">
          <div className="max-w-4xl">
            <p className="label-mono text-accent">For Stripe SaaS and service merchants</p>
            <h1 className="font-display-light mt-6 max-w-5xl text-[3rem] leading-[1.03] text-ink md:text-[5.2rem]">
              You shouldn't have to lose money on disputes you should win.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft">
              Verdact tracks dispute risk, prepares source-linked evidence, and gives paid workspaces two filing modes: auto-file, or review the packet and submit.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a className="btn-primary" href="/signup">
                Create workspace
              </a>
              <a className="btn-secondary" href="/login">
                Sign in
              </a>
              <span className="text-sm text-ink-mute">
                Paid filing automation. Merchant-controlled.
              </span>
            </div>
          </div>

          <HeroEvidencePacket />
        </div>
      </section>

      <section className="border-b border-rule bg-surface-2">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-18 md:px-10">
          <div className="max-w-2xl">
            <p className="label-mono">How it works</p>
            <h2 className="font-display-light mt-5 text-[2.2rem] leading-[1.12] text-ink md:text-[3rem]">
              Automation with controls at every step.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft">
              Verdact prepares the evidence record automatically. Paid subscribers can let eligible filings run automatically, or review the full packet and click submit.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div className="surface-card p-6" key={step.idx}>
                <span className="label-mono text-accent">{step.idx}</span>
                <p className="mt-4 text-lg font-semibold leading-snug text-ink">
                  {step.title}
                </p>
                <p className="mt-3 text-base leading-7 text-ink-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-18 md:px-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="label-mono">What you get</p>
            <h2 className="font-display-light mt-5 text-[2.2rem] leading-[1.12] text-ink md:text-[3rem]">
              The quiet things that keep you out of trouble.
            </h2>
          </div>

          <div className="surface-card overflow-hidden">
            {QUIET_THINGS.map((point) => (
              <div
                className="grid gap-4 border-b border-rule px-6 py-5 last:border-b-0 sm:grid-cols-[2rem_1fr]"
                key={point.num}
              >
                <p className="label-mono text-ink-mute">{point.num}</p>
                <div>
                  <p className="text-base font-semibold text-ink">{point.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{point.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-surface-2">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h2 className="font-display-light text-[2rem] leading-tight text-ink md:text-[2.6rem]">
              Your next dispute is already forming in Stripe.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="btn-primary" href="/signup">
              Create workspace
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="border-b border-rule bg-surface-2">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <a href="/" className="flex items-center">
          <VerdactLogo variant="lockup" priority className="h-10 w-auto" />
        </a>

        <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
          <a className="btn-ghost px-3 py-2 text-sm hidden sm:inline-flex" href="/tools/vamp-check">
            VAMP Checker
          </a>
          <a className="btn-ghost px-3 py-2 text-sm" href="/login">
            Sign in
          </a>
          <a href="/signup" className="btn-primary px-4 py-2 text-sm">
            Create workspace
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-8 md:px-10">
        <p className="label-mono text-ink-mute">© 2026 Verdact</p>
        <div className="flex flex-wrap items-center gap-5 text-sm text-ink-mute">
          <a className="hover:text-ink" href="/privacy">
            Privacy
          </a>
          <a className="hover:text-ink" href="/terms">
            Terms
          </a>
          <a className="hover:text-ink" href="mailto:admin@verdact.io">
            admin@verdact.io
          </a>
        </div>
      </div>
    </footer>
  );
}

function HeroEvidencePacket() {
  return (
    <div className="record-slat overflow-hidden border border-rule-strong bg-surface-paper shadow-sm max-w-3xl rounded-md">
      <div className="grid border-b border-rule bg-surface-2 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="label-mono text-ink-soft uppercase text-xs">Evidence Packet</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            Marcus Kim · annual plan
          </p>
        </div>
        <div className="mt-3 text-right sm:mt-0">
          <p className="text-2xl font-bold text-ink">$4,800</p>
          <p className="label-mono text-ink-soft uppercase text-[0.65rem] mt-1 tracking-widest">Visa · 10.4</p>
        </div>
      </div>

      <div className="px-6 py-8 text-base leading-relaxed text-ink-soft space-y-6">
        <p>
          On March 14, the customer{' '}
          <span
            className="px-1.5 py-0.5 rounded-sm border"
            style={{
              background: 'var(--trust-soft)',
              borderColor: 'color-mix(in oklab, var(--trust) 40%, transparent)',
              color: 'var(--ink)',
            }}
          >
            confirmed delivery in writing
          </span>{' '}
          and used the product daily through April 18. The dispute was filed 134 days later.
        </p>
        <p>
          Per the refund policy acknowledged at checkout, annual plans are{' '}
          <span
            className="px-1.5 py-0.5 rounded-sm border"
            style={{
              background: 'var(--trust-soft)',
              borderColor: 'color-mix(in oklab, var(--trust) 40%, transparent)',
              color: 'var(--ink)',
            }}
          >
            non-refundable after 30 days
          </span>
          .
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center border-t border-rule bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="pill-trust">Ready to file</span>
          <span className="label-mono text-ink-soft text-xs">8 of 9 checks pass</span>
        </div>
        <span className="label-mono text-ink-mute text-xs">14 pp · 3.2 MB</span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    idx: '01',
    title: 'Connect Stripe.',
    body: 'Secure OAuth. Verdact detects disputes and VAMP risk, then prepares the filing workflow.',
  },
  {
    idx: '02',
    title: 'We assemble source-linked evidence.',
    body: 'Stripe data, usage logs, policies, support history, and selected communications are mapped to the claim.',
  },
  {
    idx: '03',
    title: 'Choose the filing mode.',
    body: 'Paid plans unlock auto-file or review-then-submit. Without an active subscription, export the packet and file manually.',
  },
] as const;

const QUIET_THINGS = [
  {
    num: 'i',
    title: 'A warning before the bank gives you one.',
    body: "We watch your dispute ratio across your settlement window. If it starts trending toward Visa's warning threshold, you'll know weeks in advance.",
  },
  {
    num: 'ii',
    title: 'Every packet checked against the latest rules.',
    body: "Stripe's Compelling Evidence 3.0 has specific criteria. Each packet is pre-flighted against all of them in plain English.",
  },
  {
    num: 'iii',
    title: 'Paid automation with guardrails.',
    body: 'File-size limits, page counts, broken links, and missing fields are checked before auto-file or review-then-submit runs.',
  },
] as const;
