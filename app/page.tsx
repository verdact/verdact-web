import { VerdactLogo } from './_components/verdact-logo';
import { ThemeToggle } from './_components/theme-toggle';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  LockIcon,
  XIcon,
} from './_components/home-icons';

export const metadata = {
  title: 'Verdact | Know what you can prove before you fight the dispute',
  description:
    'Verdact builds a source-linked evidence record from Stripe, Gmail, and Slack, then shows Stripe SaaS and service merchants what is missing before they file.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <Header />
      <Hero />
      <WhoItIsFor />
      <Differentiators />
      <ProductShowcase />
      <VampBand />
      <TrustSignals />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */
function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1160px] items-center gap-6 px-6 py-3 md:px-8">
        <a href="/" className="flex items-center">
          <VerdactLogo variant="lockup" priority className="h-9 w-auto" />
        </a>

        <nav
          className="ml-2 hidden items-center gap-1 text-sm md:flex"
          aria-label="Primary"
        >
          {[
            { href: '#who', label: 'Who it is for' },
            { href: '#how', label: 'How it works' },
            { href: '#vamp', label: 'VAMP' },
          ].map((link) => (
            <a
              key={link.href}
              className="rounded-md px-2.5 py-2 text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <span className="flex-1" />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a className="btn-ghost hidden px-3 py-2 text-sm sm:inline-flex" href="/login">
            Log in
          </a>
          <a className="btn-primary px-4 py-2 text-sm" href="/signup">
            Create workspace
          </a>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* 1 · Hero                                                           */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-rule grid-bg">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 80% at 18% 0%, transparent 30%, color-mix(in oklab, var(--surface) 96%, transparent) 78%)',
        }}
      />
      <div className="relative mx-auto grid w-full max-w-[1160px] items-center gap-12 px-6 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="eyebrow">Dispute evidence for Stripe</p>
          <h1 className="font-display mt-5 max-w-[16ch] text-[clamp(2.4rem,5.4vw,3.9rem)] font-semibold leading-[1.03] tracking-[-0.025em] text-ink">
            Know what you can{' '}
            <em className="italic text-action">prove</em> before you fight the dispute.
          </h1>
          <p className="mt-6 max-w-[50ch] text-lg leading-[1.6] text-ink-soft">
            Verdact builds a source-linked evidence record from Stripe, Gmail, and
            Slack, then shows you what is missing before you file.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a className="btn-primary" href="/signup">
              Create workspace
            </a>
            <a className="btn-secondary" href="/login">
              Log in
            </a>
          </div>
          <p
            className="mt-6 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              letterSpacing: '0.06em',
              color: 'var(--ink-mute)',
            }}
          >
            <CheckIcon className="h-[15px] w-[15px] text-trust" />
            <span className="font-semibold text-trust">Merchant-approved.</span>
            You see the full case before anything goes to the bank.
          </p>
        </div>

        <HeroEvidenceCard />
      </div>
    </section>
  );
}

