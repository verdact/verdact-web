// Root loading fallback. Route-agnostic, so it stays minimal: a calm centered
// spinner on the standard surface. The spin animation (v-spin, defined in
// globals.css) is automatically stilled under prefers-reduced-motion via the
// global reduced-motion block.
export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-surface"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="block h-7 w-7 rounded-full border-2 border-rule border-t-action"
        style={{ animation: 'v-spin 0.7s linear infinite' }}
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
