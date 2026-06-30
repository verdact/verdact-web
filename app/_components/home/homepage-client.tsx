'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './homepage.module.css';

const EXHIBIT_ROWS = [
  { name: 'Stripe charge record', gap: false },
  { name: 'Signed scope of work', gap: false },
  { name: 'Delivery log', gap: false },
  { name: 'Client approval email', gap: false },
  { name: 'Account login activity', gap: false },
  { name: 'Invoice, paid in full', gap: false },
  { name: 'Reason-code mapping, RC 13.1', gap: false },
  { name: 'Missing: final acceptance note', gap: true },
] as const;

const FAQ_ITEMS = [
  {
    q: 'Does Verdact file disputes for me?',
    a: 'No. We assemble the case and flag the gap. You review it and file it yourself through Stripe, in your own name. Nothing is submitted without your approval.',
  },
  {
    q: 'Do you take a cut of what I recover?',
    a: 'No, never. We charge a flat fee, and it is free during the beta. We do not take a percentage of your recovery, ever.',
  },
  {
    q: 'What if I do not win?',
    a: 'There are no guarantees, and we will tell you straight if a case is too weak to bother filing, before you spend a minute on it. If you do file and lose, you keep the assembled case and the gap we flagged, and you owe nothing during the beta.',
  },
  {
    q: 'Do you read my email?',
    a: 'No. We organize records you already have and choose to share. We never read anyone’s inbox, and you see exactly what was used before anything is final.',
  },
] as const;

function VIcon({ size = 26, stroke = 4.4 }: { size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M5.5 7.7 L11.6 19.7 L15.64 12.89 L19.52 6.35 L20.5 4.7"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function VStrike({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M19.52 6.35 L20.5 4.7" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" />
      <path className="bridge" d="M15.64 12.89 L19.52 6.35" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" />
    </svg>
  );
}

