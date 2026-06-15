'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MarketingHeader } from '../_components/marketing/marketing-header';
import { MarketingFooter } from '../_components/marketing/marketing-footer';
import { parseStripeDisputesCsv } from '@/lib/audit/parse-csv';
import { computeAuditScore } from '@/lib/audit/scoring';
import type { AuditDispute, AuditScore } from '@/lib/audit/types';
import { AuditResult } from './AuditResult';
import { ManualDisputeRows, makeBlankRow } from './ManualEntry';
import { track } from '@/lib/analytics/track';
import styles from './audit.module.css';

type Phase = 'landing' | 'entry' | 'result';

const MAX_FILE_BYTES = 1_000_000;

export function AuditFunnel() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [settled, setSettled] = useState('');
  const [windowDays, setWindowDays] = useState('90');
  const [email, setEmail] = useState('');
  const [csvDisputes, setCsvDisputes] = useState<AuditDispute[]>([]);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<AuditDispute[]>([makeBlankRow()]);
  const [mode, setMode] = useState<'csv' | 'manual'>('csv');
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<AuditScore | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settledNum = useMemo(() => {
    const n = parseInt(settled.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }, [settled]);

  const activeDisputes = mode === 'csv' ? csvDisputes : manualRows.filter(isUsableRow);

  // Live preview of the dispute-rate read while the merchant fills the form, so
  // the entry step already feels like an instrument (mirrors VampChecker).
  const previewScore = useMemo(() => {
    if (activeDisputes.length === 0 || settledNum <= 0) return null;
    return computeAuditScore(activeDisputes, {
      settledTransactionCount: settledNum,
      windowDays: parseInt(windowDays, 10) || 90,
    });
  }, [activeDisputes, settledNum, windowDays]);

  const handleFile = useCallback(async (file: File) => {
    setFormError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFormError('That file is larger than 1 MB. Export just your last 90 days of disputes.');
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFormError('Please upload a .csv export from Stripe.');
      return;
    }
    try {
      const text = await file.text();
      const result = parseStripeDisputesCsv(text);
      setCsvDisputes(result.disputes);
      setCsvWarnings(result.warnings);
      setCsvFileName(file.name);
      if (result.disputes.length === 0) {
        setFormError('We could not read any disputes from that file. Try manual entry instead.');
      }
    } catch {
      setFormError('We could not read that file. Try manual entry instead.');
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const validateAndSubmit = useCallback(async () => {
    setFormError(null);
    setEmailError(null);

    if (settledNum <= 0) {
      setFormError('Enter your settled card payment count for the window so we can compute your dispute rate.');
      return;
    }
    if (activeDisputes.length === 0) {
      setFormError(
        mode === 'csv'
          ? 'Upload a Stripe disputes export, or switch to manual entry.'
          : 'Add at least one dispute, with its reason, to score.',
      );
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email so we can send your audit and carry it into your account.');
      return;
    }

    // Reveal the result and capture a PII-free funnel event — aggregate score
    // signals only. The email and the raw dispute rows are never sent to PostHog;
    // they live only in Supabase `audit_leads` (the system of record).
    const reveal = (s: AuditScore, scoredBy: 'server' | 'client') => {
      track('audit_result_viewed', {
        scored_by: scoredBy,
        entry_mode: mode,
        window_days: parseInt(windowDays, 10) || 90,
        total_disputes: s.summary.totalDisputes,
        should_have_won: s.summary.shouldHaveWonCount,
        comms_hinged: s.summary.commsHingedCount,
        standing_band: s.rate.band,
        dispute_rate_pct:
          s.rate.ratioPercent == null
            ? null
            : Math.round(s.rate.ratioPercent * 100) / 100,
      });
      setScore(s);
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    setSubmitting(true);
    try {
      const res = await fetch('/audit/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          settledTransactionCount: settledNum,
          windowDays: parseInt(windowDays, 10) || 90,
          disputes: activeDisputes,
        }),
      });

      if (!res.ok) {
        // Fall back to a client-side score so the merchant still gets a result.
        reveal(
          computeAuditScore(activeDisputes, {
            settledTransactionCount: settledNum,
            windowDays: parseInt(windowDays, 10) || 90,
          }),
          'client',
        );
        return;
      }

      const data = (await res.json()) as { score: AuditScore };
      reveal(data.score, 'server');
    } catch {
      reveal(
        computeAuditScore(activeDisputes, {
          settledTransactionCount: settledNum,
          windowDays: parseInt(windowDays, 10) || 90,
        }),
        'client',
      );
    } finally {
      setSubmitting(false);
    }
  }, [activeDisputes, email, mode, settledNum, windowDays]);

  return (
    <>
      <MarketingHeader ctaLabel="Join the waitlist" ctaHref="/signup" />
      <main id="main" className={styles.page}>
        {phase === 'landing' && (
          <Landing
            onStart={() => {
              track('audit_started');
              setPhase('entry');
            }}
          />
        )}

        {phase === 'entry' && (
          <Entry
            mode={mode}
            setMode={setMode}
            settled={settled}
            setSettled={setSettled}
            windowDays={windowDays}
            setWindowDays={setWindowDays}
            email={email}
            setEmail={(v) => {
              setEmail(v);
              if (emailError) setEmailError(null);
            }}
            emailError={emailError}
            formError={formError}
            csvFileName={csvFileName}
            csvDisputes={csvDisputes}
            csvWarnings={csvWarnings}
            fileInputRef={fileInputRef}
            onFileChange={onFileChange}
            manualRows={manualRows}
            setManualRows={setManualRows}
            previewScore={previewScore}
            submitting={submitting}
            onSubmit={validateAndSubmit}
          />
        )}

        {phase === 'result' && score && (
          <AuditResult
            score={score}
            email={email}
            onRestart={() => {
              setPhase('entry');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>
      <MarketingFooter />
    </>
  );
}

// ─── Landing ─────────────────────────────────────────────────────────────────

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className={styles.hero}>
        <div className="wrap">
          <div className={styles.heroInner}>
            <p className="eyebrow">Launching soon &middot; free dispute audit, no signup</p>
            <h1 className={styles.heroHeadline}>
              Find the Stripe disputes you <span className={styles.key}>should have won</span>.
            </h1>
            <p className={styles.subhead}>
              Services-not-rendered and cancelled-subscription chargebacks are the hardest to fight,
              because the proof lives in your email and delivery logs, not in Stripe, so Stripe marks
              them unavailable. Send your last 90 days of disputes and we will show you which were
              winnable, and where your dispute rate stands.
            </p>
            <div className={styles.heroCtas}>
              <button type="button" className={styles.ctaPrimary} onClick={onStart}>
                Start your audit
              </button>
              <span className={styles.ctaNote}>Takes about two minutes. No account needed.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.valueBand}>
        <div className="wrap">
          <ul className={styles.valueGrid}>
            <li className={styles.valueCard}>
              <span className={styles.valueNum}>01</span>
              <h2>Which disputes you should have won</h2>
              <p>
                Per dispute, we read the reason code and the proof you hold, and flag the ones with the
                profile that typically wins on representment.
              </p>
            </li>
            <li className={styles.valueCard}>
              <span className={styles.valueNum}>02</span>
              <h2>Where your dispute rate stands</h2>
              <p>
                Your rate against the 0.75% line where Stripe can limit your account, with the headroom
                you have left at your volume.
              </p>
            </li>
            <li className={styles.valueCard}>
              <span className={styles.valueNum}>03</span>
              <h2>The comms-layer the others miss</h2>
              <p>
                How many of your disputes hinged on email and Slack evidence that Stripe-native tools
                cannot reach &mdash; the exact cases they mark unavailable.
              </p>
            </li>
          </ul>
          <div className={styles.startRow}>
            <button type="button" className={styles.ctaPrimary} onClick={onStart}>
              Start your audit
            </button>
            <Link href="/tools/vamp-check" className={styles.linkGhost}>
              Just want your dispute rate? Try the quick checker
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Entry ───────────────────────────────────────────────────────────────────

interface EntryProps {
  mode: 'csv' | 'manual';
  setMode: (m: 'csv' | 'manual') => void;
  settled: string;
  setSettled: (v: string) => void;
  windowDays: string;
  setWindowDays: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  emailError: string | null;
  formError: string | null;
  csvFileName: string | null;
  csvDisputes: AuditDispute[];
  csvWarnings: string[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  manualRows: AuditDispute[];
  setManualRows: React.Dispatch<React.SetStateAction<AuditDispute[]>>;
  previewScore: AuditScore | null;
  submitting: boolean;
  onSubmit: () => void;
}

function Entry(props: EntryProps) {
  const {
    mode, setMode, settled, setSettled, windowDays, setWindowDays, email, setEmail,
    emailError, formError, csvFileName, csvDisputes, csvWarnings, fileInputRef,
    onFileChange, manualRows, setManualRows, previewScore, submitting, onSubmit,
  } = props;

  const digitsOnly = (v: string) => v.replace(/[^\d]/g, '');

  return (
    <section className={styles.entry}>
      <div className="wrap">
        <p className="eyebrow">Step 1 of 2 &middot; Your last 90 days</p>
        <h1 className={styles.entryHead}>Tell us about your disputes</h1>
        <p className={styles.entrySub}>
          Two ways in: upload a Stripe disputes export, or enter them by hand. Either way we never store
          your file &mdash; only the rows you give us, so we can score them and carry them into your account.
        </p>

        <div className={styles.entryGrid}>
          <div className={styles.entryMain}>
            {/* Volume inputs */}
            <div className={styles.volumeRow}>
              <div className="field">
                <label htmlFor="audit-settled">
                  Settled card payments in the window <span className={styles.req}>*</span>
                </label>
                <input
                  id="audit-settled"
                  className="inp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={settled}
                  onChange={(e) => setSettled(digitsOnly(e.target.value))}
                  placeholder="e.g. 4200"
                  aria-describedby="audit-settled-help"
                />
                <p className="help" id="audit-settled-help">
                  Successful card charges across all brands. In Stripe: Payments, filtered to succeeded.
                </p>
              </div>
              <div className="field">
                <label htmlFor="audit-window">Window length</label>
                <select
                  id="audit-window"
                  className="inp"
                  value={windowDays}
                  onChange={(e) => setWindowDays(e.target.value)}
                >
                  <option value="30">Last 30 days</option>
                  <option value="60">Last 60 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 180 days</option>
                  <option value="365">Last 12 months</option>
                </select>
                <p className="help">Match this to the window your disputes cover.</p>
              </div>
            </div>

            {/* Mode tabs */}
            <div className={styles.modeTabs} role="tablist" aria-label="How to enter disputes">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'csv'}
                className={`${styles.modeTab} ${mode === 'csv' ? styles.modeTabActive : ''}`}
                onClick={() => setMode('csv')}
              >
                Upload Stripe export
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'manual'}
                className={`${styles.modeTab} ${mode === 'manual' ? styles.modeTabActive : ''}`}
                onClick={() => setMode('manual')}
              >
                Enter by hand
              </button>
            </div>

            {mode === 'csv' ? (
              <div className={styles.uploadPane}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFileChange}
                  className={styles.fileInputHidden}
                  id="audit-file"
                />
                <label htmlFor="audit-file" className={styles.dropZone}>
                  <span className={styles.dropTitle}>
                    {csvFileName ? csvFileName : 'Choose your Stripe disputes export'}
                  </span>
                  <span className={styles.dropHint}>
                    {csvDisputes.length > 0
                      ? `${csvDisputes.length} disputes read from your file`
                      : 'In Stripe: Disputes → Export. CSV up to 1 MB. We read it in your browser.'}
                  </span>
                </label>
                {csvWarnings.length > 0 && (
                  <ul className={styles.warnList}>
                    {csvWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
                {csvDisputes.length > 0 && (
                  <p className={styles.csvNote}>
                    Exports do not include which proof you hold, so per-dispute winnability starts cautious.
                    Switch to manual entry to flag delivery, usage, and comms proof and sharpen the read.
                  </p>
                )}
              </div>
            ) : (
              <ManualDisputeRows rows={manualRows} setRows={setManualRows} />
            )}

            {/* Email + submit */}
            <div className={styles.submitBlock}>
              <div className="field">
                <label htmlFor="audit-email">
                  Where should we send your audit? <span className={styles.req}>*</span>
                </label>
                <input
                  id="audit-email"
                  className={`inp ${emailError ? 'inp--error' : ''}`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'audit-email-err' : 'audit-email-help'}
                />
                {emailError ? (
                  <p className="err" id="audit-email-err">{emailError}</p>
                ) : (
                  <p className="help" id="audit-email-help">
                    We send your result here and use it to pre-load your history if you create an account.
                  </p>
                )}
              </div>

              {formError && (
                <div className={styles.formError} role="alert">{formError}</div>
              )}

              <button
                type="button"
                className={styles.ctaPrimary}
                onClick={onSubmit}
                disabled={submitting}
              >
                {submitting ? 'Scoring your disputes…' : 'See my results'}
              </button>
              <p className={styles.privacyNote}>
                No automation runs on your account. This is a read-only audit you control.
              </p>
            </div>
          </div>

          {/* Live preview rail */}
          <aside className={styles.previewRail} aria-label="Live preview">
            <p className={styles.previewLabel}>Live preview</p>
            {previewScore ? (
              <PreviewCard score={previewScore} />
            ) : (
              <div className={styles.previewEmpty}>
                <p>Add your volume and at least one dispute to see your dispute rate take shape.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({ score }: { score: AuditScore }) {
  const { rate, summary } = score;
  const pct = rate.ratioPercent;
  return (
    <div className={styles.previewCard}>
      <p className={styles.previewStat}>{pct == null ? '—' : `${pct.toFixed(2)}%`}</p>
      <p className={styles.previewStatLabel}>estimated dispute rate</p>
      <dl className={styles.previewList}>
        <div>
          <dt>Disputes</dt>
          <dd>{summary.totalDisputes}</dd>
        </div>
        <div>
          <dt>Likely winnable</dt>
          <dd>{summary.shouldHaveWonCount || summary.strongCount}</dd>
        </div>
        <div>
          <dt>Comms-grounded</dt>
          <dd>{summary.commsHingedCount}</dd>
        </div>
      </dl>
      <p className={styles.previewFoot}>Submit to see the full read and every dispute.</p>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isUsableRow(row: AuditDispute): boolean {
  // A manual row counts only once the merchant has actively picked a reason.
  // makeBlankRow() leaves reasonRaw null until the select changes, so untouched
  // rows are ignored. Amount and outcome stay optional.
  return row.reasonRaw !== null;
}
