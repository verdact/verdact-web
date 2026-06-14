'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { MarketingHeader } from '../marketing/marketing-header';
import { MarketingFooter } from '../marketing/marketing-footer';
import styles from '../../page.module.css';

/* ─── seals (verified ring-check / gap dashed-alert) ────────────────────── */

function SealOk({ size, stroke = 'var(--verdict)', width = 2.4 }: {
  size: number; stroke?: string; width?: number;
}) {
  return (
    <svg className={styles.seal} width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="11" stroke={stroke} strokeWidth={width} />
      <path d="M8.2 13.4l3.1 3.1 6.5-6.8" stroke={stroke} strokeWidth={width} strokeLinecap="square" />
    </svg>
  );
}

function SealGap({ size, width = 2.4 }: { size: number; width?: number }) {
  return (
    <svg className={styles.seal} width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="11" stroke="var(--gap)" strokeWidth={width} strokeDasharray="4 3.5" />
      <path d="M13 8v6" stroke="var(--gap)" strokeWidth={width} strokeLinecap="square" />
      <circle cx="13" cy="17.6" r="1.5" fill="var(--gap)" />
    </svg>
  );
}

function GapRule({ onDeep = false }: { onDeep?: boolean }) {
  return (
    <div
      className={`${styles.gaprule} ${onDeep ? styles.gapruleOndeep : ''}`}
      aria-hidden="true"
    >
      <i className={styles.g1} /><span className={styles.gx} /><i className={styles.g2} />
    </div>
  );
}

const iVar = (i: number) => ({ '--i': i } as CSSProperties);

/* ─── data ─────────────────────────────────────────────────────────────── */

const LEDGER_ROWS: { label: string; sub?: string; gap?: boolean }[] = [
  { label: 'Stripe payment confirmed' },
  { label: 'Contract / scope attached' },
  { label: 'Service delivery proof found' },
  { label: 'Client approval found' },
  { label: 'Refund policy linked' },
  { label: '+ 2 more verified', sub: '(access logs, message thread)' },
  { label: 'Missing: final acceptance note', gap: true },
];

const STEPS: { title: string; body: string; factLead: string; fact: string; gapStep?: boolean }[] = [
  {
    title: 'Connect Stripe',
    body: 'Verdact pulls the disputed charge, the reason, and the deadline so you start with the facts, not a blank form.',
    factLead: "Through Stripe's own authorization flow.",
    fact: 'You never type or share an API key, and you can disconnect anytime from your Stripe dashboard.',
  },
  {
    title: 'Build the evidence record',
    body: 'Add your scope, delivery proof, approvals, and messages. Verdact shows what is strong and what is missing while you build.',
    factLead: 'The gap is flagged early,',
    fact: 'while there is still time to add or substitute the missing piece.',
    gapStep: true,
  },
  {
    title: 'Review and file',
    body: 'Review the assembled response. Approve it and Verdact submits it through Stripe, or download the packet and file it yourself.',
    factLead: 'One response, evidence attached,',
    fact: 'matched to the reason code and ready before the deadline.',
  },
];

const MROWS: { pn: string; src: React.ReactNode; gap?: boolean }[] = [
  { pn: 'Payment', src: 'Stripe charge, captured' },
  { pn: 'Scope', src: 'Signed proposal (PDF)' },
  { pn: 'Delivery', src: '3 milestones delivered, last on Apr 12' },
  { pn: 'Access and usage', src: 'Client logins through Apr 20' },
  { pn: 'Client approval', src: <><em>&ldquo;Looks great, ship it&rdquo;</em> (message, Apr 12)</> },
  { pn: 'Communication', src: '28 messages across the project' },
  { pn: 'Policy', src: 'Refund policy accepted at checkout' },
  { pn: 'Final acceptance note', src: 'Add it or substitute it before filing', gap: true },
];

const MINIS: { label: string; chip: string; you?: boolean }[] = [
  { label: 'Disputed charge and deadline', chip: 'Stripe' },
  { label: 'Project thread imported', chip: 'Slack' },
  { label: 'Approval email uploaded', chip: 'Added by you', you: true },
  { label: 'Final acceptance note', chip: 'Added by you', you: true },
];

const CHECKS: string[] = [
  'Deadline window open',
  'Reason code matched to evidence',
  'Format and size within limits',
  'No gaps remaining',
];

