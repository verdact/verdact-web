// Root loading fallback. Route-agnostic (no app shell, so no theme scope), so it
// stays minimal: a calm workbench-voice headline over a centered spinner, with a
// quiet visible word beneath it so a sighted, anxious user reads "loading", not
// "frozen" (S4). The spin animation (v-spin, defined in globals.css) is
// automatically stilled under prefers-reduced-motion via the global
// reduced-motion block.
import { LoadingHeadline } from '@/app/_components/ui/loading-headline';

export default function Loading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface"
      role="status"
      aria-live="polite"
    >
      <LoadingHeadline eyebrow="Loading" title="Getting things ready" />
      <span
        aria-hidden="true"
        className="block h-7 w-7 rounded-full border-2 border-rule border-t-action"
        style={{ animation: 'v-spin 0.7s linear infinite' }}
      />
      <p className="label-mono text-ink-soft">Loading…</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