export function HomepageClient() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [instrBig, setInstrBig] = useState('0.31%');
  const [exhibitIn, setExhibitIn] = useState(false);
  const [provCount, setProvCount] = useState(7);

  const mastRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const spineFillRef = useRef<HTMLDivElement>(null);
  const spineHeadRef = useRef<HTMLDivElement>(null);
  const spineBreakRef = useRef<HTMLDivElement>(null);
  const spineSealRef = useRef<HTMLDivElement>(null);
  const heroH1Ref = useRef<HTMLHeadingElement>(null);
  const instrRef = useRef<HTMLElement>(null);
  const instColRef = useRef<SVGGElement>(null);
  const holdDotRef = useRef<SVGCircleElement>(null);
  const exhibitRef = useRef<HTMLDivElement>(null);

  // Scroll-driven spine + masthead transition
  useEffect(() => {
    let heroH = 0;
    let ticking = false;
    let brkSealed = false;
    let sealed = false;
    let motionOn = false;

    function measure() {
      if (heroRef.current) heroH = heroRef.current.offsetHeight;
    }

    function frame() {
      ticking = false;
      const y = window.scrollY;
      mastRef.current?.classList.toggle('scrolled', y > heroH - 80);

      if (!motionOn || !spineFillRef.current || !pageRef.current) return;
      const total = pageRef.current.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const prog = Math.min(1, Math.max(0, y / total));
      spineFillRef.current.style.transform = `translateX(-50%) scaleY(${prog.toFixed(4)})`;
      if (spineHeadRef.current) {
        spineHeadRef.current.style.top = `${(prog * 100).toFixed(3)}%`;
        if (y > 40) spineHeadRef.current.classList.add('live');
      }
      if (!brkSealed && prog > 0.155 && spineBreakRef.current) {
        spineBreakRef.current.classList.add('sealed');
        brkSealed = true;
      }
      if (!sealed && prog > 0.985 && spineSealRef.current) {
        spineSealRef.current.classList.add('on');
        sealed = true;
      }
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
    frame();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      motionOn = true;
      document.documentElement.classList.add('motion');
      setInstrBig('0.00%');
      measure();
      frame();
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.documentElement.classList.remove('motion');
    };
  }, []);

  // Hero h1 blur-in reveal
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { heroH1Ref.current?.classList.add('lit'); return; }
    let fired = false;
    function litHero() {
      if (fired) return;
      fired = true;
      heroH1Ref.current?.classList.add('lit');
    }
    if (document.fonts?.ready) document.fonts.ready.then(litHero);
    const t = setTimeout(litHero, 420);
    return () => clearTimeout(t);
  }, []);

  // data-rise IntersectionObserver
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-rise]'));
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Instrument animation
  useEffect(() => {
    const el = instrRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      instColRef.current?.classList.add('grown');
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        setTimeout(() => instColRef.current?.classList.add('grown'), 350);
        setTimeout(() => {
          let n = 0;
          const iv = setInterval(() => {
            n++;
            setInstrBig((Math.floor(Math.random() * 100) / 100).toFixed(2) + '%');
            if (n >= 14) {
              clearInterval(iv);
              let start: number | null = null;
              function step(ts: number) {
                if (!start) start = ts;
                const p = Math.min(1, (ts - start) / 820);
                const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
                setInstrBig((0.31 * eased).toFixed(2) + '%');
                if (p < 1) requestAnimationFrame(step);
              }
              requestAnimationFrame(step);
            }
          }, 44);
        }, 1150);
        setTimeout(() => {
          if (holdDotRef.current) {
            holdDotRef.current.style.animation = 'holdbreathe 2.6s cubic-bezier(.4,0,.2,1) infinite';
          }
        }, 1900);
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Exhibit ledger reveal + count
  useEffect(() => {
    const el = exhibitRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      setExhibitIn(true);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        setExhibitIn(true);
        setProvCount(0);
        [1, 2, 3, 4, 5, 6, 7].forEach((v, i) => setTimeout(() => setProvCount(v), i * 90));
      });
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Grain texture overlay */}
      <svg className={styles.grain} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <filter id="vg">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#vg)" />
      </svg>

      {/* ── Masthead (fixed, transparent → frosted on scroll) ── */}
      <header ref={mastRef} className={styles.mast} id="mast">
        <div className={styles.mastInner}>
          <Link href="/" className={styles.mastBrand} aria-label="Verdact home">
            <VIcon size={24} />
            <span className={styles.mastBrandWord}>Verdact<b>.</b></span>
          </Link>

          <nav aria-label="Primary">
            <ul className={styles.mastNav}>
              <li><a href="#line">The line</a></li>
              <li><a href="#how">How it works</a></li>
              <li><a href="#control">Control</a></li>
              <li><a href="#plans">Plans</a></li>
            </ul>
          </nav>

          <div className={styles.mastSpacer} />

          <div className={styles.mastRight}>
            <Link href="/login" className={styles.mastSign}>Sign in</Link>
            <Link href="/signup" className={styles.navCta}>
              Start free <VStrike size={14} />
            </Link>
            <button
              className={styles.menuBtn}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className={styles.mNav} aria-label="Mobile">
            <a href="#line" onClick={() => setMobileOpen(false)}>The line</a>
            <a href="#how" onClick={() => setMobileOpen(false)}>How it works</a>
            <a href="#control" onClick={() => setMobileOpen(false)}>Control</a>
            <a href="#plans" onClick={() => setMobileOpen(false)}>Plans</a>
            <Link href="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)}>Start free →</Link>
          </nav>
        )}
      </header>

      {/* ── Page (relative container for spine + all content) ── */}
      <div ref={pageRef} className={styles.pageWrap} id="top">

        {/* Continuous gapped spine */}
        <div className={styles.spine} aria-hidden="true">
          <div className={styles.spineTrack} />
          <div ref={spineBreakRef} className={styles.spineBreak}>
            <span className={styles.brkTick}>RC 13.1 · the gap</span>
          </div>
          <div ref={spineFillRef} className={styles.spineFill} />
          <div ref={spineHeadRef} className={styles.spineHead} />
          <div ref={spineSealRef} className={styles.spineSeal} />
        </div>

        <main>

          {/* ── 1. Hero (dark) ── */}
          <section ref={heroRef} className={`${styles.hero} ${styles.dark}`} id="hero">
            <div className={styles.rail}>
              <div className={styles.heroGrid}>

                {/* Copy (left) */}
                <div className={styles.heroCopy}>
                  <p className="eyebrow" data-rise>Stripe dispute · reason code 13.1</p>
                  <h1 ref={heroH1Ref} className={styles.heroH1}>
                    The Stripe disputes everyone writes off as{' '}
                    <span className={styles.heroStruck}>unwinnable.</span>{' '}
                    <span className={styles.heroWin}>You can win them.</span>
                  </h1>
                  <p className={`lede ${styles.heroLede}`} data-rise data-d="1">
                    A chargeback hit, the money is already pulled, and the clock is ticking.
                    The proof you need is real. It is just scattered across Stripe, your delivery logs,
                    and your client&apos;s own approval. Verdact assembles it.
                  </p>
                  <div className={styles.heroCta} data-rise data-d="2">
                    <div className={styles.heroCtas}>
                      <Link href="/signup" className={`${styles.btn} ${styles.btnOndeep}`}>
                        See your winnable cases <VStrike />
                      </Link>
                    </div>
                    <p className={styles.heroNote}>
                      <b>Free during beta.</b> No cut taken. Nothing filed without your approval.
                    </p>
                  </div>
                </div>

                {/* Instrument figure (right) */}
                <div className={styles.heroFig} data-rise data-d="1">
                  <figure
                    ref={instrRef}
                    className={styles.instrument}
                    aria-label="Example dispute-rate instrument. Your rate sits at 0.31%, held safely below Stripe's published 0.75% threshold."
                  >
                    <svg viewBox="0 0 400 446" fill="none" style={{ overflow: 'visible', width: '100%' }}>
                      <defs>
                        <linearGradient id="sigGrad" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0" stopColor="var(--verdict-deep)" />
                          <stop offset="1" stopColor="var(--verdict)" />
                        </linearGradient>
                      </defs>
                      {/* Track background */}
                      <rect x="262" y="40" width="74" height="340" rx="7" fill="rgba(191,227,210,.05)" stroke="var(--on-deep-line)" strokeWidth="1" />
                      {/* Signal column — animated scaleY(0→1) via .grown class */}
                      <g ref={instColRef} className={styles.instCol} style={{ transformBox: 'fill-box', transformOrigin: 'bottom' } as React.CSSProperties}>
                        <rect x="262" y="275" width="74" height="105" rx="7" fill="url(#sigGrad)" />
                        <rect x="262" y="271" width="74" height="6" rx="3" fill="var(--verdict-bright)" />
                      </g>
                      {/* Current rate marker */}
                      <circle cx="299" cy="273" r="5" fill="var(--mint)" />
                      <circle
                        ref={holdDotRef}
                        cx="299"
                        cy="273"
                        r="9"
                        fill="none"
                        stroke="var(--mint)"
                        strokeWidth="1.5"
                        opacity="0.55"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
                      />
                      {/* Stripe's 0.75% danger line */}
                      <line x1="234" y1="125" x2="352" y2="125" stroke="var(--gap-on-deep)" strokeWidth="2.5" strokeDasharray="7 6" />
                      {/* Held margin bracket */}
                      <g stroke="var(--mint)" strokeWidth="1.3" opacity="0.5">
                        <line x1="348" y1="129" x2="348" y2="269" />
                        <line x1="344" y1="129" x2="352" y2="129" />
                        <line x1="344" y1="269" x2="352" y2="269" />
                      </g>
                      <text x="368" y="199" fill="var(--mint)" fontSize="11" fontWeight="700" letterSpacing="0.12em" transform="rotate(90 368 199)" textAnchor="middle">HELD CLEAR</text>
                      {/* Labels */}
                      <text x="14" y="118" fill="var(--gap-on-deep)" fontSize="27" fontWeight="800" letterSpacing="-0.02em">0.75%</text>
                      <text x="15" y="139" fill="var(--on-deep-2)" fontSize="11" fontWeight="700" letterSpacing="0.1em">STRIPE&apos;S PUBLISHED LINE</text>
                      <text x="12" y="290" fill="var(--mint)" fontSize="50" fontWeight="800" letterSpacing="-0.035em" style={{ fontVariantNumeric: 'tabular-nums' }}>{instrBig}</text>
                      <circle cx="18" cy="311" r="4" fill="var(--verdict-bright)" />
                      <text x="30" y="315" fill="var(--on-deep-2)" fontSize="11" fontWeight="700" letterSpacing="0.12em">YOU · WATCHED</text>
                    </svg>
                  </figure>
                </div>
              </div>

              <div className={styles.heroStrip}>
                <ul aria-label="How Verdact works, in short">
                  <li>We assemble the evidence</li>
                  <li><span className={styles.sep}> · </span></li>
                  <li>You approve every word</li>
                  <li><span className={styles.sep}> · </span></li>
                  <li>You file it yourself</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── 2. Stake strip ── */}
          <section className={styles.stake} aria-label="Case register and guarantees">
            <div className={styles.stakeInner}>
              <div className={styles.stakeReg} aria-hidden="true">
                <div className={styles.marqueeTrack}>
                  {[0, 1].map(n => (
                    <span key={n} className={styles.marqueeItem}>
                      Case file<span className={styles.pip}> · </span>
                      Stripe disputes<span className={styles.pip}> · </span>
                      Reason code 13.1<span className={styles.pip}> · </span>
                      Services not rendered<span className={styles.pip}> · </span>
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.stakeGuard}>
                <div><span className={styles.stakeX}>/</span> No cut taken</div>
                <div><span className={styles.stakeX}>/</span> Nothing filed without you</div>
                <div><span className={styles.stakeX}>/</span> We never read your inbox</div>
              </div>
            </div>
          </section>

          {/* ── 3. Reframe ── */}
          <section className={styles.reframe} data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>Why these look unwinnable</p>
              <p className={styles.statement} data-rise data-d="1">
                Banks are not finding flaws in your evidence. They are finding{' '}
                <span className={styles.statementRed}>gaps you do not know you have.</span>{' '}
                <em>Verdact finds yours first.</em>
              </p>
            </div>
          </section>

          {/* ── 4. Exhibit A — evidence ledger ── */}
          <section className={styles.exhibit} id="exhibit" data-section>
            <div className={styles.rail}>
              <div className={styles.exhibitGrid}>
                <div className={styles.exhibitCopy}>
                  <p className="eyebrow" data-rise>The product, at fidelity</p>
                  <h2 data-rise data-d="1">We build the case. We find the gap first.</h2>
                  <p className="lede" data-rise data-d="2">
                    Every piece of proof, pulled from records you already hold, mapped to the reason code,
                    and laid out the way an issuer reads it.
                  </p>
                  <div className={styles.countLine} data-rise data-d="2">
                    <span className={styles.countN}>{provCount}</span>
                    <span className={styles.countOf}>of 8 provable</span>
                  </div>
                  <p className={styles.countCap}>
                    We flag the one piece the bank would have found first, while you still have time to add it.
                  </p>
                </div>

                <div ref={exhibitRef} data-rise data-d="1">
                  <figure
                    className={styles.ledger}
                    aria-label="Example evidence record. A $2,400 dispute, services not rendered, due in 8 days."
                  >
                    <figcaption className={styles.ledgerStamp}>Exhibit A · Case file #8824-V · Example</figcaption>
                    <div className={styles.ledgerHead}>
                      <div>
                        <div className={styles.amtLab}>Disputed amount</div>
                        <div className={styles.amt}>$2,400</div>
                      </div>
                      <div className={styles.caseMeta}>
                        <span className={styles.caseNr}>Services not rendered</span>
                        <span className={styles.caseRc}>RC 13.1</span>
                        <span className={styles.caseDue}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                          </svg>
                          Due in 8 days
                        </span>
                      </div>
                    </div>

                    <ul className={styles.ledgerRows}>
                      {EXHIBIT_ROWS.map((row, i) => {
                        const isGap = (row as { gap: boolean }).gap;
                        const delay = isGap
                          ? `${(EXHIBIT_ROWS.length - 1) * 80 + 380}ms`
                          : `${i * 80}ms`;
                        return (
                          <li
                            key={row.name}
                            className={`${styles.lrow} ${isGap ? styles.lrowGap : ''} ${exhibitIn ? 'in' : ''}`}
                            style={exhibitIn ? { transitionDelay: delay } : undefined}
                          >
                            <span className={styles.lrowSeal}>
                              {isGap ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" width="14" height="14">
                                  <path d="M12 7v6M12 16.5v.5" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" width="18" height="18">
                                  <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89 L19.52 6.35 L20.5 4.7" />
                                </svg>
                              )}
                            </span>
                            <span className={styles.lrowName}>{row.name}</span>
                            <span className={styles.lrowStat}>{isGap ? 'Gap' : 'Verified'}</span>
                          </li>
                        );
                      })}
                    </ul>

                    <figcaption className={styles.ledgerFoot}>
                      <b>7 of 8 provable.</b> The eighth is the piece the bank looks for first.
                    </figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </section>

          {/* ── 5. How it works ── */}
          <section className={styles.how} id="how" data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>How it works</p>
              <h2 data-rise data-d="1">Three steps. You hold the pen the whole way.</h2>
              <div className={styles.howBeats}>
                <div className={styles.beat} data-rise>
                  <span className={styles.beatGhost} aria-hidden="true">01</span>
                  <p className={styles.beatNo}>Step 01</p>
                  <h3>You tell us what happened.</h3>
                  <p>One dispute, one short brief. No integrations you do not want, no access to anything you did not choose to share.</p>
                </div>
                <div className={styles.beat} data-rise data-d="1">
                  <span className={styles.beatGhost} aria-hidden="true">02</span>
                  <p className={styles.beatNo}>Step 02</p>
                  <h3><span className={styles.beatYou}>We</span> assemble. <span className={styles.beatYou}>You</span> review.</h3>
                  <p>We gather your evidence, map it to the reason code, and flag the gap. You read every line before anything is final.</p>
                </div>
                <div className={styles.beat} data-rise data-d="2">
                  <span className={styles.beatGhost} aria-hidden="true">03</span>
                  <p className={styles.beatNo}>Step 03</p>
                  <h3><span className={styles.beatYou}>You</span> file it yourself.</h3>
                  <p>You submit it through Stripe, in your own name, and you keep everything you recover. We never take a cut.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 6. THE LINE EXPLAINED (dark) ── */}
          <section className={`${styles.explainSection} ${styles.dark}`} id="line" data-section>
            <div className={styles.rail}>
              <div className={styles.explainGrid}>
                <div className={styles.miniInst} data-rise aria-hidden="true">
                  <svg viewBox="0 0 240 200" fill="none" width="100%">
                    <line x1="20" y1="58" x2="220" y2="58" stroke="var(--gap-on-deep)" strokeWidth="2" strokeDasharray="6 5" />
                    <text x="20" y="48" fill="var(--gap-on-deep)" fontFamily="Schibsted Grotesk, sans-serif" fontSize="13" fontWeight="700" letterSpacing="0.04em">0.75%: the line</text>
                    <rect x="20" y="120" width="200" height="56" rx="6" fill="rgba(191,227,210,.10)" />
                    <rect x="20" y="120" width="84" height="56" rx="6" fill="var(--mint)" opacity="0.8" />
                    <text x="118" y="154" fill="var(--mint)" fontFamily="Schibsted Grotesk, sans-serif" fontSize="15" fontWeight="800" letterSpacing="-0.01em">You · 0.31%</text>
                    <line x1="190" y1="60" x2="190" y2="118" stroke="var(--mint)" strokeWidth="1.2" opacity="0.5" />
                    <line x1="186" y1="60" x2="194" y2="60" stroke="var(--mint)" strokeWidth="1.2" opacity="0.5" />
                    <line x1="186" y1="118" x2="194" y2="118" stroke="var(--mint)" strokeWidth="1.2" opacity="0.5" />
                  </svg>
                </div>
                <div className={styles.explainCopy}>
                  <p className="eyebrow" data-rise>The line you cannot see</p>
                  <h2 data-rise data-d="1">Win the dispute. Keep the account.</h2>
                  <p className={styles.explainBody} data-rise data-d="2">
                    Stripe publishes a 0.75% dispute-rate guidance. Cross it and a win can still cost you your account.
                    Most owners do not know it exists. Verdact tracks you against it, so winning a dispute never puts your Stripe account at risk.
                  </p>
                  <p className={styles.explainCap} data-rise data-d="2">
                    Stripe&apos;s published guidance. Verdact is not affiliated with or endorsed by Stripe.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 7. Urgency (dark) ── */}
          <section className={`${styles.urgency} ${styles.dark}`} data-section>
            <span className={styles.urgencyGhost} aria-hidden="true">
              <svg viewBox="0 0 26 26" width="280" height="280" fill="none">
                <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89 M19.52 6.35 L20.5 4.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" />
              </svg>
            </span>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>The clock is real</p>
              <p className={styles.urgencyStatement} data-rise data-d="1">
                Card networks give you days, not weeks, to respond. The sooner the case is built, the stronger it is.
              </p>
              <p className={styles.urgencySub} data-rise data-d="2">
                Here is what to do right now: join the beta, and we will be ready the moment your dispute lands.
              </p>
            </div>
          </section>

          {/* ── 8. Who it's for ── */}
          <section className={styles.whoFor} data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>Who it&apos;s for</p>
              <p className={styles.whoIntro} data-rise data-d="1">
                Built for the owners who do the work themselves, and file the disputes themselves too.
              </p>
              <div className={styles.whoNames}>
                {(['SaaS founders', 'Agencies', 'Consultants', 'Freelancers', 'B2B services'] as const).map((name, i) => (
                  <Link
                    key={name}
                    href="/signup"
                    className={styles.whoName}
                    data-rise
                    {...(i > 1 ? { 'data-d': String(Math.min(i - 1, 2)) } : {})}
                  >
                    {name}
                    <svg className={styles.whoMark} viewBox="0 0 26 26" fill="none" aria-hidden="true">
                      <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" strokeLinejoin="miter" />
                      <path d="M19.52 6.35 L20.5 4.7" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" />
                      <path className="bridge" d="M15.64 12.89 L19.52 6.35" stroke="currentColor" strokeWidth="4.4" strokeLinecap="square" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ── 9. Control clauses ── */}
          <section className={styles.control} id="control" data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>Control is the product</p>
              <h2 data-rise data-d="1">Four clauses we do not break.</h2>
              <div className={styles.clauses}>
                <div className={styles.clause} data-rise>
                  <h3><span className={styles.clauseNo}>No</span> cut taken.</h3>
                  <p>We charge a flat beta price, never a share of what you recover. Your win is yours.</p>
                </div>
                <div className={styles.clause} data-rise data-d="1">
                  <h3><span className={styles.clauseNo}>Nothing</span> filed without you.</h3>
                  <p>You approve every exhibit before anything leaves. We never submit on your behalf.</p>
                </div>
                <div className={styles.clause} data-rise>
                  <h3><span className={styles.clauseNo}>Your</span> data stays yours.</h3>
                  <p>We organize records you already have. We never read anyone&apos;s inbox.</p>
                </div>
                <div className={styles.clause} data-rise data-d="1">
                  <h3><span className={styles.clauseNo}>Walk</span> away anytime.</h3>
                  <p>Stop at any step and keep everything we built together. No lock-in, no penalty.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 10. Plans ── */}
          <section className={styles.plans} id="plans" data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>Plans</p>
              <h2 data-rise data-d="1">Free during the beta.</h2>
              <div className={styles.planFeature} data-rise data-d="1">
                <div>
                  <p className={styles.planTier}>Beta access</p>
                  <p className={styles.planPrice}>Free</p>
                </div>
                <div className={styles.planRight}>
                  <p>
                    Full case assembly, gap flagging, and account-line tracking, free while we are in beta.
                    No credit card, and never a cut of anything you recover.
                  </p>
                  <Link href="/signup" className={`${styles.btn} ${styles.btnOndeep}`} style={{ marginTop: 'var(--s6)', display: 'inline-flex' }}>
                    See your winnable cases <VStrike />
                  </Link>
                </div>
              </div>
              <div className={styles.planNote} data-rise data-d="1">
                <span className={styles.planNoteLabel}>After beta</span>
                <span className={styles.planNoteBody}>
                  A flat fee per case. No percentage, ever. We will share exact pricing at launch, before you owe anything.
                </span>
              </div>
            </div>
          </section>

          {/* ── 11. FAQ ── */}
          <section className={styles.faq} id="faq" data-section>
            <div className={styles.rail}>
              <p className="eyebrow" data-rise>The questions you are right to ask</p>
              <h2 data-rise data-d="1">Straight answers.</h2>
              <div className={styles.faqList} data-rise data-d="1">
                {FAQ_ITEMS.map(item => (
                  <details key={item.q} className={styles.faqItem}>
                    <summary>
                      <span className={styles.faqQt}>{item.q}</span>
                      <span className={styles.faqSign} aria-hidden="true" />
                    </summary>
                    <p className={styles.faqA}>{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

        </main>

        {/* ── 12. Closing (dark) ── */}
        <section className={`${styles.closing} ${styles.dark}`} id="join">
          <div className={styles.rail}>
            <div className={styles.closingBaseline} aria-hidden="true">
              <svg className={styles.sealMark} viewBox="0 0 26 26" width="80" height="80" fill="none" style={{ overflow: 'visible' }}>
                <path d="M5.5 7.7 L11.6 19.7 L15.64 12.89" stroke="var(--mint)" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
                <path d="M19.52 6.35 L20.5 4.7" stroke="var(--mint)" strokeWidth="3" strokeLinecap="square" />
                <path d="M15.64 12.89 L19.52 6.35" stroke="var(--mint)" strokeWidth="3" strokeLinecap="square" />
              </svg>
            </div>
            <p className="eyebrow" data-rise style={{ justifyContent: 'center' }}>The gap, closed</p>
            <p className={styles.closingPoster} data-rise data-d="1">
              The win was always there. We just close the <span className={styles.sealWord}>gap.</span>
            </p>
            <div className={styles.closingCta} data-rise data-d="2">
              <Link href="/signup" className={`${styles.btn} ${styles.btnOndeep}`}>
                Start free — no card required <VStrike />
              </Link>
              <p className={styles.closingMicro}>
                <b>Free during beta.</b> No cut taken. Nothing filed without your approval.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer (abyss bg) ── */}
        <footer className={styles.foot}>
          <div className={styles.rail}>
            <div className={styles.footTop}>
              <div>
                <Link href="/" className={styles.footBrand} aria-label="Verdact home">
                  <VIcon size={22} />
                  <span>Verdact<b style={{ color: 'var(--mint)' }}>.</b></span>
                </Link>
                <p className={styles.footTagline}>A verdict is the truth, delivered.</p>
              </div>
              <div className={styles.footLinks}>
                <div className={styles.footCol}>
                  <h3>Product</h3>
                  <ul>
                    <li><a href="#how">How it works</a></li>
                    <li><a href="#line">The line</a></li>
                    <li><a href="#control">Control</a></li>
                    <li><a href="#plans">Plans</a></li>
                  </ul>
                </div>
                <div className={styles.footCol}>
                  <h3>Account</h3>
                  <ul>
                    <li><Link href="/signup">Start free</Link></li>
                    <li><Link href="/login">Sign in</Link></li>
                    <li><Link href="/dashboard">Dashboard</Link></li>
                  </ul>
                </div>
                <div className={styles.footCol}>
                  <h3>Legal</h3>
                  <ul>
                    <li><Link href="/privacy">Privacy</Link></li>
                    <li><Link href="/terms">Terms</Link></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className={styles.footBase}>
              <span className={styles.footColophon}>&copy; 2026 Verdact</span>
              <span className={styles.footLegal}>
                Not affiliated with or endorsed by Stripe, Inc. Dispute outcomes vary by case; we do not guarantee recovery.
              </span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
