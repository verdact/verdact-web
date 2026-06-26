import type { ResolutionPlan } from '@/lib/evidence/resolution';
import { CheckIcon, ChevronRightIcon, InfoCircleIcon } from '../../dash-icons';
import { RouteRow } from './resolve-missing-proof';
import styles from './workbench.module.css';

/**
 * The single prioritized next step (Redesign 2026-06-26) — the calm focus of the
 * workbench. Replaces the abstract readiness dial + the five competing inputs +
 * the duplicate WorkbenchTip as the primary element a stressed merchant sees.
 *
 * Pure, prop-driven, server-rendered. It shows EXACTLY one action, derived from
 * the already-computed `resolutionPlan` (no new prioritization logic). It is
 * calm, not alarming: verdict-green lead border, a neutral forward chevron, never
 * the vermilion gap surface. Vermilion stays reserved for true blockers in the
 * record itself. Its primary CTA and links are in-page anchors that the client
 * shell intercepts to expand the owning stage before scrolling.
 */

interface NextStepCardProps {
  plan: ResolutionPlan | null;
  submitted: boolean;
  approved: boolean;
  isClosed: boolean;
}

export function NextStepCard({ plan, submitted, approved, isClosed }: NextStepCardProps) {
  if (submitted) {
    return (
      <StatusCard
        tone="trust"
        eyebrow="Filed"
        title="This record has been filed."
        body="We will watch for the bank's response and keep you posted."
        ctaLabel="View what was filed"
        ctaHref="#stage-review"
      />
    );
  }
  if (isClosed) {
    return (
      <StatusCard
        tone="neutral"
        eyebrow="Closed"
        title="This dispute is closed."
        body="You can still review the full record below."
        ctaLabel="View the record"
        ctaHref="#stage-review"
      />
    );
  }
  if (!plan) {
    if (approved) {
      return (
        <StatusCard
          tone="trust"
          eyebrow="Approved"
          title="Approved. Nothing is filed without you."
          body="When you are ready, take the final step."
          ctaLabel="Go to approve and file"
          ctaHref="#stage-file"
        />
      );
    }
    return (
      <StatusCard
        tone="trust"
        eyebrow="Ready"
        title="Your evidence is ready to review."
        body="Look over the full record, then approve it when you are ready."
        ctaLabel="Review the record"
        ctaHref="#stage-review"
      />
    );
  }

  // An open gap: guide the merchant to the ONE highest-priority step.
  const primary = plan.routes.find((r) => r.primary) ?? plan.routes[0];
  const others = plan.routes.filter((r) => r !== primary);

  return (
    <section
      id="resolve"
      className={`${styles.card} ${styles.cardLead} scroll-mt-24 overflow-hidden`}
      aria-label="Your next step"
    >
      <div className="px-6 py-5">
        <p className={`${styles.labelMono} flex items-center gap-2`}>
          <span className={`${styles.statusDotNeutral} h-5 w-5`} aria-hidden="true">
            <ChevronRightIcon className="h-3 w-3" />
          </span>
          Your next step
        </p>
        <h2 className={`${styles.fontDisplay} mt-3 text-[1.3rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
          {plan.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{firstSentence(plan.why)}</p>

        <div className="mt-4">
          <a
            href={primary.href}
            className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
            {primary.label}
            {primary.badge ? (
              <span className="rounded-full border border-white/30 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide">
                {primary.badge}
              </span>
            ) : null}
          </a>
          <p className="mt-2 text-xs leading-5 text-ink-mute">{primary.detail}</p>
        </div>

        {others.length > 0 ? (
          <details className="mt-4 border-t border-rule pt-3">
            <summary className={`${styles.labelMono} cursor-pointer text-action`}>
              Other ways to add this
            </summary>
            <div className="mt-3 flex flex-col gap-2.5">
              {others.map((route) => (
                <RouteRow key={`${route.kind}-${route.label}`} route={route} />
              ))}
            </div>
          </details>
        ) : null}

        {plan.allowUnavailable ? (
          <p className="mt-4 flex items-start gap-2 border-t border-rule pt-3 text-sm leading-6 text-ink-soft">
            <span className={`${styles.statusDotNeutral} mt-0.5 h-5 w-5`} aria-hidden="true">
              <InfoCircleIcon className="h-3 w-3" />
            </span>
            <span>
              This strengthens your case. You can still file without it.{' '}
              <a
                href="#acceptance-gap"
                className="font-semibold text-action underline underline-offset-4 hover:text-action-deep"
              >
                I do not have this. Record why.
              </a>
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StatusCard({
  tone,
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  tone: 'trust' | 'neutral';
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const dot = tone === 'trust' ? styles.statusDotOk : styles.statusDotNeutral;
  return (
    <section
      id="resolve"
      className={`${styles.card} ${tone === 'trust' ? styles.cardLead : ''} scroll-mt-24 overflow-hidden`}
      aria-label="Your next step"
    >
      <div className="px-6 py-5">
        <p className={`${styles.labelMono} flex items-center gap-2`}>
          <span className={`${dot} h-5 w-5`} aria-hidden="true">
            {tone === 'trust' ? <CheckIcon className="h-3 w-3" /> : <InfoCircleIcon className="h-3 w-3" />}
          </span>
          {eyebrow}
        </p>
        <h2 className={`${styles.fontDisplay} mt-3 text-[1.3rem] font-semibold leading-tight tracking-[-0.01em] text-ink`}>
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{body}</p>
        <div className="mt-4">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2.5 text-sm font-semibold text-white"
          >
            {ctaLabel}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

// The first sentence of the reason-code "why", so the focus card stays one calm
// line and the full rationale lives in the resolve detail / Review stage. The
// terminator must be a period/!/? followed by whitespace or end, so decimals in
// reason codes like "13.1" do not truncate the sentence.
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : text;
}
