'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MarketingHeader } from '../../_components/marketing/marketing-header';
import { MarketingFooter } from '../../_components/marketing/marketing-footer';
import { CheckIcon, AlertTriangleIcon } from '../../_components/home-icons';
import { ScrollReveals } from '../../_components/ui/scroll-reveals';
import { SCORE_FLOOR, HEALTHY_LINE, STRIPE_LINE, GAUGE_MAX } from '@/lib/account-health/lines';
import styles from './vamp-check.module.css';

// ─── Thresholds ──────────────────────────────────────────────────────────────
// SCORE_FLOOR / HEALTHY_LINE / STRIPE_LINE / GAUGE_MAX come from the shared
// source of truth in lib/account-health/lines so the public checker and the
// authed Account Health view score against identical lines (verified 2026-06-07
// against the vault Stripe/Visa extracts).
const VISA_EVENT_GATE = 1500; // Visa VAMP monitoring count gate (events/month)
const MC_CB_GATE = 100;       // Mastercard ECP monitoring count gate (chargebacks/month)

const STRIPE_POS = (STRIPE_LINE / GAUGE_MAX) * 100; // 50

type Band = 'empty' | 'invalid' | 'tooEarly' | 'healthy' | 'close' | 'atRisk';

interface FormValues {
  settled: string;
  disputes: string;
  fraud: string;
}

interface Result {
  band: Band;
  ratio: number;
  numerator: number;
  settled: number;
  disputes: number;
  bufferEvents: number;
  markerPos: number;
  highCount: boolean;
  hasRate: boolean;
}

