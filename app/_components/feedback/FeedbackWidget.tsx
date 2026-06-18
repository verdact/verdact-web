'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  feedbackInputSchema,
  MESSAGE_MAX,
  ACTIVITY_MAX,
  type FeedbackCategory,
  type FeedbackSurface,
} from '@/lib/feedback/schema';
import {
  AUTO_HIDE_MS,
  PAGE_DELAY_MS,
  REST_DISMISS_MS,
  REST_LATER_MS,
  REST_SUBMIT_MS,
  isCadenceEligible,
  markShown,
  restPrompt,
} from './cadence';
import s from './feedback-widget.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackWidget — "send feedback from anywhere".
//
// Mounted ONCE in the root layout (after PostHogProvider children) so it works
// signed-out on marketing/auth as well as inside the app. Renders three things:
//   (1) a low-profile FAB (bottom-right, 44px, collapses under 560px),
//   (2) a centered, focus-trapped dialog (form + thank-you states), and
//   (3) a periodic prompt (bottom-left, cadence-gated via localStorage).
//
// Everything posts to the public route /api/feedback. The body NEVER carries
// merchant_id / user_agent — the server sets those (see app/api/feedback/route).
// Tokens only; brand laws applied (no em dashes, two-color law, manual-first).
// ─────────────────────────────────────────────────────────────────────────────

type View = 'form' | 'sent';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function deriveSurface(): FeedbackSurface {
  if (typeof window === 'undefined') return 'app';
  const path = window.location.pathname.toLowerCase();
  if (/sign|login|auth|onboard|password|verify-email|callback/.test(path)) return 'auth';
  // The app lives under /dashboard, /account-health, /settings; everything else
  // (/, /pricing, marketing) is treated as marketing.
  if (/^\/(dashboard|account-health|settings|admin)/.test(path)) return 'app';
  return 'marketing';
}

function screenName(): string {
  if (typeof window === 'undefined') return 'Home';
  try {
    const seg = window.location.pathname.split('/').filter(Boolean).pop() || 'Home';
    const cleaned = seg.replace(/[-_]/g, ' ').trim();
    if (!cleaned) return 'Home';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return 'Home';
  }
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '/';
  try {
    return window.location.pathname + (window.location.search || '');
  } catch {
    return '/';
  }
}

