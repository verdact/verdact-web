'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MarketingHeader } from '../../_components/marketing/marketing-header';
import { MarketingFooter } from '../../_components/marketing/marketing-footer';
import { CheckIcon, AlertTriangleIcon } from '../../_components/home-icons';
import { ScrollReveals } from '../../_components/ui/scroll-reveals';
import styles from './vamp-check.module.css';

// ─── Thresholds (verified 2026-06-07 against the vault Stripe/Visa extracts) ──
const SCORE_FLOOR = 50;       // settled charges/month below which a single event is noise
const HEALTHY_MAX = 0.65;     // under this = healthy
const STRIPE_LINE = 0.75;     // Stripe acts here; the operative line for most merchants
const GAUGE_MAX = 1.5;        // track right edge = Visa's excessive ratio
const VISA_EVENT_GATE = 1500; // Visa VAMP monitoring count gate (events/month)
const MC_CB_GATE = 100;       // Mastercard ECP monitoring count gate (chargebacks/month)

// Stripe's 0.75% sits at the 50% mark of the track (0 → 1.5%).
const STRIPE_POS = (STRIPE_LINE / GAUGE_MAX) * 100; // 50
const HEALTHY_POS = (HEALTHY_MAX / GAUGE_MAX) * 100; // 43.33

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
    band: 'empty',
    ratio: 0,
    numerator,
    settled,
    disputes,
    bufferEvents: 0,
    markerPos: 0,
    highCount: false,
    hasRate: false,
  };

  // Need a positive settled count to compute a rate.
  if (form.settled.trim() === '' || settled <= 0) {
    if (settled < 0 || disputes < 0 || fraud < 0) return { ...base, band: 'invalid' };
    return base;
  }

  // Disputes + fraud can never exceed your settled charges.
  if (settled < 0 || disputes < 0 || fraud < 0 || numerator > settled) {
    return { ...base, band: 'invalid' };
  }

  const ratio = (numerator / settled) * 100;
  const bufferEvents = Math.floor(settled * (STRIPE_LINE / 100)) - numerator;
  const markerPos = clamp((ratio / GAUGE_MAX) * 100, 1.5, 98.5);
  const highCount = disputes >= MC_CB_GATE || numerator >= VISA_EVENT_GATE;

  let band: Band;
  if (settled < SCORE_FLOOR) band = 'tooEarly';
  else if (ratio < HEALTHY_MAX) band = 'healthy';
  else if (ratio < STRIPE_LINE) band = 'close';
  else band = 'atRisk';

  return { band, ratio, numerator, settled, disputes, bufferEvents, markerPos, highCount, hasRate: true };
}

// ─── Static content ──────────────────────────────────────────────────────────

