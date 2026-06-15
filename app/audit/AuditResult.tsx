'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { AuditScore, ScoredDispute, StandingBand, WinnabilityTier } from '@/lib/audit/types';
import { STRIPE_LINE, GAUGE_MAX } from '@/lib/audit/scoring';
import styles from './audit.module.css';

const STRIPE_POS = (STRIPE_LINE / GAUGE_MAX) * 100; // 50

const BAND_LABEL: Record<StandingBand, string> = {
  tooEarly: 'Too early to score',
  healthy: 'Healthy',
  close: 'Getting close',
  atRisk: 'At risk',
  unknown: 'Not enough data',
};

const TIER_LABEL: Record<WinnabilityTier, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
  unlikely: 'Unlikely',
};

interface AuditResultProps {
  score: AuditScore;
  email: string;
  onRestart: () => void;
}

export function AuditResult({ score, email, onRestart }: AuditResultProps) {
  const { rate, summary, disputes } = score;

  const shouldHaveWon = useMemo(
    () => disputes.filter((d) => d.shouldHaveWon).sort(byAmountDesc),
    [disputes],
  );
  const otherWinnable = useMemo(
    () =>
      disputes
        .filter((d) => !d.shouldHaveWon && (d.tier === 'strong' || d.tier === 'moderate'))
        .sort(byAmountDesc),
    [disputes],
  );

  const currency = summary.currency ?? 'usd';
  const pct = rate.ratioPercent;
  const bandClass =
    rate.band === 'atRisk' ? styles.atRisk : rate.band === 'close' ? styles.close : styles.healthy;

  return (
    <>
      {/* ─── Standing read ─────────────────────────────────────────── */}
      <section className={styles.resultHero}>
        <div className="wrap">
          <p className="eyebrow">Your dispute audit</p>
          <h1 className={styles.resultHead}>
            {summary.shouldHaveWonCount > 0 ? (
              <>
                {summary.shouldHaveWonCount} dispute{summary.shouldHaveWonCount === 1 ? '' : 's'} you{' '}
                <span className={styles.key}>likely should have won</span>.
              </>
            ) : (
              <>Here is where your account stands.</>
            )}
          </h1>
          <p className={styles.resultSub}>
            Based on {summary.totalDisputes} dispute{summary.totalDisputes === 1 ? '' : 's'} across the
            window. This is a read on your proof profile, not a guarantee of any outcome.
          </p>

          <div className={styles.headlineStats}>
            <Stat
              big
              value={pct == null ? '—' : `${pct.toFixed(2)}%`}
              label="Estimated dispute rate"
              tone={rate.band === 'atRisk' ? 'gap' : 'verdict'}
            />
            <Stat
              value={String(summary.shouldHaveWonCount)}
              label="Should likely have won"
              tone="verdict"
            />
            <Stat
              value={String(summary.commsHingedCount)}
              label="Hinged on comms evidence"
              tone="verdict"
            />
            {summary.recoverableAmount > 0 && (
              <Stat
                value={formatMoney(summary.recoverableAmount, currency)}
                label="Tied up in lost disputes"
                tone="gap"
              />
            )}
          </div>
        </div>
      </section>

      {/* ─── Gauge ─────────────────────────────────────────────────── */}
      <section className={styles.gaugeSection}>
        <div className="wrap">
          <div className={`${styles.gaugeCard} ${bandClass}`}>
            <div className={styles.gaugeHead}>
              <div>
                <span className={`${styles.bandPill} ${bandClass}`}>
                  <span className={styles.bandDot} aria-hidden="true" />
                  {BAND_LABEL[rate.band]}
                </span>
                <p className={styles.gaugeTitle}>
                  Your dispute rate against Stripe&rsquo;s 0.75% line
                </p>
              </div>
              {rate.bufferEvents != null && rate.band !== 'atRisk' && rate.bufferEvents >= 0 && (
                <p className={styles.headroom}>
                  About <strong>{rate.bufferEvents}</strong> more dispute or fraud event
                  {rate.bufferEvents === 1 ? '' : 's'} this window before you cross the line at this volume.
                </p>
              )}
              {rate.band === 'atRisk' && (
                <p className={styles.headroom}>
                  You are at or above the 0.75% line. Confirm your exact status in Stripe and start
                  remediating today.
                </p>
              )}
            </div>

            <div
              className={styles.gauge}
              role="img"
              aria-label={
                pct == null
                  ? 'Dispute-rate scale from 0 to 1.5 percent. Stripe acts at 0.75 percent.'
                  : `Your dispute rate ${pct.toFixed(2)} percent on a scale to 1.5 percent. Stripe acts at 0.75 percent.`
              }
            >
              <span className={`${styles.gaugeZone} ${styles.zHealthy}`} />
              <span className={`${styles.gaugeZone} ${styles.zClose}`} />
              <span className={`${styles.gaugeZone} ${styles.zRisk}`} />
              <span className={styles.gaugeTick} style={{ left: `${STRIPE_POS}%` }} />
              <span className={styles.gaugeTickLabel} style={{ left: `${STRIPE_POS}%` }}>
                0.75%
                <span>Stripe acts here</span>
              </span>
              {rate.markerPercent != null && (
                <span className={styles.gaugeYou} style={{ left: `${rate.markerPercent}%` }}>
                  <i className={styles.gaugeYouDot} />
                </span>
              )}
            </div>
            <div className={styles.gaugeEnds}>
              <span>0%</span>
              <span>1.5% &middot; Visa excessive</span>
            </div>

            {rate.belowScoreFloor && (
              <p className={styles.gaugeNote}>
                At this volume one or two disputes swing the number a lot, so treat the rate as
                directional. The per-dispute reads below still hold.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── Comms-layer insight ───────────────────────────────────── */}
      {summary.commsHingedCount > 0 && (
        <section className={styles.insightBand}>
          <div className="wrap">
            <div className={styles.insightCard}>
              <p className={styles.insightKicker}>The comms layer</p>
              <p className={styles.insightBody}>
                <strong>{summary.commsHingedCount}</strong> of these disputes hinged on email and Slack
                evidence Stripe-native tools cannot reach. These are the service-delivery cases Stripe
                marks <em>unavailable</em> &mdash; exactly the ones Verdact is built to fight.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ─── Should-have-won list ──────────────────────────────────── */}
      <section className={styles.listSection}>
        <div className="wrap">
          {shouldHaveWon.length > 0 ? (
            <>
              <h2 className={styles.listHead}>Disputes you likely should have won</h2>
              <p className={styles.listSub}>
                Lost disputes whose reason code and proof profile typically win on representment.
              </p>
              <ul className={styles.disputeList}>
                {shouldHaveWon.map((d) => (
                  <DisputeCard key={d.id} dispute={d} currency={currency} highlight />
                ))}
              </ul>
            </>
          ) : (
            <div className={styles.emptyList}>
              <h2 className={styles.listHead}>No clear should-have-won disputes in this set</h2>
              <p className={styles.listSub}>
                Either you are already winning the winnable ones, or the deciding proof was not flagged.
                The reads below show where the leverage is.
              </p>
            </div>
          )}

          {otherWinnable.length > 0 && (
            <>
              <h3 className={styles.listHead2}>Other disputes with a winnable profile</h3>
              <ul className={styles.disputeList}>
                {otherWinnable.map((d) => (
                  <DisputeCard key={d.id} dispute={d} currency={currency} />
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ─── Conversion CTA ────────────────────────────────────────── */}
      <section className={styles.convert}>
        <div className="wrap">
          <div className={styles.convertCard}>
            <p className={styles.convertKicker}>Verdact is launching soon</p>
            <h2 className={styles.convertHead}>
              Be first in line to fight the disputes you should win.
            </h2>
            <p className={styles.convertSub}>
              New workspaces are not open to the public yet. Join the waitlist and we&rsquo;ll tell you
              the moment you can create yours &mdash; then pre-load{' '}
              {summary.totalDisputes === 1
                ? 'this dispute'
                : `these ${summary.totalDisputes} disputes`}{' '}
              as your starting history. You build and view the evidence packet for free, and
              nothing is ever filed without your sign-off.
            </p>
            <div className={styles.convertCtas}>
              <Link
                href={`/signup?from=audit&email=${encodeURIComponent(email)}`}
                className={styles.ctaPrimary}
              >
                Join the waitlist
              </Link>
              <button type="button" className={styles.linkGhost} onClick={onRestart}>
                Edit my numbers
              </button>
            </div>
            <p className={styles.convertNote}>
              We emailed a copy of this audit to {email}.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  currency,
  highlight = false,
}: {
  dispute: ScoredDispute;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <li className={`${styles.disputeCard} ${highlight ? styles.disputeCardHi : ''}`}>
      <div className={styles.disputeTop}>
        <div className={styles.disputeIdent}>
          <span className={styles.disputeReason}>{dispute.shortReason}</span>
          <span className={styles.disputeNetwork}>{dispute.networkLabel}</span>
        </div>
        <div className={styles.disputeMeta}>
          {dispute.amount != null && dispute.amount > 0 && (
            <span className={styles.disputeAmount}>{formatMoney(dispute.amount, currency)}</span>
          )}
          <span className={`${styles.tierPill} ${tierClass(dispute.tier)}`}>
            {TIER_LABEL[dispute.tier]} read
          </span>
        </div>
      </div>
      <p className={styles.disputeWhy}>{dispute.why}</p>
      {dispute.commsHinged && (
        <p className={styles.disputeFlag}>Hinges on comms evidence Stripe-native tools cannot reach</p>
      )}
    </li>
  );
}

function Stat({
  value,
  label,
  tone,
  big = false,
}: {
  value: string;
  label: string;
  tone: 'verdict' | 'gap';
  big?: boolean;
}) {
  return (
    <div className={`${styles.stat} ${big ? styles.statBig : ''}`}>
      <span className={`${styles.statValue} ${tone === 'gap' ? styles.toneGap : styles.toneVerdict}`}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function tierClass(tier: WinnabilityTier): string {
  if (tier === 'strong') return styles.tierStrong;
  if (tier === 'moderate') return styles.tierModerate;
  if (tier === 'weak') return styles.tierWeak;
  return styles.tierUnlikely;
}

function byAmountDesc(a: ScoredDispute, b: ScoredDispute): number {
  return (b.amount ?? 0) - (a.amount ?? 0);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString('en-US')}`;
  }
}