// ── Shared SVG snippets (currentColor, aria-hidden) ──────────────────────────
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 20l1.5-4.5a8.5 8.5 0 0 1 17-4Z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // overlay enter/leave class (toggled one frame after open)
  const [view, setView] = useState<View>('form');
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptShown, setPromptShown] = useState(false);

  // Form state
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [activity, setActivity] = useState('');
  const [email, setEmail] = useState('');
  const [route, setRoute] = useState('/');
  const [screen, setScreen] = useState('Home');
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<'message' | 'email' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const titleId = useId();
  const catLabelId = useId();
  const messageHelpId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the overlay enter transition: render at opacity 0, then add the
  // .isOpen class one frame later so the rise actually plays. Reduced-motion is
  // handled in CSS (transitions are disabled), so this is harmless there.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!promptOpen) {
      setPromptShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setPromptShown(true));
    return () => cancelAnimationFrame(raf);
  }, [promptOpen]);

  // ── Open / close ───────────────────────────────────────────────────────────
  const openPanel = useCallback(() => {
    lastFocused.current = (document.activeElement as HTMLElement) ?? null;
    setView('form');
    setError(null);
    setInvalidField(null);
    setSubmitting(false);
    setRoute(currentRoute());
    setScreen(screenName());
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    const opener = lastFocused.current;
    if (opener && typeof opener.focus === 'function') {
      try {
        opener.focus();
      } catch {
        /* opener gone */
      }
    }
  }, []);

  // Any element carrying [data-feedback-open] opens the panel (delegated, so rail
  // buttons and marketing footer links added by other surfaces wire for free).
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const opener = target?.closest?.('[data-feedback-open]');
      if (opener) {
        e.preventDefault();
        openPanel();
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openPanel]);

  // Focus the message field on open; ESC + focus trap while open.
  useEffect(() => {
    if (!open) return;
    const reduced = prefersReducedMotion();
    const t = setTimeout(() => messageRef.current?.focus(), reduced ? 0 : 80);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closePanel]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Honeypot: a real user never fills this. Show the thank-you, save nothing.
      if (website.trim().length > 0) {
        setView('sent');
        return;
      }

      const candidate = {
        surface: deriveSurface(),
        category,
        message: message.trim(),
        route: route.trim() || undefined,
        screen: screen.trim() || undefined,
        activity: activity.trim() || undefined,
        email: email.trim() || undefined,
        has_screenshot: hasScreenshot,
      };

      const parsed = feedbackInputSchema.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        if (issue?.path[0] === 'email') {
          setInvalidField('email');
          setError('That email does not look right. Leave it blank to stay anonymous.');
        } else {
          setInvalidField('message');
          setError('Add a short message so we know what you mean.');
          messageRef.current?.focus();
        }
        return;
      }

      setSubmitting(true);
      setError(null);
      setInvalidField(null);

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        // Rest the periodic prompt for 90 days after a submission.
        restPrompt('lastSubmitted', REST_SUBMIT_MS);
        setView('sent');
        // Reset the form fields behind the thank-you state.
        setMessage('');
        setActivity('');
        setEmail('');
        setHasScreenshot(false);
      } catch {
        setError('We could not send that. Try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [website, category, message, route, screen, activity, email, hasScreenshot],
  );

  // ── Category radiogroup keyboard nav (roving tabindex) ───────────────────────
  const onCatKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    let dir = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
    else return;
    e.preventDefault();
    const next = (index + dir + FEEDBACK_CATEGORIES.length) % FEEDBACK_CATEGORIES.length;
    setCategory(FEEDBACK_CATEGORIES[next]);
    const el = panelRef.current?.querySelectorAll<HTMLInputElement>('input[name="fbk-category"]')[next];
    el?.focus();
  }, []);

  // ── Periodic prompt cadence ──────────────────────────────────────────────────
  useEffect(() => {
    if (deriveSurface() !== 'app') return; // app surfaces only
    if (!isCadenceEligible()) return;

    const t = setTimeout(() => {
      // Re-check at fire time. The open feedback panel renders role="dialog"
      // aria-modal="true", so this query also catches our own panel — never
      // nudge while it (or any other modal / cmdk overlay) is open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (document.querySelector('.cmdk.is-open')) return;
      if (!isCadenceEligible()) return;
      markShown();
      setPromptOpen(true);
    }, PAGE_DELAY_MS);

    return () => clearTimeout(t);
    // Runs once per mount: the page-delay timer models the "first 45s" gate.
  }, []);

  // Auto-hide the prompt after ~20s idle (does NOT count as a dismiss).
  useEffect(() => {
    if (!promptOpen) return;
    promptTimer.current = setTimeout(() => setPromptOpen(false), AUTO_HIDE_MS);
    return () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    };
  }, [promptOpen]);

  const counter = useMemo(() => `${message.length} / ${MESSAGE_MAX}`, [message.length]);

  return (
    <>
      {/* ── FAB ── */}
      <button
        type="button"
        className={s.fab}
        data-feedback-open
        aria-haspopup="dialog"
        aria-controls="feedback-panel"
        aria-label="Send feedback"
        onClick={openPanel}
      >
        <ChatIcon />
        <span className={s.fabLabel}>Send feedback</span>
      </button>

      {/* ── Centered dialog ── */}
      {open ? (
        <div
          id="feedback-panel"
          className={`${s.overlay} ${shown ? s.isOpen : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(e) => {
            // Scrim click closes (only when the backdrop itself is the target).
            if (e.target === e.currentTarget) closePanel();
          }}
        >
          <div className={s.panel} role="document" ref={panelRef}>
            {view === 'form' ? (
              <>
                <div className={s.head}>
                  <div>
                    <span className={s.eyebrow}>Feedback</span>
                    <h2 className={s.title} id={titleId}>
                      Tell us what is working
                    </h2>
                  </div>
                  <button type="button" className={s.x} aria-label="Close feedback" onClick={closePanel}>
                    <CloseIcon />
                  </button>
                </div>
                <p className={s.sub}>A real person reads this. We never sell or share what you tell us.</p>

                <form noValidate onSubmit={onSubmit}>
                  {/* Category radiogroup */}
                  <div className={s.field}>
                    <span className={s.groupLabel} id={catLabelId}>
                      What kind of feedback is this?
                    </span>
                    <div className={s.cats} role="radiogroup" aria-labelledby={catLabelId}>
                      {FEEDBACK_CATEGORIES.map((value, index) => {
                        const checked = category === value;
                        return (
                          <label key={value} className={`${s.cat} ${checked ? s.catSelected : ''}`}>
                            <input
                              className={s.catInput}
                              type="radio"
                              name="fbk-category"
                              value={value}
                              checked={checked}
                              tabIndex={checked ? 0 : -1}
                              onChange={() => setCategory(value)}
                              onKeyDown={(e) => onCatKeyDown(e, index)}
                            />
                            <span className={s.catCheck} aria-hidden="true">
                              <CheckIcon />
                            </span>
                            <span>{FEEDBACK_CATEGORY_LABELS[value]}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Message */}
                  <div className={s.field}>
                    <div className={s.lblRow}>
                      <label className={s.label} htmlFor="fbk-message">
                        Your message
                      </label>
                      <span className={s.counter} aria-hidden="true">
                        {counter}
                      </span>
                    </div>
                    <textarea
                      id="fbk-message"
                      ref={messageRef}
                      className={s.textarea}
                      rows={4}
                      maxLength={MESSAGE_MAX}
                      required
                      value={message}
                      aria-describedby={messageHelpId}
                      aria-invalid={invalidField === 'message' ? 'true' : undefined}
                      placeholder="What happened, what you expected, or what you liked"
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (invalidField === 'message') {
                          setInvalidField(null);
                          setError(null);
                        }
                      }}
                    />
                    <p className={s.help} id={messageHelpId}>
                      Be as specific as you like. We read every note.
                    </p>
                  </div>

                  {/* Activity (optional) */}
                  <div className={s.field}>
                    <label className={s.label} htmlFor="fbk-activity">
                      What you were doing <span className={s.optional}>(optional)</span>
                    </label>
                    <input
                      id="fbk-activity"
                      className={s.input}
                      type="text"
                      maxLength={ACTIVITY_MAX}
                      value={activity}
                      placeholder="e.g. reviewing a dispute before filing"
                      onChange={(e) => setActivity(e.target.value)}
                    />
                  </div>

                  {/* Email (optional) */}
                  <div className={s.field}>
                    <label className={s.label} htmlFor="fbk-email">
                      Email <span className={s.optional}>(optional)</span>
                    </label>
                    <input
                      id="fbk-email"
                      className={s.input}
                      type="email"
                      autoComplete="email"
                      value={email}
                      aria-invalid={invalidField === 'email' ? 'true' : undefined}
                      placeholder="Leave blank to stay anonymous"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (invalidField === 'email') {
                          setInvalidField(null);
                          setError(null);
                        }
                      }}
                    />
                    <p className={s.help}>Add it only if you want a reply.</p>
                  </div>

                  {/* Auto-captured context (editable) */}
                  <div className={s.field}>
                    <div className={s.context}>
                      <div className={s.contextRow}>
                        <span className={s.contextKey}>Screen</span>
                        <input
                          className={s.input}
                          type="text"
                          aria-label="Screen"
                          value={screen}
                          onChange={(e) => setScreen(e.target.value)}
                        />
                      </div>
                      <div className={s.contextRow}>
                        <span className={s.contextKey}>Page</span>
                        <code className={s.contextRoute}>{route}</code>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot NOTE (manual-first) */}
                  <label className={s.checkRow}>
                    <input
                      type="checkbox"
                      checked={hasScreenshot}
                      onChange={(e) => setHasScreenshot(e.target.checked)}
                    />
                    <span className={s.checkText}>
                      <strong>I have a screenshot to share.</strong> We do not auto-capture your screen. If you
                      check this and leave an email, we will follow up to receive it.
                    </span>
                  </label>

                  {/* Honeypot — off-screen, never seen by real users or AT */}
                  <div className={s.honeypot} aria-hidden="true">
                    <label htmlFor="fbk-website">Do not fill this in</label>
                    <input
                      id="fbk-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>

                  <p className={s.privacy}>
                    Nothing is filed without you. We never take a cut. A real person reads this.
                  </p>

                  {error ? (
                    <div className={s.error} role="alert">
                      <WarnIcon />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <div className={s.actions}>
                    <button type="button" className="btn btn--ghost" onClick={closePanel}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`btn ${submitting ? 'btn--loading' : ''}`}
                      disabled={submitting}
                      aria-busy={submitting ? 'true' : 'false'}
                    >
                      Send feedback
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className={s.thanks} role="status" aria-live="polite">
                <div className={s.thanksIc} aria-hidden="true">
                  <CheckIcon />
                </div>
                <h2 className={s.thanksTitle}>Thank you. We hear you.</h2>
                <p className={s.thanksBody}>
                  A person on our team reads every note. If you left an email, we may follow up.
                </p>
                <button type="button" className={`btn ${s.thanksClose}`} onClick={closePanel} autoFocus>
                  Back to work
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Periodic prompt (bottom-left) ── */}
      {promptOpen ? (
        <div
          className={`${s.prompt} ${promptShown ? s.isOpen : ''}`}
          role="region"
          aria-label="Quick feedback request"
        >
          <div className={s.promptIc} aria-hidden="true">
            <ChatIcon />
          </div>
          <div className={s.promptBody}>
            <p className={s.promptH}>Got a minute?</p>
            <p className={s.promptP}>Tell us what is working, or what is not.</p>
            <div className={s.promptAct}>
              <button
                type="button"
                className={s.promptYes}
                onClick={() => {
                  setPromptOpen(false);
                  openPanel();
                }}
              >
                Share feedback
              </button>
              <button
                type="button"
                className={s.promptLater}
                onClick={() => {
                  restPrompt('lastDismissed', REST_LATER_MS);
                  setPromptOpen(false);
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
          <button
            type="button"
            className={s.promptX}
            aria-label="Dismiss feedback request"
            onClick={() => {
              restPrompt('lastDismissed', REST_DISMISS_MS);
              setPromptOpen(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </>
  );
}