// Hero evidence-record card preview: Stripe / Gmail / Slack confirmed items
// plus one red "Missing" gap, on the red diagonal-hatch surface.
function HeroEvidenceCard() {
  return (
    <div
      className="surface-card overflow-hidden"
      style={{ transform: 'rotate(-0.5deg)', boxShadow: 'var(--shadow-elev-2)' }}
    >
      <div
        className="h-[5px]"
        style={{
          background:
            'linear-gradient(90deg, var(--action) 0 60%, var(--trust) 60% 100%)',
        }}
      />
      <div className="flex items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <p className="font-display text-[15px] font-semibold text-ink">
            Evidence Record
          </p>
          <p className="label-mono mt-1.5">Acme Corp · Services not rendered</p>
        </div>
        <span className="chip-rc">RC 13.1</span>
      </div>

      <div className="px-5 pb-3 pt-1">
        <HeroRow tag="stripe" label="STRIPE" text="Payment confirmed · IP match" />
        <HeroRow tag="gmail" label="GMAIL" text="Delivery confirmation, Jun 2" />
        <HeroRow
          tag="slack"
          label="SLACK"
          text="Client: &ldquo;Looks good, ship it&rdquo;"
        />

        {/* MISSING gap */}
        <div className="flex items-start gap-3 py-3">
          <span className="status-dot miss mt-0.5 h-[18px] w-[18px]">
            <AlertCircleIcon className="h-[11px] w-[11px]" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="src-tag missing">MISSING</span>
            <p className="mt-1.5 text-[13px] font-medium leading-[1.4] text-accent">
              Customer acceptance of deliverable
            </p>
            <div className="surface-missing -mx-5 -mb-3 mt-2 flex items-start gap-2.5 border-t px-5 py-3">
              <span className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full bg-accent text-[#fff]">
                <AlertCircleIcon className="h-3 w-3" />
              </span>
              <span className="text-xs leading-[1.4] text-accent-deep">
                <span className="font-semibold text-accent">Found a gap.</span> Issuers
                expect a formal acceptance record for service disputes. You can close it
                before you file.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroRow({
  tag,
  label,
  text,
}: {
  tag: 'stripe' | 'gmail' | 'slack';
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-rule py-3">
      <span className="status-dot ok mt-px h-[18px] w-[18px]">
        <CheckIcon className="h-[11px] w-[11px]" />
      </span>
      <div className="min-w-0">
        <span className={`src-tag ${tag}`}>{label}</span>
        <p
          className="mt-1.5 text-[13px] font-medium leading-[1.4] text-ink"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Who it is for                                                  */
/* ------------------------------------------------------------------ */
function WhoItIsFor() {
  return (
    <section id="who" className="border-b border-rule bg-surface-2">
      <div className="mx-auto w-full max-w-[1160px] px-6 py-20 md:px-8">
        <div className="max-w-[62ch]">
          <p className="eyebrow">Who it is for</p>
          <h2 className="section-heading mt-4">
            Built for businesses that have to prove delivery, not shipping.
          </h2>
          <p className="section-dek mt-4">
            Stripe SaaS founders and service businesses, where the proof of work done
            lives in conversations and accounts rather than a tracking number. Verdact
            gathers that proof into one place so you can see exactly where your case
            stands.
          </p>
        </div>

        <div className="mt-10 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-wrap gap-2.5">
            {WHO_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-rule-strong bg-surface px-3.5 py-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-soft)',
                }}
              >
                {chip.strong ? (
                  <span className="font-semibold text-ink">{chip.strong}</span>
                ) : null}
                {chip.strong ? ' ' : ''}
                {chip.label}
              </span>
            ))}
          </div>
          <blockquote
            className="font-display text-[clamp(1.15rem,2vw,1.35rem)] leading-[1.4] tracking-[-0.01em] text-ink"
            style={{ borderLeft: '3px solid var(--action)', padding: '0.4rem 0 0.4rem 1.4rem' }}
          >
            If your proof lives in <span className="text-action">Slack threads</span> and{' '}
            <span className="text-action">email chains</span>, you should be able to see
            all of it before you decide to fight.
          </blockquote>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Differentiators                                               */
/* ------------------------------------------------------------------ */
function Differentiators() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto w-full max-w-[1160px] px-6 py-20 md:px-8">
        <div className="max-w-[62ch]">
          <p className="eyebrow">Why Verdact</p>
          <h2 className="section-heading mt-4">
            Walk in knowing your case, not guessing at it.
          </h2>
          <p className="section-dek mt-4">
            Verdact does not predict whether you will win. It shows you what you can
            actually prove for this reason code, so you decide with the full picture in
            front of you.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <article className="surface-card-flat p-7">
            <span className="label-mono text-action">01</span>
            <h3 className="font-display mt-4 text-[21px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              See the whole case before you commit
            </h3>
            <p className="mt-3 text-sm leading-[1.6] text-ink-soft">
              Every item is laid out as a document you read, check, and approve. You know
              exactly what is going to the bank, because you decide what goes. Verdact
              never files behind your back.
            </p>
          </article>

          <article className="surface-card-flat p-7">
            <span className="label-mono text-action">02</span>
            <h3 className="font-display mt-4 text-[21px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              Every claim traces back to a source
            </h3>
            <p className="mt-3 text-sm leading-[1.6] text-ink-soft">
              Verdact assembles the record from the systems your delivery actually happens
              in, then links each item to where it came from. You can verify the proof
              yourself rather than take it on faith.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {['STRIPE', 'GMAIL', 'SLACK', 'TERMS OF SERVICE'].map((s) => (
                <span
                  key={s}
                  className="rounded-[3px] border border-rule px-1.5 py-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.06em',
                    color: 'var(--ink-mute)',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </article>

          <article
            className="surface-card-flat p-7"
            style={{ borderTop: '3px solid var(--action)' }}
          >
            <span className="label-mono text-action">03</span>
            <h3 className="font-display mt-4 text-[21px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              Know what is missing before it costs you
            </h3>
            <p className="mt-3 text-sm leading-[1.6] text-ink-soft">
              For the specific reason code, Verdact names the proof you do not have yet, so
              a gap is something you can confirm and close before filing, not a surprise
              you discover after you lose.
            </p>
            <span className="pill-action mt-4">
              <AlertCircleIcon className="h-[13px] w-[13px]" />
              Names the missing proof
            </span>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · Product showcase — the evidence record                        */
/* ------------------------------------------------------------------ */
function ProductShowcase() {
  return (
    <section id="how" className="surface-slate border-b border-rule">
      <div className="mx-auto w-full max-w-[1160px] px-6 py-20 md:px-8">
        <div className="max-w-[62ch]">
          <p className="eyebrow" style={{ color: '#aab6c6' }}>
            The evidence record
          </p>
          <h2 className="section-heading mt-4" style={{ color: '#fff' }}>
            One dispute. Every piece of proof, in front of you.
          </h2>
          <p className="section-dek mt-4" style={{ color: '#aab6c6' }}>
            A real reason-code 13.1 dispute, assembled and source-tagged. Green is
            confirmed. Red is the gap you need to close before you file. Status is
            labelled in words, not color alone.
          </p>
        </div>

        <figure className="mt-11">
          <div
            className="overflow-hidden rounded-[10px] border"
            style={{ borderColor: '#334155', boxShadow: '0 40px 90px -40px rgba(0,0,0,.6)' }}
          >
            {/* browser bar */}
            <div
              className="flex h-10 items-center gap-2 border-b px-4"
              style={{ background: '#0f172a', borderColor: '#1e293b' }}
            >
              <span className="h-[11px] w-[11px] rounded-full" style={{ background: '#334155' }} />
              <span className="h-[11px] w-[11px] rounded-full" style={{ background: '#334155' }} />
              <span className="h-[11px] w-[11px] rounded-full" style={{ background: '#334155' }} />
              <span
                className="ml-3.5 rounded-[5px] border px-3 py-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  color: '#8493a6',
                  background: '#0b1220',
                  borderColor: '#1e293b',
                }}
              >
                app.verdact.com / disputes / DSP-4471
              </span>
            </div>

            <SampleEvidencePacket />
          </div>
        </figure>
      </div>
    </section>
  );
}

// The sample evidence-packet preview: full-width source-tagged record with a
// confirmed list, the missing milestone row, a pre-submission QA side panel
// with VAMP exposure, and the approve/export/submit footer.
function SampleEvidencePacket() {
  return (
    <div className="bg-surface-2">
      {/* dispute strip */}
      <div className="flex flex-wrap items-center gap-4 border-b border-rule-strong bg-surface px-6 py-4">
        <span className="label-mono">
          Dispute <span className="chip-rc mx-1">RC 13.1</span> Services Not Rendered
        </span>
        <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
          Acme Corp
        </h3>
        <span className="font-display text-[17px] font-semibold text-ink">$1,840</span>
        <span className="flex-1" />
        <span className="label-mono">Respond by Jun 14</span>
        <span className="pill-warning">Needs response</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* main evidence list */}
        <div className="px-6 py-2">
          <PacketRow
            tag="stripe"
            label="STRIPE"
            when="May 18"
            text="Payment confirmed · IP match · 1 prior transaction"
            rel="Establishes a known, returning customer on a consistent device."
          />
          <PacketRow
            tag="gmail"
            label="GMAIL"
            when="Jun 2"
            text="Delivery confirmation email, Jun 2"
            rel="Direct evidence the service was delivered before the dispute."
          />
          <PacketRow
            tag="slack"
            label="SLACK"
            when="Jun 3"
            text="Client message: &ldquo;Looks good, ship it&rdquo;"
            rel="Customer acknowledges the work in their own words."
          />

          {/* MISSING row */}
          <div className="surface-missing -mx-6 my-1.5 grid grid-cols-[18px_1fr] gap-3 border-y px-6 py-4">
            <span className="status-dot miss mt-px h-[18px] w-[18px]">
              <AlertCircleIcon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="src-tag missing">MISSING · REQUIRED</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--ink-faint)',
                  }}
                >
                  Not found in your sources
                </span>
              </div>
              <p className="font-display text-[15px] font-semibold text-accent">
                Milestone sign-off document
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] text-accent-deep">
                Issuers expect a formal acceptance record for service-delivery disputes.
              </p>
              <div className="mt-3 flex items-start gap-2.5 rounded-[4px] bg-accent px-3 py-2.5 text-[#fff]">
                <span className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full border border-[rgba(255,255,255,.7)]">
                  <AlertCircleIcon className="h-3 w-3" />
                </span>
                <span className="text-[12.5px] leading-[1.4]">
                  <span className="font-semibold">This gap weakens the record.</span> Add
                  a signed acceptance artifact before you file.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* side QA + VAMP */}
        <div className="border-t border-rule bg-surface px-5 py-5 lg:border-l lg:border-t-0">
          <p className="label-mono-strong mb-3.5">Pre-submission QA</p>
          <QaRow tone="ok" text="Reason code matched" />
          <QaRow tone="ok" text="Delivery timeline intact" />
          <QaRow tone="ok" text="Customer identity corroborated" />
          <QaRow tone="warn" text="Formal acceptance record missing" />

          <div className="mt-4 border-t border-rule pt-3.5">
            <p className="label-mono-strong mb-2">VAMP exposure</p>
            <p className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
              0.09%
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-ink-soft">
              added to your ratio. Every dispute is a ratio event.
            </p>
            <p
              className="mt-2.5 rounded-[4px] border border-rule bg-surface px-2.5 py-2"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: 1.5,
                color: 'var(--ink-soft)',
              }}
            >
              Non-fraud (services) dispute, outside Compelling Evidence 3.0. CE 3.0 applies
              only to Visa card-absent fraud (10.4).
            </p>
          </div>
        </div>
      </div>

      {/* footer */}
      <div
        className="flex flex-wrap items-center gap-4 px-6 py-3.5"
        style={{ background: '#0f172a', color: '#aab6c6' }}
      >
        <span
          className="grid h-7 w-7 flex-none place-items-center rounded-md border"
          style={{ background: '#1e293b', borderColor: '#334155', color: '#60a5fa' }}
        >
          <LockIcon className="h-[15px] w-[15px]" />
        </span>
        <span className="min-w-[200px] flex-1 text-[12.5px]">
          <span className="font-semibold" style={{ color: '#e7edf4' }}>
            Nothing is sent until you approve.
          </span>{' '}
          Export or review and submit when the record is ready.
        </span>
        <span
          className="inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[12.5px] font-semibold"
          style={{ color: '#e7edf4', borderColor: '#3a4b60' }}
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Export evidence
        </span>
        <span
          className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[12.5px] font-semibold text-[#fff]"
          style={{ background: 'var(--action)' }}
        >
          Review &amp; submit
          <span
            className="rounded-[3px] px-1.5 py-0.5"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,.18)',
            }}
          >
            Paid
          </span>
        </span>
      </div>
    </div>
  );
}

