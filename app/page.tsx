import { VerdactLogo } from './_components/verdact-logo';

export const metadata = {
  title: 'Verdact | Know what you can prove before you fight the dispute',
  description:
    'Verdact builds a source-linked evidence record from Stripe, Gmail, and Slack, then shows Stripe SaaS and service merchants what is missing before they file.',
};

export default function Home() {
  return (
    <main className="bg-surface min-h-screen text-ink">
      <Header />

      <section className="relative overflow-hidden border-b border-rule">
        <div className="record-field absolute inset-0 opacity-75" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[78svh] w-full max-w-[1200px] flex-col justify-between gap-12 px-6 py-14 md:px-10 md:py-20">
          <div className="max-w-4xl">
            <p className="label-mono text-accent">Dispute evidence for Stripe</p>
            <h1 className="font-display-light mt-6 max-w-5xl text-[3rem] leading-[1.03] text-ink md:text-[5.2rem]">
              Know what you can prove before you fight the dispute.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft">
              Verdact builds a source-linked evidence record from Stripe, Gmail, and Slack, then shows you what is missing before you file.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a className="btn-primary" href="/signup">
                Create workspace
              </a>
              <a className="btn-secondary" href="/login">
                Sign in
              </a>
              <span className="text-sm text-ink-mute">
                You see the full case before anything goes to the bank.
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
              See the full case before you commit to it.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft">
              Verdact assembles the source-linked record, names the proof you do not have yet, and lets you decide what goes to the bank. Paid subscribers can let eligible filings run automatically, or review the full packet and click submit.
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
            <p className="label-mono">Why Verdact</p>
            <h2 className="font-display-light mt-5 text-[2.2rem] leading-[1.12] text-ink md:text-[3rem]">
              Walk in knowing your case, not guessing at it.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-ink-soft">
              Verdact does not predict whether you will win. It shows you what you can actually prove for this reason code, so you decide with the full picture in front of you.
            </p>
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
              Ready to see what you can prove?
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
          <p className="label-mono text-ink-soft uppercase text-xs">Evidence Record</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            Acme Corp · services not rendered
          </p>
        </div>
        <div className="mt-3 text-right sm:mt-0">
          <p className="text-2xl font-bold text-ink">$4,800</p>
          <p className="label-mono text-ink-soft uppercase text-[0.65rem] mt-1 tracking-widest">Visa · 13.1</p>
        </div>
      </div>

      <div className="px-6 py-8 text-base leading-relaxed text-ink-soft space-y-5">
        <div className="flex items-start gap-3">
          <span className="pill-trust mt-0.5 shrink-0">Stripe</span>
          <p className="text-ink">Payment confirmed, IP match, one prior transaction.</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="pill-trust mt-0.5 shrink-0">Gmail</span>
          <p className="text-ink">Delivery confirmation email, sent before the dispute.</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="pill-trust mt-0.5 shrink-0">Slack</span>
          <p className="text-ink">Client message: &ldquo;Looks good, ship it.&rdquo;</p>
        </div>
        <div
          className="flex items-start gap-3 rounded-sm border px-3 py-3"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'color-mix(in oklab, var(--accent) 40%, transparent)',
          }}
        >
          <span className="pill-accent mt-0.5 shrink-0">Missing</span>
          <p className="text-ink">
            Found a gap. Issuers expect a formal acceptance record for service disputes. You can close it before you file.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center border-t border-rule bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="pill-neutral">Needs one more proof</span>
          <span className="label-mono text-ink-soft text-xs">3 of 4 checks pass</span>
        </div>
        <span className="label-mono text-ink-mute text-xs">Nothing sent until you approve</span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    idx: '01',
    title: 'Connect Stripe, Gmail, and Slack.',
    body: 'Secure OAuth. Verdact detects disputes and VAMP risk, then prepares the evidence workflow.',
  },
  {
    idx: '02',
    title: 'We build the source-linked record.',
    body: 'Stripe data, communications, usage, and policies are mapped to the claim, and each item links back to where it came from so you can verify the proof yourself.',
  },
  {
    idx: '03',
    title: 'See what is missing, then file.',
    body: 'Verdact names the proof you do not have yet for the reason code. Paid plans unlock auto-file or review-then-submit; without a subscription, export the packet and file manually.',
  },
] as const;

const QUIET_THINGS = [
  {
    num: 'i',
    title: 'See the whole case before you commit.',
    body: 'Every item is laid out as a record you read, check, and approve. You know exactly what is going to the bank, because you decide what goes. Verdact never files behind your back.',
  },
  {
    num: 'ii',
    title: 'Every claim traces back to a source.',
    body: 'Verdact assembles the record from the systems your delivery actually happens in, then links each item to where it came from. You verify the proof yourself rather than take it on faith.',
  },
  {
    num: 'iii',
    title: 'Know what is missing before it costs you.',
    body: 'For the specific reason code, Verdact names the proof you do not have yet, so a gap is something you can close before filing instead of a surprise you discover after you lose.',
  },
] as const;