function toInt(v: string): number {
  const n = parseInt(v.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function compute(form: FormValues): Result {
  const settled = toInt(form.settled);
  const disputes = toInt(form.disputes);
  const fraud = toInt(form.fraud);
  const numerator = disputes + fraud;

  const base: Result = {
    band: 'empty', ratio: 0, numerator, settled, disputes,
    bufferEvents: 0, markerPos: 0, highCount: false, hasRate: false,
  };

  if (form.settled.trim() === '' || settled <= 0) {
    if (settled < 0 || disputes < 0 || fraud < 0) return { ...base, band: 'invalid' };
    return base;
  }

  if (settled < 0 || disputes < 0 || fraud < 0 || numerator > settled) {
    return { ...base, band: 'invalid' };
  }

  const ratio = (numerator / settled) * 100;
  const bufferEvents = Math.floor(settled * (STRIPE_LINE / 100)) - numerator;
  const markerPos = clamp((ratio / GAUGE_MAX) * 100, 1.5, 98.5);
  const highCount = disputes >= MC_CB_GATE || numerator >= VISA_EVENT_GATE;

  let band: Band;
  if (settled < SCORE_FLOOR) band = 'tooEarly';
  else if (ratio < HEALTHY_LINE) band = 'healthy';
  else if (ratio < STRIPE_LINE) band = 'close';
  else band = 'atRisk';

  return { band, ratio, numerator, settled, disputes, bufferEvents, markerPos, highCount, hasRate: true };
}

// ─── Static content ──────────────────────────────────────────────────────────

const INPUTS: { id: keyof FormValues; label: string; help: string; placeholder: string }[] = [
  { id: 'settled', label: 'Settled transactions', help: 'Successful card charges across all brands. In Stripe: Balance Transactions, type=payment.', placeholder: 'e.g. 4200' },
  { id: 'disputes', label: 'Disputes received', help: 'Chargebacks and inquiries. In Stripe: Disputes.', placeholder: 'e.g. 12' },
  { id: 'fraud', label: 'Fraud reports received', help: 'Early fraud warnings (TC40). In Stripe: Radar, Reviews.', placeholder: 'e.g. 8' },
];

const NETWORKS: { name: string; desc: string; primary?: boolean }[] = [
  { name: 'Stripe', desc: 'Acts around 0.75%. Your acquirer; watches every brand.', primary: true },
  { name: 'Visa (VAMP)', desc: '1.5% with 1,500+ events a month.' },
  { name: 'Mastercard (ECP)', desc: '1.5% with 100+ chargebacks a month; severe 3% with 300+.' },
  { name: 'Amex / Discover', desc: 'Run their own monitoring.' },
];

const RECS: Record<'tooEarly' | 'healthy' | 'close' | 'atRisk', string[]> = {
  tooEarly: [
    'Keep delivery proof tight now. A signed sign-off is the strongest single piece.',
    'Refund a risky fraud warning fast. Only a reversal within about two hours of the charge stops the report from counting.',
    'One dispute at this volume is not an account-risk event. Watch the trend, not a single number.',
  ],
  healthy: [
    'Set a monthly check. Counts move by program month, so today’s buffer can close fast.',
    'Tighten your refund and cancellation flow now, before disputes arrive.',
  ],
  close: [
    'Review every open fraud warning today.',
    'Fight the disputes worth fighting to recover the cash.',
    'Tighten the cancellation path, where most services-not-rendered disputes start.',
  ],
  atRisk: [
    'Confirm your exact status in Stripe.',
    'Review every open fraud warning now, and consider pausing your highest-dispute product or segment.',
    'A written remediation note to Stripe changes how this is handled.',
    'Check whether any Visa fraud disputes qualify for Compelling Evidence 3.0.',
  ],
};

const VERDICT_LABEL: Record<'tooEarly' | 'healthy' | 'close' | 'atRisk', string> = {
  tooEarly: 'Too early to score',
  healthy: 'Healthy',
  close: 'Getting close',
  atRisk: 'At risk',
};

const COMPARE_ROWS: { manual: string; auto: string }[] = [
  { manual: 'Manual entry each time you check.', auto: 'Daily auto-pull from your Stripe account.' },
  { manual: 'You check it when you remember.', auto: 'A warning before you reach Stripe’s 0.75% line.' },
  { manual: 'Generic recommendations.', auto: 'Tied to your products, customers, and reason codes.' },
];

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function VampChecker() {
  const [form, setForm] = useState<FormValues>({ settled: '', disputes: '', fraud: '' });
  const result = useMemo(() => compute(form), [form]);

  const { band } = result;
  const scored = band === 'healthy' || band === 'close' || band === 'atRisk';
  const hasVerdict = scored || band === 'tooEarly';
  const bandClass = band === 'atRisk' ? styles.atRisk : band === 'close' ? styles.close
    : band === 'healthy' ? styles.healthy : styles.empty;
  const youColor = band === 'atRisk' ? 'var(--gap)' : band === 'close' ? 'var(--warning)' : 'var(--verdict)';
  const ratioDisplay = result.hasRate ? `${result.ratio.toFixed(2)}%` : 'No rate yet';

  const setField = (id: keyof FormValues) => (value: string) =>
    setForm((prev) => ({ ...prev, [id]: value.replace(/[^\d]/g, '') }));

  const liveSummary = !result.hasRate
    ? 'Enter your numbers to see where your account stands.'
    : `Your dispute rate is ${result.ratio.toFixed(2)} percent. Status: ${
        band === 'empty' || band === 'invalid' ? 'unavailable' : VERDICT_LABEL[band]
      }.`;

  return (
    <>
      <ScrollReveals />
      <MarketingHeader ctaLabel="See your free audit" ctaHref="/audit" />

      <main id="main" className={styles.page}>
        {/* ─── HERO ────────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className="wrap">
            <div className={`${styles.heroInner} reveal-view`}>
              <p className="eyebrow">Free dispute rate &amp; account risk checker</p>
              <p className={styles.coverage}>
                Works for every card brand you take: Visa, Mastercard, Amex, and Discover.
              </p>
              <h1 className={styles.heroHeadline}>
                See where your Stripe account <span className={styles.key}>actually stands</span>.
              </h1>
              <p className={styles.subhead}>
                Enter your last 30 days of Stripe numbers to estimate your dispute rate and see how
                close you are to the level where Stripe can limit your account.
              </p>
              <div className={styles.heroAside}>
                <p className={styles.bridge}>
                  Searching for your VAMP ratio? VAMP is Visa&rsquo;s version. We show your overall
                  dispute rate, since Stripe and every card network watch it.
                </p>
                <p className={styles.hook}>
                  Most merchants get limited by Stripe at 0.75%, well before any single card
                  network&rsquo;s program kicks in. We show the line that actually applies at your volume.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── THE INSTRUMENT (calculator + read-out + full-width gauge) ── */}
        <section className={styles.instrumentBand}>
          <div className="wrap">
            <div className={`${styles.instrumentWrap} reveal-view`}>
              <div className={`${styles.instrument} ${scored ? bandClass : ''}`}>
                <span
                  style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
                  aria-live="polite"
                >
                  {liveSummary}
                </span>

                {/* header bar */}
                <div className={styles.instrumentBar}>
                  <span className={styles.instrumentTitle}>Dispute rate calculator &middot; last 30 days</span>
                  <span className={styles.autoPill}>
                    <span className={styles.dotPulse} aria-hidden="true" />
                    <span><b>Automatic with Verdact.</b> Updates daily once you connect Stripe.</span>
                  </span>
                </div>

                {/* inputs | read-out */}
                <div className={styles.instrumentCols}>
                  <div className={styles.calcCol}>
                    <p className={styles.colLabel}>Your numbers</p>
                    <div className={styles.inputs}>
                      {INPUTS.map(({ id, label, help, placeholder }) => (
                        <div className="field" key={id}>
                          <label htmlFor={`vamp-${id}`}>{label}</label>
                          <input
                            id={`vamp-${id}`}
                            className="inp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={form[id]}
                            onChange={(e) => setField(id)(e.target.value)}
                            placeholder={placeholder}
                            aria-describedby={`vamp-${id}-help`}
                          />
                          <p className="help" id={`vamp-${id}-help`}>{help}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.readCol}>
                    <p className={styles.colLabel}>Your dispute rate</p>
                    <span className={`${styles.figure} ${scored ? bandClass : result.hasRate ? '' : styles.empty}`}>
                      {ratioDisplay}
                    </span>
                    {result.hasRate && (
                      <p className={styles.figureNote}>
                        Your overall rate across all card brands. Each network has its own version;
                        Visa calls it VAMP.
                      </p>
                    )}

                    {band === 'invalid' && (
                      <div className={styles.invalid} role="alert">
                        <AlertTriangleIcon />
                        <span>Check these numbers. Disputes and fraud reports should be part of your settled charges, not on top of them.</span>
                      </div>
                    )}

                    {band === 'empty' && (
                      <p className={styles.verdictMsg}>Enter your numbers to see where your account stands.</p>
                    )}

                    {hasVerdict && (
                      <>
                        <span className={`${styles.verdict} ${bandClass}`}>
                          <span className={styles.bdot} aria-hidden="true" />
                          {VERDICT_LABEL[band]}
                        </span>

                        {band === 'tooEarly' && (
                          <p className={styles.verdictMsg}>
                            With <strong>{fmt(result.settled)}</strong> charges, one or two disputes can
                            swing this number a lot. Your volume is too low for this rate to mean much
                            yet. Here is what to watch as you grow.
                          </p>
                        )}
                        {band === 'healthy' && (
                          <p className={styles.verdictMsg}>You are comfortably under Stripe&rsquo;s 0.75% line. Keep it there.</p>
                        )}
                        {band === 'close' && (
                          <p className={styles.verdictMsg}>You are between the normal range and Stripe&rsquo;s 0.75% line. Act now, while you still have room.</p>
                        )}
                        {band === 'atRisk' && (
                          <p className={styles.verdictMsg}>Your estimate is at or above Stripe&rsquo;s 0.75% line. Confirm your exact status in Stripe and start remediating today.</p>
                        )}

                        <p className={styles.operative}>
                          {band === 'tooEarly'
                            ? 'At your volume, the card networks’ formal programs are not triggered (Visa needs 1,500+ events a month, Mastercard 100+). Stripe still watches your rate and can act at 0.75%, so that is the line to keep in view as you grow.'
                            : 'At your volume, Stripe’s 0.75% is the line that matters. You are well under the card networks’ own monitoring counts (Visa 1,500+ events a month, Mastercard 100+ chargebacks), so their formal programs are not in play yet.'}
                        </p>
                        {result.highCount && (
                          <p className={styles.operative}>
                            You are now near the card networks&rsquo; own monitoring counts, so their
                            programs (Visa, Mastercard, and others) apply on top of Stripe&rsquo;s.
                          </p>
                        )}

                        {scored && band !== 'atRisk' && result.bufferEvents >= 0 && (
                          <p className={styles.buffer}>
                            About <span className={styles.bnum}>{fmt(result.bufferEvents)}</span>
                            {` more dispute or fraud ${result.bufferEvents === 1 ? 'event' : 'events'} this month before you cross Stripe’s 0.75% line at this volume.`}
                          </p>
                        )}
                        {band === 'atRisk' && (
                          <p className={`${styles.buffer} ${styles.atRisk}`}>
                            Your estimate is at or above Stripe&rsquo;s 0.75% line. Confirm your exact
                            status in Stripe; counts, brand, and region also factor in.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* full-width gauge footer */}
                <div className={styles.gaugeFooter}>
                  <p className={styles.scaleLabel}>Where you fall</p>
                  <div className={styles.gauge} role="img"
                    aria-label={result.hasRate
                      ? `Your dispute rate ${result.ratio.toFixed(2)} percent on a scale to 1.5 percent. Stripe acts at 0.75 percent.`
                      : 'Dispute-rate scale from 0 to 1.5 percent. Stripe acts at 0.75 percent.'}>
                    <span className={`${styles.gaugeZone} ${styles.healthy}`} />
                    <span className={`${styles.gaugeZone} ${styles.close}`} />
                    <span className={`${styles.gaugeZone} ${styles.risk}`} />
                    <span className={styles.gaugeTick} style={{ left: `${STRIPE_POS}%` }} />
                    <span className={styles.gaugeTickLabel} style={{ left: `${STRIPE_POS}%` }}>
                      0.75%
                      <span>Stripe acts here</span>
                    </span>
                    {result.hasRate && (
                      <span
                        className={styles.gaugeYou}
                        style={{ left: `${result.markerPos}%`, background: youColor }}
                      >
                        <i className={styles.gaugeYouDot} style={{ background: youColor }} />
                      </span>
                    )}
                  </div>
                  <div className={styles.gaugeEnds}>
                    <span>0%</span>
                    <span>1.5% &middot; Visa excessive</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── REFERENCE BAND (networks + explainer) ───────────────── */}
        <section className={styles.refSection}>
          <div className="wrap">
            <div className={`${styles.refHead} reveal-view`}>
              <h2>How dispute rate actually works</h2>
              <p>
                The number is the same kind of rate Stripe and every card network use to monitor your
                account. The thresholds below are the lines that matter, with the sources to verify them.
              </p>
            </div>
            <div className={styles.refGrid}>
              <div className={`${styles.netCard} reveal-view`}>
                <div className={styles.netCardHead}>The lines that matter</div>
                {NETWORKS.map(({ name, desc, primary }) => (
                  <div className={`${styles.netRow} ${primary ? styles.primary : ''}`} key={name}>
                    <span className={styles.nName}>{name}</span>
                    <span className={styles.nDesc}>{desc}</span>
                  </div>
                ))}
              </div>

              <details className={`${styles.explainer} reveal-view`}>
                <summary>
                  How your dispute rate is measured
                  <ChevronIcon className={styles.chev} />
                </summary>
                <div className={styles.explainerBody}>
                  <p>
                    It is the share of your charges that end in a dispute, counted the way the card
                    networks measure it for monitoring (by when the dispute arrives). Early fraud
                    warnings count too. It covers every card brand, not just one.
                  </p>
                  <h3>Why it can cost you your account</h3>
                  <p>
                    Stripe is your acquirer. The card networks require Stripe to keep merchants&rsquo;
                    dispute activity under their limits and fine Stripe when it does not, so Stripe
                    watches your rate, warns you, and can limit or close your account to protect
                    itself. Stripe usually acts first, before the networks&rsquo; formal programs.
                  </p>
                  <h3>The levels that matter</h3>
                  <ul>
                    <li><strong>Stripe danger zone: 0.75%.</strong> At or above this, Stripe says network monitoring programs are likely triggered. Under about 0.65% is normal. A sharp upward trend can draw attention even lower.</li>
                    <li><strong>Visa (VAMP):</strong> excessive at 1.5% with 1,500+ disputes and fraud reports a month.</li>
                    <li><strong>Mastercard (ECP):</strong> 1.5%+ with 100+ chargebacks a month; severe (HECM) at 3%+ with 300+.</li>
                    <li><strong>Amex and Discover</strong> run their own monitoring on top.</li>
                    <li>Most smaller merchants are under every network&rsquo;s count, so Stripe&rsquo;s own limit is the real line for them.</li>
                  </ul>
                  <h3>The worst case</h3>
                  <p>
                    A merchant terminated for excessive chargebacks can land on the MATCH list, which
                    can block getting a new payment processor for up to five years.
                  </p>
                  <h3>What helps</h3>
                  <p>
                    Certain Visa fraud disputes defended under Visa&rsquo;s Compelling Evidence 3.0
                    rules are excluded from the Visa count.
                  </p>
                  <div className={styles.sources}>
                    <span className={styles.sTitle}>Verify it yourself</span>
                    <a href="https://docs.stripe.com/disputes/measuring" target="_blank" rel="noopener noreferrer">Measuring disputes, incl. the 0.75% thresholds (Stripe)</a>
                    <a href="https://docs.stripe.com/disputes/monitoring-programs" target="_blank" rel="noopener noreferrer">Dispute monitoring programs (Stripe)</a>
                    <a href="https://corporate.visa.com/en/sites/visa-perspectives/security-trust/introducing-visa-acquirer-monitoring-program.html" target="_blank" rel="noopener noreferrer">Introducing VAMP (Visa)</a>
                    <a href="https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf" target="_blank" rel="noopener noreferrer">VAMP Fact Sheet 2025, PDF (Visa)</a>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* ─── DEEP-GREEN STATEMENT POSTER ─────────────────────────── */}
        <section className={styles.poster} aria-label="Why this matters">
          <svg className={styles.posterSeal} viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <circle cx="13" cy="13" r="11" stroke="var(--mint)" strokeWidth="1.4" strokeDasharray="4 3.5" opacity="0.55" />
            <path d="M8.2 13.4l3.1 3.1 6.5-6.8" stroke="var(--mint)" strokeWidth="1.6" strokeLinecap="square" opacity="0.7" />
          </svg>
          <div className="wrap">
            <div className={`${styles.posterRule} reveal-view`} aria-hidden="true">
              <i className={styles.g1} /><span className={styles.gx} /><i className={styles.g2} />
            </div>
            <p className={`${styles.posterP} reveal-view`}>
              Every dispute counts against your rate, even the ones you win.
              <span className={styles.posterSub}>
                Winning a dispute recovers the cash. Only fewer disputes bring the rate down. That is
                why account health and evidence are two different jobs.
              </span>
            </p>
          </div>
        </section>

        {/* ─── RECOMMENDATIONS (band-keyed) ────────────────────────── */}
        {hasVerdict && (
          <section className={styles.recsSection} style={{ background: 'var(--paper-2)' }}>
            <div className="wrap reveal-view">
              <h2 className={styles.recsHead}>What to do next</h2>
              <p className={styles.recsSub}>Keyed to where your account stands today.</p>
              <ol className={styles.recsList}>
                {RECS[band].map((rec, i) => (
                  <li className={styles.recItem} key={i}>
                    <span className={styles.rNum} aria-hidden="true">{i + 1}</span>
                    <p>{rec}</p>
                  </li>
                ))}
              </ol>
              <p className={styles.recsFoot}>
                These are guidance, not automation. Verdact shows you the move; you decide what to act on.
              </p>
            </div>
          </section>
        )}

        {/* ─── CONVERSION ──────────────────────────────────────────── */}
        <section className={styles.convertWrap}>
          <div className={`wrap ${styles.convertSection}`}>
            <div className={`${styles.convert} reveal-view`}>
              <div>
                <p className={styles.convertLabel}>Stop tracking this by hand</p>
                <h2 className={styles.convertHead}>Connect Stripe once. Verdact watches it daily.</h2>
                <p className={styles.convertSub}>
                  Verdact updates these numbers every day and warns you before you reach
                  Stripe&rsquo;s 0.75% line, so account risk is never a surprise.
                </p>
                <div className={styles.convertCtas}>
                  <Link href="/audit" className={`${styles.btn} ${styles.btnPrimary}`}>See your free audit</Link>
                  <Link href="/#how" className={`${styles.btn} ${styles.btnGhost}`}>See how Verdact works</Link>
                </div>
              </div>

              <div className={styles.compare}>
                <div className={styles.compareHead}>
                  <span>Tracking by hand</span>
                  <span>With Verdact</span>
                </div>
                {COMPARE_ROWS.map((row, i) => (
                  <div className={styles.compareRow} key={i}>
                    <span className={styles.manual}>{row.manual}</span>
                    <span className={styles.auto}>
                      <CheckIcon />
                      {row.auto}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