function PacketRow({
  tag,
  label,
  when,
  text,
  rel,
}: {
  tag: 'stripe' | 'gmail' | 'slack';
  label: string;
  when: string;
  text: string;
  rel: string;
}) {
  return (
    <div className="grid grid-cols-[18px_1fr_auto] items-start gap-3 border-b border-rule py-4">
      <span className="status-dot ok mt-px h-[18px] w-[18px]">
        <CheckIcon className="h-3 w-3" />
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className={`src-tag ${tag}`}>{label}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--ink-faint)',
            }}
          >
            {when}
          </span>
        </div>
        <p
          className="text-[13px] font-medium leading-[1.4] text-ink"
          dangerouslySetInnerHTML={{ __html: text }}
        />
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-mute">{rel}</p>
      </div>
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-trust-rule bg-trust-soft px-2 py-1.5"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--trust)',
        }}
      >
        <CheckIcon className="h-3 w-3" />
        Approved
      </span>
    </div>
  );
}

function QaRow({ tone, text }: { tone: 'ok' | 'warn'; text: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-rule py-2.5 text-[12.5px] text-ink last:border-b-0">
      <span
        className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-[4px] text-[#fff]"
        style={{ background: tone === 'ok' ? 'var(--trust)' : 'var(--warning)' }}
      >
        {tone === 'ok' ? (
          <CheckIcon className="h-3 w-3" />
        ) : (
          <AlertTriangleIcon className="h-3 w-3" />
        )}
      </span>
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 · VAMP awareness band                                           */
/* ------------------------------------------------------------------ */
function VampBand() {
  return (
    <section id="vamp" className="surface-slate border-b border-rule">
      <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-10 px-6 py-14 md:px-8">
        <div className="min-w-[280px] flex-1">
          <p className="eyebrow" style={{ color: '#aab6c6' }}>
            VAMP awareness
          </p>
          <h2
            className="font-display mt-3.5 text-[clamp(1.6rem,3.4vw,2.25rem)] font-semibold leading-[1.12] tracking-[-0.02em]"
            style={{ color: '#fff' }}
          >
            One dispute is not just a refund. It is a{' '}
            <em style={{ fontStyle: 'italic', color: '#93c5fd' }}>ratio event.</em>
          </h2>
          <a
            className="mt-5 inline-flex items-center gap-2.5 rounded-sm pb-1 transition-colors hover:text-[#bfdbfe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
            href="/tools/vamp-check"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12.5px',
              letterSpacing: '0.04em',
              color: '#93c5fd',
              borderBottom: '1px solid #1e3a8a',
            }}
          >
            Run a VAMP check on your account &rarr;
          </a>
        </div>

        <div
          className="w-[260px] flex-none rounded-[10px] border p-5"
          style={{ background: '#0b1220', borderColor: '#1e293b' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#8493a6',
            }}
          >
            Your VAMP ratio
          </p>
          <p
            className="font-display my-1.5 text-[30px] font-semibold tracking-[-0.02em]"
            style={{ color: '#fff' }}
          >
            0.09%
          </p>
          <div
            className="my-3 h-2 overflow-hidden rounded-full"
            style={{ background: '#1e293b' }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: '6%', background: '#34d399' }}
            />
          </div>
          <div
            className="flex justify-between"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.04em',
              color: '#64748b',
            }}
          >
            <span>0</span>
            <span>Threshold 1.50%</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6 · Trust signals + permission block                              */