const CLAUSES: { main: string; sub: string }[] = [
  {
    main: 'Nothing goes out without you, and we never take a cut of what you recover.',
    sub: 'Auto-submit is off by default. Every filing waits for your explicit approval of that specific response, and if you ever turn auto-submit on you can pause it any time.',
  },
  {
    main: "Stripe connects through Stripe's own authorization flow.",
    sub: 'You never type or share an API key, Verdact never stores one, and you can disconnect any time from your Stripe dashboard.',
  },
  {
    main: 'No guarantees.',
    sub: 'Verdact helps you build the strongest evidence you actually have, and is honest about what is missing. No honest tool can promise outcomes.',
  },
  {
    main: 'Your evidence stays yours.',
    sub: 'Client data is never sold and never used to train public models.',
  },
];

const FREE_FEATURES = [
  'Connect Stripe and import your disputes',
  'Build and view your full evidence record',
  'Every gap flagged while there is time to fix it',
  "Account-health read against Stripe's guidance",
];

const PAID_FEATURES = [
  'Submit the response to Stripe from Verdact',
  'Download and export the packet',
  'Deadline and dispute-rate alerts',
  'Slack import and evidence auto-gather',
];

const TYPES: { tn: string; td: string }[] = [
  { tn: 'Services not rendered', td: 'The customer claims the work was never done (Visa reason code 13.1; other networks use equivalents).' },
  { tn: 'Service not as described', td: 'The customer says the work fell short after it was delivered.' },
  { tn: 'Cancellation or refund disagreement', td: 'A dispute over your refund or cancellation terms.' },
  { tn: 'Credit not processed', td: 'The customer expected a refund that has not posted yet.' },
];

const SEGMENTS = ['Freelancers', 'Consultants', 'Agencies', 'SaaS implementation', 'B2B services'];

const COUNT_BEATS = [1, 2, 3, 4, 5, 7];

/* ─── component ─────────────────────────────────────────────────────────── */