const INPUTS: { id: keyof FormValues; label: string; help: string; placeholder: string }[] = [
  {
    id: 'settled',
    label: 'Settled transactions',
    help: 'Successful card charges across all brands. In Stripe: Balance Transactions, type=payment.',
    placeholder: 'e.g. 4200',
  },
  {
    id: 'disputes',
    label: 'Disputes received',
    help: 'Chargebacks and inquiries. In Stripe: Disputes.',
    placeholder: 'e.g. 12',
  },
  {
    id: 'fraud',
    label: 'Fraud reports received',
    help: 'Early fraud warnings (TC40). In Stripe: Radar, Reviews.',
    placeholder: 'e.g. 8',
  },
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
  const showScale = hasVerdict; // gauge appears once a rate exists
  const bandClass = band === 'atRisk' ? styles.atRisk : band === 'close' ? styles.close
    : band === 'healthy' ? styles.healthy : styles.empty;
  const youColor =
    band === 'atRisk' ? 'var(--gap)' : band === 'close' ? 'var(--warning)' : 'var(--verdict)';

  const ratioDisplay = result.hasRate ? `${result.ratio.toFixed(2)}%` : '—';

  const setField = (id: keyof FormValues) => (value: string) =>
    setForm((prev) => ({ ...prev, [id]: value.replace(/[^\d]/g, '') }));

  // Live summary for assistive tech (announced politely on change).
  const liveSummary = !result.hasRate
    ? 'Enter your numbers to see where your account stands.'
    : `Your dispute rate is ${result.ratio.toFixed(2)} percent. Status: ${
        band === 'empty' || band === 'invalid' ? 'unavailable' : VERDICT_LABEL[band]
      }.`;

  return (
    <>
      <ScrollReveals />
      <MarketingHeader ctaLabel="Start free" ctaHref="/signup" />

      <main id="main" className={styles.page}>
        {/* ─── B. HERO ─────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className="wrap reveal-view">
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
            <p className={styles.bridge}>
              Searching for your VAMP ratio? VAMP is Visa&rsquo;s version. We show your overall
              dispute rate, since Stripe and every card network watch it.
            </p>
            <p className={styles.hook}>
              Most merchants get limited by Stripe at 0.75%, well before any single card
              network&rsquo;s program kicks in. We show you the line that actually applies at your
              volume.
            </p>
          </div>
        </section>

        {/* ─── C + D. CALCULATOR + RESULT ──────────────────────────── */}
        <section>
          <div className={`wrap ${styles.calcWrap}`}>
            <div className={`${styles.autoStrip} reveal-view`}>
              <span className={styles.dotPulse} aria-hidden="true" />
              <span className={styles.lead}>Automatic with Verdact</span>
              <span className={styles.txt}>
                Connect Stripe and these numbers update daily, with a warning before you reach
                Stripe&rsquo;s 0.75% line.
              </span>
            </div>

            <div className={styles.calcGrid}>
              {/* Inputs */}
              <div className="reveal-view">
                <p className={styles.colLabel}>Your numbers (last 30 days)</p>
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

              {/* Result */}
              <div className="reveal-view">
                <p className={styles.colLabel}>Your result</p>
                <div className={`${styles.result} ${scored ? bandClass : ''}`}>
                  <div className={styles.resultBody}>
                    <span
                      style={{
                        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                        overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
                      }}
                      aria-live="polite"
                    >
                      {liveSummary}
                    </span>

                    {/* D1 — the number */}
                    <div className={styles.figureRow}>
                      <span className={styles.figureLabel}>Your dispute rate</span>
                      <span className={`${styles.figure} ${scored ? bandClass : result.hasRate ? '' : styles.empty}`}>
                        {ratioDisplay}
                      </span>
                    </div>
                    {result.hasRate && (
                      <p className={styles.figureNote}>
                        This is your overall rate across all card brands. Each network has its own
                        version. Visa calls it VAMP.
                      </p>
                    )}

                    {/* invalid */}
                    {band === 'invalid' && (
                      <div className={styles.invalid} role="alert">
                        <AlertTriangleIcon />
                        <span>
                          Check these numbers. Disputes and fraud reports should be part of your
                          settled charges, not on top of them.
                        </span>
                      </div>
                    )}

                    {/* empty */}
                    {band === 'empty' && (
                      <p className={styles.verdictMsg}>
                        Enter your numbers to see where your account stands.
                      </p>
                    )}

                    {/* D2 — verdict band */}
                    {hasVerdict && (
                      <>
                        <span className={`${styles.verdict} ${bandClass}`}>
                          <span className={styles.bdot} aria-hidden="true" />
                          {VERDICT_LABEL[band]}
                        </span>

                        {band === 'tooEarly' && (
                          <p className={styles.verdictMsg}>
                            With <strong>{fmt(result.settled)}</strong> charges, one or two disputes
                            can swing this number a lot. Your volume is too low for this rate to mean
                            much yet. Here is what to watch as you grow.
                          </p>
                        )}
                        {band === 'healthy' && (
                          <p className={styles.verdictMsg}>
                            You are comfortably under Stripe&rsquo;s 0.75% line. Keep it there.
                          </p>
                        )}
                        {band === 'close' && (
                          <p className={styles.verdictMsg}>
                            You are between the normal range and Stripe&rsquo;s 0.75% line. Act now,
                            while you still have room.
                          </p>
                        )}
                        {band === 'atRisk' && (
                          <p className={styles.verdictMsg}>
                            Your estimate is at or above Stripe&rsquo;s 0.75% line. Confirm your exact
                            status in Stripe and start remediating today.
                          </p>
                        )}

                        {/* D3 — operative-line read */}
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

                        {/* D5 — buffer */}
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

                    {/* D4 — reference scale */}
                    {showScale && (
                      <div className={styles.scale}>
                        <p className={styles.scaleLabel}>Where you fall</p>
                        <div className={styles.gauge} aria-hidden="true">
                          <span className={`${styles.gaugeZone} ${styles.healthy}`} />
                          <span className={`${styles.gaugeZone} ${styles.close}`} />
                          <span className={`${styles.gaugeZone} ${styles.risk}`} />
                          <span className={styles.gaugeTick} style={{ left: `${STRIPE_POS}%` }} />
                          <span className={styles.gaugeTickLabel} style={{ left: `${STRIPE_POS}%` }}>
                            0.75%
                            <span>Stripe acts here</span>
                          </span>
                          <span
                            className={styles.gaugeYou}
                            style={{ left: `${result.markerPos}%`, background: youColor }}
                          >
                            <i className={styles.gaugeYouDot} style={{ background: youColor }} />
                          </span>
                        </div>
                        <div className={styles.gaugeEnds}>
                          <span>0%</span>
                          <span>1.5% &middot; Visa excessive</span>
                        </div>

                        <div className={styles.netList}>
                          {NETWORKS.map(({ name, desc, primary }) => (
                            <div className={styles.netRow} key={name}>
                              <span className={`${styles.nName} ${primary ? styles.primary : ''}`}>{name}</span>
                              <span className={styles.nDesc}>{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── F. RECOMMENDATIONS ──────────────────────────────────── */}
        {hasVerdict && (
          <section>
            <div className="wrap reveal-view">
              <h2 className={styles.recsHead}>What to do next</h2>
              <ol className={styles.recsList}>
                {RECS[band].map((rec, i) => (
                  <li className={styles.recItem} key={i}>
                    <span className={styles.rNum} aria-hidden="true">{i + 1}</span>
                    <p>{rec}</p>
                  </li>
                ))}
              </ol>
              <p style={{ marginTop: 18, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: '64ch' }}>
                Fighting a dispute can recover the cash, but most service disputes still count toward
                your rate even when you win. Only fewer disputes bring the rate down.
              </p>
            </div>
          </section>
        )}

        {/* ─── E. EXPLAINER (inline, crawlable) ────────────────────── */}
        <section className={styles.explainerWrap}>
          <div className="wrap reveal-view">
            <details className={styles.explainer}>
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
                  <li>
                    <strong>Stripe danger zone: 0.75%.</strong> At or above this, Stripe says network
                    monitoring programs are likely triggered. Under about 0.65% is normal. A sharp
                    upward trend can draw attention even lower.
                  </li>
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
                  <a href="https://docs.stripe.com/disputes/measuring" target="_blank" rel="noopener noreferrer">
                    Measuring disputes, incl. the 0.75% thresholds (Stripe)
                  </a>
                  <a href="https://docs.stripe.com/disputes/monitoring-programs" target="_blank" rel="noopener noreferrer">
                    Dispute monitoring programs (Stripe)
                  </a>
                  <a href="https://corporate.visa.com/en/sites/visa-perspectives/security-trust/introducing-visa-acquirer-monitoring-program.html" target="_blank" rel="noopener noreferrer">
                    Introducing VAMP (Visa)
                  </a>
                  <a href="https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf" target="_blank" rel="noopener noreferrer">
                    VAMP Fact Sheet 2025, PDF (Visa)
                  </a>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* ─── G. CONVERSION ───────────────────────────────────────── */}
        <section className={styles.convertWrap}>
          <div className={`wrap ${styles.convert} reveal-view`}>
            <div>
              <p className={styles.colLabel}>Stop tracking this by hand</p>
              <h2 className={styles.convertHead}>Connect Stripe once. Verdact watches it daily.</h2>
              <p className={styles.convertSub}>
                Verdact updates these numbers every day and warns you before you reach
                Stripe&rsquo;s 0.75% line, so account risk is never a surprise.
              </p>
              <div className={styles.convertCtas}>
                <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>Create workspace</Link>
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
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