/* ------------------------------------------------------------------ */
function TrustSignals() {
  return (
    <section className="border-b border-rule bg-surface-2">
      <div className="mx-auto w-full max-w-[1160px] px-6 py-20 md:px-8">
        <div className="max-w-[62ch]">
          <p className="eyebrow">How we handle it</p>
          <h2 className="section-heading mt-4">
            Serious about your data and your one filing.
          </h2>
        </div>

        <div className="mt-11 grid overflow-hidden rounded-lg border border-rule-strong bg-surface md:grid-cols-3">
          {TRUST_CELLS.map((cell, i) => (
            <div
              key={cell.title}
              className={`px-7 py-8 ${i < TRUST_CELLS.length - 1 ? 'border-b border-rule md:border-b-0 md:border-r' : ''}`}
            >
              <span className="mb-4 grid h-9 w-9 place-items-center rounded-lg border border-action-rule bg-action-soft text-action">
                {cell.icon}
              </span>
              <h4 className="font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                {cell.title}
              </h4>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-soft">{cell.body}</p>
            </div>
          ))}
        </div>

        {/* connect-permission: what we read / what we don't */}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <PermissionCard
            variant="read"
            heading="What we read"
            items={READ_ITEMS}
          />
          <PermissionCard
            variant="nope"
            heading="What we do not do"
            items={NOPE_ITEMS}
          />
        </div>
      </div>
    </section>
  );
}