export function HomepageClient() {
  const [keyGo, setKeyGo] = useState(false);
  const [ledgerPlay, setLedgerPlay] = useState(false);
  const [readNum, setReadNum] = useState(7);
  const [gapClosed, setGapClosed] = useState(false);
  const [ruleRevealed, setRuleRevealed] = useState(false);

  const ledgerRef = useRef<HTMLDivElement>(null);
  const closingRuleRef = useRef<HTMLDivElement>(null);
  const containersRef = useRef<(HTMLElement | null)[]>([]);

  const setContainer = (idx: number) => (el: HTMLElement | null) => {
    containersRef.current[idx] = el;
  };

  /* arm CSS gates */
  useEffect(() => {
    document.documentElement.classList.add('js');
    return () => { document.documentElement.classList.remove('js'); };
  }, []);

  /* H1 underline: the gap closes shortly after load */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setKeyGo(true); return; }
    const t = setTimeout(() => setKeyGo(true), 600);
    return () => clearTimeout(t);
  }, []);

  /* hero ledger: visibility-gated verification sequence + count beats */
  useEffect(() => {
    const el = ledgerRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function play() {
      setLedgerPlay(true);
      if (!reduced) {
        setReadNum(0);
        COUNT_BEATS.forEach((v, i) => {
          setTimeout(() => setReadNum(v), 300 + i * 90);
        });
      }
    }

    if (reduced || !('IntersectionObserver' in window)) {
      setLedgerPlay(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { play(); io.unobserve(e.target); }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* closing seal: gap closes in view, reopens out of view */
  useEffect(() => {
    const el = closingRuleRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      setGapClosed(true);
      setRuleRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          setGapClosed(e.isIntersecting);
          if (e.isIntersecting) setRuleRevealed(true);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* one-shot scroll reveals: .rv elements + choreography containers */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rvEls = Array.from(document.querySelectorAll<HTMLElement>('.rv'));
    const containers = containersRef.current.filter(Boolean) as HTMLElement[];
    const targets = [...rvEls, ...containers];
    if (!targets.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <MarketingHeader />

      <main id="main" className={styles.page}>

        {/* ── 1 · HERO ─────────────────────────────────────────────── */}
        <section className={styles.hero} aria-labelledby="hero-h">
          <div className="wrap">
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className="eyebrow">For service businesses on Stripe</p>
                <h1 id="hero-h" className={styles.heroHeadline}>
                  Win the Stripe disputes everyone else marks{' '}
                  <span className={`${styles.key} ${keyGo ? 'go' : ''}`}>
                    unwinnable.
                    <em className={styles.gapfill} aria-hidden="true" />
                  </span>
                </h1>
                <p className={styles.lede}>
                  Services-not-rendered and cancelled-subscription chargebacks are the hardest
                  to fight, because the proof lives in your email and delivery logs, not in Stripe.
                  Verdact turns that evidence into a structured, bank-ready argument. Nothing is
                  filed without your approval.
                </p>
                <div className={styles.heroCtas}>
                  <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
                    Connect Stripe, see your winnable cases
                  </Link>
                  <Link href="/#how" className={`${styles.btn} ${styles.btnGhost}`}>
                    See how it works
                  </Link>
                </div>
                <p className={styles.ctaNote}>
                  Free to build and review your evidence record. No card required.
                  Nothing is filed without your approval.
                </p>
              </div>

              <div
                ref={ledgerRef}
                className={`${styles.ledger} ${ledgerPlay ? 'play' : ''}`}
                role="img"
                aria-label="Example dispute: 2,400 dollars, services not rendered, due in 8 days. Seven evidence items verified, including Stripe payment, contract and scope, delivery proof, client approval, refund policy, access logs and the message thread. One missing: final acceptance note. Readiness reads 7 of 8 provable."
              >
                <div className={styles.ledgerHead}>
                  <div>
                    <div className={styles.amount}>
                      <span className={styles.amtNum}>$2,400</span>{' '}
                      <span className={styles.amtWord}>disputed</span>
                    </div>
                    <div className={styles.reason}>Services not rendered</div>
                  </div>
                  <div className={styles.headMeta}>
                    <span className={styles.chipExample}>Example case</span>
                    <span className={styles.due}>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M7 4.2V7l2 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
                      </svg>
                      Due in 8 days
                    </span>
                  </div>
                </div>
                <div className={styles.ledgerRows}>
                  {LEDGER_ROWS.map((row, i) => (
                    <div
                      key={row.label}
                      className={`${styles.ev} ${row.gap ? styles.gapRow : ''}`}
                      style={iVar(i)}
                    >
                      {row.gap ? <SealGap size={19} /> : <SealOk size={19} />}
                      <span className={styles.lab}>
                        {row.label}
                        {row.sub ? <> <span className={styles.sub}>{row.sub}</span></> : null}
                      </span>
                      <span className={styles.state}>{row.gap ? 'Gap' : 'Verified'}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.ledgerRead}>
                  <span className={styles.readNum}>{readNum}</span>
                  <span className={styles.readOf}>of 8 provable</span>
                  <div className={styles.readMeter} aria-hidden="true">
                    {Array.from({ length: 7 }, (_, i) => (
                      <i key={i} style={iVar(i)} />
                    ))}
                    <i className={styles.open} />
                  </div>
                </div>
                <div className={styles.ledgerFoot}>
                  <p><strong>Verdact shows you the gap before the bank does.</strong></p>
                  <p>Nothing is filed without your approval.</p>
                </div>
              </div>
            </div>

            <div className={styles.heroBase}>
              <GapRule />
            </div>
          </div>
        </section>

        {/* ── 2 · HOW IT WORKS ─────────────────────────────────────── */}
        <section id="how" className={`${styles.band} ${styles.howBand}`} aria-labelledby="how-h">
          <div className="wrap">
            <div className={`${styles.secHead} rv`}>
              <p className="eyebrow">Three steps</p>
              <h2 id="how-h">How Verdact works</h2>
            </div>
            <div className={styles.steps} ref={setContainer(0)}>
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className={`${styles.step} ${s.gapStep ? styles.gapStep : ''} rv-row`}
                  style={iVar(i)}
                >
                  <span className={styles.n}>0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <p className={styles.fact}><strong>{s.factLead}</strong> {s.fact}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── pull: deadline urgency (the mid-page statement) ──────── */}
        <div className={styles.urgencyPull}>
          <svg className={styles.urgencySeal} viewBox="0 0 26 26" fill="none" aria-hidden="true" focusable="false">
            <circle cx="13" cy="13" r="11" stroke="rgba(191,227,210,.09)" strokeWidth="1.1" strokeDasharray="2.6 2.2" />
            <path d="M13 8v6" stroke="rgba(191,227,210,.09)" strokeWidth="1.1" strokeLinecap="square" />
            <circle cx="13" cy="17.6" r="0.9" fill="rgba(191,227,210,.09)" />
          </svg>
          <div className="wrap">
            <GapRule onDeep />
            <p className={`${styles.urgencyP} rv`}>
              <span className={styles.uSet}>A chargeback response has a deadline.</span>
              Once you file, missing evidence cannot be submitted.
            </p>
          </div>
        </div>

        {/* ── 3 · ONE DISPUTE, MAPPED ──────────────────────────────── */}
        <section className={styles.feature} aria-labelledby="mapped-h">
          <div className="wrap">
            <div className={`${styles.centerHead} rv`}>
              <p className="eyebrow">What the bank actually weighs</p>
              <h2 id="mapped-h">The proof Stripe can&rsquo;t see, made into an argument</h2>
              <p className={styles.lede}>
                For a service dispute, the bank is not looking for a shipping label.
                It is looking for proof that you scoped the work, delivered it, and got
                the client&rsquo;s acceptance. That evidence lives in your email, delivery
                logs, and account, where Stripe-native tools cannot reach it. The same $2,400
                dispute from the top of the page, every item mapped to its source.
              </p>
            </div>
            <div className={styles.mapped} ref={setContainer(1)}>
              <div className={styles.mappedCap}>
                <span>$2,400 · Services not rendered</span>
                <span>Item → status → source</span>
              </div>
              {MROWS.map((row, i) => (
                <div
                  key={row.pn}
                  className={`${styles.mrow} ${row.gap ? styles.gapRow : ''} rv-row`}
                  style={iVar(i)}
                >
                  <span className={styles.pn}>{row.pn}</span>
                  <span className={styles.st}>
                    {row.gap ? <SealGap size={15} width={2.8} /> : <SealOk size={15} width={2.8} />}
                    {row.gap ? 'Missing' : 'Verified'}
                  </span>
                  <span className={styles.src}>{row.src}</span>
                </div>
              ))}
            </div>
            <div className={`${styles.belowTable} rv`}>
              <Link href="/signup" className={styles.textlink}>
                Connect Stripe and see your own dispute mapped this way, free
              </Link>
            </div>
          </div>
        </section>

        {/* ── 4 · WHO IT IS FOR ────────────────────────────────────── */}
        <section className={`${styles.tight} ${styles.whoBand}`} aria-labelledby="who-h">
          <div className="wrap">
            <div className={styles.split}>
              <div className="rv">
                <p className="eyebrow">Built only for service merchants</p>
                <h2 id="who-h">Built for how service businesses actually get paid</h2>
              </div>
              <div className={`${styles.splitBody} rv`}>
                <p className={styles.lede} style={{ maxWidth: 'none' }}>
                  A service chargeback happens when a customer disputes a card payment for
                  work you already delivered, not a product you shipped.
                </p>
                <p style={{ marginTop: 20, maxWidth: 'none' }}>
                  Verdact is for freelancers, agencies, consultants, SaaS implementation
                  teams, and B2B service businesses on Stripe. They are the only merchants
                  we build for.
                </p>
                <p style={{ maxWidth: 'none' }}>
                  Most chargeback tools are made for e-commerce, where winning means showing
                  a tracking number. Your work does not ship in a box. Your proof is the work
                  itself: the scope, the delivery, the client approvals, and the messages
                  along the way. Verdact is built around that proof.
                </p>
                <div className={styles.segments} aria-label="Who Verdact serves">
                  {SEGMENTS.map((s) => <span key={s}>{s}</span>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5 · WORKBENCH: THE GAP, RESOLVED ─────────────────────── */}
        <section className={styles.feature} aria-labelledby="bench-h">
          <div className="wrap">
            <div className={`${styles.centerHead} rv`}>
              <p className="eyebrow">Behind the case</p>
              <h2 id="bench-h">A Stripe-first evidence workbench</h2>
              <p className={styles.lede}>
                The workbench reads your Stripe dispute, organizes every piece of proof into
                one record, and runs a check for missing pieces. The output is a single
                response, evidence attached and matched to the reason code, ready before the
                deadline. Here is the same case after the acceptance note was added.
              </p>
            </div>
            <div className={styles.bench} ref={setContainer(2)}>
              <div className={styles.benchBar}>
                <span className={styles.t}>Dispute workbench · $2,400 · Due in 8 days</span>
                <span className={styles.resolved}>
                  <SealOk size={14} width={2.8} />
                  Gap resolved: acceptance note added
                </span>
              </div>
              <div className={styles.benchCols}>
                <div className={styles.benchCol}>
                  <p className={styles.label}>Evidence record</p>
                  {MINIS.map((m, i) => (
                    <div key={m.label} className={styles.mini} style={iVar(i)}>
                      <SealOk size={16} width={2.6} />
                      {m.label}
                      <span className={`${styles.srcChip} ${m.you ? styles.you : ''}`}>{m.chip}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.benchCol}>
                  <p className={styles.label}>Packet validator</p>
                  {CHECKS.map((c, i) => (
                    <div key={c} className={styles.check} style={iVar(i)}>
                      <SealOk size={15} width={2.8} />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.benchRead}>
                <span className={styles.readNum}>8</span>
                <span className={styles.readOf}>of 8</span>
                <span className={styles.ready}>Ready to file, pending your approval</span>
                <div className={styles.readMeter} aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} style={iVar(i)} />
                  ))}
                </div>
              </div>
            </div>
            <div className={`${styles.belowTable} rv`}>
              <p className={`${styles.small} ${styles.muted}`} style={{ marginTop: 26, maxWidth: 720 }}>
                <strong style={{ color: 'var(--ink)' }}>
                  Stripe connects directly. Slack threads can be imported.
                </strong>{' '}
                Email evidence is added by you: uploaded, pasted, or screenshotted.
                You decide what goes in.
              </p>
              <Link href="/signup" className={styles.textlink}>
                Start at step one, free, no card required
              </Link>
            </div>
          </div>
        </section>

        {/* ── 6 · ACCOUNT HEALTH ───────────────────────────────────── */}
        <section id="health" className={styles.band} aria-labelledby="health-h">
          <div className="wrap">
            <div className={styles.healthGrid}>
              <div>
                <div className={`${styles.secHead} rv`}>
                  <p className="eyebrow">Account health</p>
                  <h2 id="health-h">Account risk should not be a surprise</h2>
                  <p className={styles.lede}>
                    Every dispute counts against your Stripe account, not just one payment.
                    Verdact tracks your dispute rate against the 0.75% level Stripe publishes
                    as guidance, and shows how each open dispute moves it, so you know which
                    disputes are worth fighting before you commit.
                  </p>
                </div>
                <div className="rv">
                  <Link href="/signup" className={styles.textlink}>
                    Connect Stripe and see where your account stands, free
                  </Link>
                  <p className={`${styles.micro} ${styles.muted}`} style={{ marginTop: 14 }}>
                    Just want a number?{' '}
                    <Link
                      href="/tools/vamp-check"
                      style={{
                        color: 'var(--verdict)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                      }}
                    >
                      Estimate your dispute rate now, no signup
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <div className={`${styles.gaugePanel} rv`} ref={setContainer(3)}>
                <p className={styles.label}>Dispute rate</p>
                <div
                  className={styles.gauge}
                  role="img"
                  aria-label="Dispute-rate gauge from zero to one point five percent. A marker shows an example merchant in the safe zone, below the tick at Stripe's published 0.75 percent guidance."
                >
                  <span className={styles.safe} />
                  <span className={styles.risk} />
                  <span className={styles.tick} />
                  <span className={styles.you} />
                  <span className={styles.tickLabel}>Stripe&rsquo;s published 0.75% guidance</span>
                </div>
                <div className={styles.gaugeEnds} aria-hidden="true">
                  <span>0%</span><span>1.5%</span>
                </div>
                <p className={styles.gaugeNote}>
                  Verdact tracks your rate as disputes arrive and warns you while there is
                  still time to act.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7 · CONTROL + SECURITY ───────────────────────────────── */}
        <section id="control" aria-labelledby="control-h">
          <div className="wrap">
            <div className={`${styles.secHead} rv`}>
              <p className="eyebrow">Control and security</p>
              <h2 id="control-h">Nothing goes out without you</h2>
            </div>
            <div className={styles.clauses} ref={setContainer(4)}>
              {CLAUSES.map((c, i) => (
                <div key={c.main} className={`${styles.clause} rv-row`} style={iVar(i)}>
                  <p>
                    {c.main}
                    <span className={styles.sub}>{c.sub}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8 · WHAT IT COSTS ────────────────────────────────────── */}
        <section id="plans" className={styles.band} aria-labelledby="plans-h">
          <div className="wrap">
            <div className={`${styles.secHead} rv`}>
              <p className="eyebrow">What it costs</p>
              <h2 id="plans-h">Free to build the case. Subscribe to file it.</h2>
            </div>
            <div className={styles.tiers} ref={setContainer(5)}>
              <div className={`${styles.tier} rv-row`} style={iVar(0)}>
                <p className={styles.tname}>Free</p>
                <p className={styles.tsub}>Build the case and see exactly where you stand.</p>
                <ul>
                  {FREE_FEATURES.map((feat) => (
                    <li key={feat}>
                      <SealOk size={16} width={2.6} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`${styles.btn} ${styles.btnGhost} ${styles.tierCta}`}>
                  Get started
                </Link>
              </div>
              <div className={`${styles.tier} ${styles.paid} rv-row`} style={iVar(1)}>
                <p className={styles.tname}>Paid</p>
                <p className={styles.tsub}>File it from Verdact, and never miss the next one.</p>
                <ul>
                  {PAID_FEATURES.map((feat) => (
                    <li key={feat}>
                      <SealOk size={16} width={2.6} stroke="var(--mint)" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`${styles.btn} ${styles.btnOndeep} ${styles.tierCta}`}>
                  Start free
                </Link>
              </div>
            </div>
            <p className={`${styles.betaLine} rv`}>
              Verdact is in beta. All paid features are currently free for beta merchants.
            </p>
          </div>
        </section>

        {/* ── 9 · PLAIN ANSWERS ────────────────────────────────────── */}
        <section className={styles.tight} aria-labelledby="faq-h">
          <div className="wrap">
            <div className={`${styles.secHead} rv`}>
              <p className="eyebrow">Plain answers</p>
              <h2 id="faq-h">What is a service chargeback?</h2>
            </div>
            <aside className={`${styles.answer} rv`}>
              <p>
                A service chargeback is when a customer asks their card issuer to reverse a
                payment for a service you already delivered, rather than a physical product.
                The issuer weighs evidence from both sides and decides. For service work the
                deciding evidence is rarely a tracking number. It is proof that you scoped
                the work, delivered it, and got the client&rsquo;s acceptance.
              </p>
            </aside>
            <div className={`${styles.types} rv`}>
              {TYPES.map((t) => (
                <div key={t.tn} className={styles.type}>
                  <span className={styles.tn}>{t.tn}</span>
                  <span className={styles.td}>{t.td}</span>
                </div>
              ))}
            </div>
            <aside className={`${styles.answer} rv`} style={{ marginTop: 30 }}>
              <p className={styles.q}>Can&rsquo;t I just respond in the Stripe dashboard?</p>
              <p>
                You can. Stripe gives you a form. Verdact gives you what the form does not:
                the proof structure issuers expect for service disputes, a check for what is
                missing while there is still time to fix it, and a validated,
                submission-ready packet. <strong>You approve before anything is filed.</strong>
              </p>
            </aside>
          </div>
        </section>

        {/* ── 10 · CLOSING ─────────────────────────────────────────── */}
        <section className={styles.closing} aria-labelledby="closing-h">
          <svg className={styles.closingStrike} viewBox="0 0 26 26" fill="none" aria-hidden="true" focusable="false">
            <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="rgba(191,227,210,.07)" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M19.52 6.35 L20.5 4.7" stroke="rgba(191,227,210,.07)" strokeWidth="4.4" strokeLinecap="square" />
          </svg>
          <div className="wrap">
            <div
              ref={closingRuleRef}
              className={`${styles.closingRule} rv ${ruleRevealed ? 'in' : ''} ${gapClosed ? 'gap-closed' : ''}`}
              aria-hidden="true"
            >
              <i />
              <svg width="40" height="40" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="var(--mint)" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
                <path d="M19.52 6.35 L20.5 4.7" stroke="var(--mint)" strokeWidth="4.4" strokeLinecap="square" />
                <path className={styles.bridge} d="M15.64 12.89 L19.52 6.35" stroke="var(--mint)" strokeWidth="4.4" strokeLinecap="square" />
              </svg>
              <i />
            </div>
            <p className={styles.closingCap} aria-hidden="true">The gap, closed</p>
            <h2 id="closing-h">
              Your dispute already has a deadline. Start the response{' '}
              <span className={`${styles.key} ${styles.keyStatic}`}>today.</span>
            </h2>
            <p className={styles.lede}>
              Connect Stripe, see your evidence mapped, and approve the response before
              anything is filed.
            </p>
            <div className={styles.closingCtas}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnOndeep}`}>
                Start your response, free
              </Link>
              <Link href="/#plans" className={`${styles.btn} ${styles.btnGhostOndeep}`}>
                See what it costs
              </Link>
            </div>
            <p className={styles.ctaNote}>No card required. All paid features are free during beta.</p>
          </div>
        </section>

      </main>

      <MarketingFooter />
    </>
  );
}
