import type { ResolutionPlan, ResolveRoute } from '@/lib/evidence/resolution';
import { AlertIcon, ChevronRightIcon, DocIcon } from '../../dash-icons';
import styles from './workbench.module.css';

/**
 * Guided "Resolve missing proof" card (Stage 1E) — the decision-first centerpiece
 * of the workbench. Server-rendered: it takes a pure ResolutionPlan and renders
 * the named blocker, why it matters (reason-code aware), and manual-first routes.
 *
 * Manual-first only (Gmail/Slack auto-pull and one-click sign-off links are out
 * per the locks). The "mark unavailable" form lives once, in the Evidence Record
 * gap row below; this card links to it via #acceptance-gap.
 */
export function ResolveMissingProof({ plan }: { plan: ResolutionPlan }) {
  return (
    <section
      id="resolve"
      className="overflow-hidden rounded-md border border-accent-rule border-l-[4px] border-l-accent bg-surface scroll-mt-24"
      aria-label="Resolve the missing evidence"
    >
      <header className="flex items-center gap-3.5 bg-accent-soft px-5 py-4">
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-accent text-white">
          <AlertIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`${styles.labelMonoStrong} text-accent-deep`}>{plan.eyebrow}</span>
          <span className={`${styles.fontDisplay} mt-1 block text-[1.05rem] font-semibold leading-tight text-ink`}>
            {plan.title}
          </span>
        </span>
      </header>

      <div className="px-5 pb-5 pt-3">
        <p className="border-b border-dashed border-rule-strong pb-3.5 text-sm leading-6 text-ink-soft">
          <span className="font-semibold text-ink">Why this matters. </span>
          {plan.why}
        </p>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {plan.routes.map((route) => (
            <RouteRow key={`${route.kind}-${route.label}`} route={route} />
          ))}

          {plan.allowUnavailable ? (
            <a
              href="#acceptance-gap"
              className="flex items-center gap-3.5 rounded-md border border-rule-strong bg-surface px-3.5 py-3 transition-colors hover:border-action hover:bg-action-soft"
            >
              <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-md border border-rule-strong bg-surface-2 text-ink-mute">
                <SlashCircleIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug text-ink-soft">
                  Mark it unavailable, with a reason
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-mute">
                  No formal sign-off exists. Record why; Verdact files the rest and notes the gap.
                </span>
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 flex-none text-ink-faint" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RouteRow({ route }: { route: ResolveRoute }) {
  return (
    <a
      href={route.href}
      className={`flex items-center gap-3.5 rounded-md border px-3.5 py-3 transition-colors ${
        route.primary
          ? 'border-action bg-action-soft'
          : 'border-rule-strong bg-surface hover:border-action hover:bg-action-soft'
      }`}
    >
      <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-md border border-rule-strong bg-surface text-action">
        <RouteIcon kind={route.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-ink">{route.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-ink-mute">{route.detail}</span>
      </span>
      {route.badge ? (
        <span className="flex-none rounded-full border border-action-rule bg-surface px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-action">
          {route.badge}
        </span>
      ) : (
        <ChevronRightIcon className="h-3.5 w-3.5 flex-none text-ink-faint" />
      )}
    </a>
  );
}

function RouteIcon({ kind }: { kind: ResolveRoute['kind'] }) {
  if (kind === 'upload') return <UploadIcon className="h-4 w-4" />;
  if (kind === 'paste') return <PasteIcon className="h-4 w-4" />;
  if (kind === 'profile') return <GearIcon className="h-4 w-4" />;
  if (kind === 'connect') return <SlackIcon className="h-4 w-4" />;
  return <PencilIcon className="h-4 w-4" />;
}

// ─── Local glyphs (match dash-icons stroke style) ────────────────────────────

function Glyph({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16" />
    </Glyph>
  );
}

function PasteIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </Glyph>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Glyph>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Glyph>
  );
}

function SlashCircleIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Glyph>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M9 3a2 2 0 0 0 0 4h2V5a2 2 0 0 0-2-2zM5 13a2 2 0 1 0 0 4 2 2 0 0 0 2-2v-2H5zm6 6a2 2 0 1 0 4 0v-2h-2a2 2 0 0 0-2 2zm8-8a2 2 0 1 0 0-4h-2v2a2 2 0 0 0 2 2z" />
    </Glyph>
  );
}