function PermissionCard({
  variant,
  heading,
  items,
}: {
  variant: 'read' | 'nope';
  heading: string;
  items: string[];
}) {
  const isRead = variant === 'read';
  return (
    <div className="overflow-hidden rounded-lg border border-rule-strong bg-surface">
      <div className="flex items-center gap-2.5 border-b border-rule px-5 py-4">
        <span
          className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-md border ${
            isRead
              ? 'border-trust-rule bg-trust-soft text-trust'
              : 'border-rule-strong bg-surface-3 text-ink-mute'
          }`}
        >
          {isRead ? <EyeIcon className="h-[15px] w-[15px]" /> : <EyeOffIcon className="h-[15px] w-[15px]" />}
        </span>
        <span className="label-mono-strong">{heading}</span>
      </div>
      <ul className="px-5 py-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 border-b border-rule py-2.5 text-[13px] leading-[1.45] text-ink-soft last:border-b-0"
          >
            <span
              className={`mt-px grid h-4 w-4 flex-none place-items-center ${isRead ? 'text-trust' : 'text-ink-mute'}`}
            >
              {isRead ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7 · Final CTA                                                      */
/* ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section className="relative overflow-hidden border-b border-rule grid-bg">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(80% 120% at 50% 0%, transparent, color-mix(in oklab, var(--surface) 95%, transparent))',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1160px] px-6 py-24 text-center md:px-8">
        <p className="eyebrow eyebrow-center">Get started</p>
        <h2 className="font-display mx-auto mt-4 max-w-[18ch] text-[clamp(2rem,4.6vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
          Ready to see what you can prove?
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a className="btn-primary" href="/signup">
            Create workspace
          </a>
          <a className="btn-secondary" href="#how">
            See how it works
          </a>
        </div>
        <p
          className="mt-6"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            letterSpacing: '0.04em',
            color: 'var(--ink-mute)',
          }}
        >
          For SaaS and service businesses on Stripe.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */
function Footer() {
  return (
    <footer className="surface-slate">
      <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-5 px-6 py-10 md:px-8">
        <VerdactLogo variant="wordmark" className="h-7 w-auto" />
        <span
          className="min-w-[220px] flex-1"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.04em',
            color: '#aab6c6',
          }}
        >
          You see every piece of evidence before it goes to the bank.
        </span>
        <nav className="flex flex-wrap gap-1 text-[12.5px]" aria-label="Footer">
          {[
            { href: '#who', label: 'Who it is for' },
            { href: '#how', label: 'How it works' },
            { href: '/tools/vamp-check', label: 'VAMP check' },
            { href: '/login', label: 'Sign in' },
          ].map((link) => (
            <a
              key={link.label}
              className="rounded-sm px-2 py-1 transition-colors hover:text-[#fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50"
              style={{ color: '#cbd5e1' }}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */
const WHO_CHIPS = [
  { strong: 'SaaS', label: 'founders' },
  { strong: null, label: 'Onboarding & implementation' },
  { strong: null, label: 'Consulting' },
  { strong: null, label: 'Agencies' },
  { strong: null, label: 'B2B services' },
  { strong: null, label: 'Subscriptions' },
] as const;

const TRUST_CELLS = [
  {
    icon: <LockIcon className="h-[18px] w-[18px]" />,
    title: 'AI-assisted. Merchant-approved.',
    body: 'No training on your inbox or workspace data. Verdact reads to assemble your record; it does not learn from it.',
  },
  {
    icon: <LinkIcon className="h-[18px] w-[18px]" />,
    title: 'Source-linked',
    body: 'Every item traces back to the record it came from, so you can verify the proof rather than trust a black box.',
  },
  {
    icon: <CheckIcon className="h-[18px] w-[18px]" />,
    title: 'One filing per dispute',
    body: 'You get a single response to the bank. Verdact treats it that way, with a QA pass before anything goes out.',
  },
] as const;

const READ_ITEMS = [
  'The Stripe charge, dispute, and customer record tied to the disputed payment.',
  'Gmail threads and Slack messages you connect, to find delivery and acceptance proof.',
  'Your posted terms of service and cancellation policy.',
];

const NOPE_ITEMS = [
  'No training on your data. Your emails and messages never become model training material.',
  'No filing without you. Nothing is submitted to the bank until you review and approve it.',
  'No inbox-wide crawling. Verdact looks only for what is relevant to the disputed payment.',
];
