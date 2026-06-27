import { AppShell } from '../../../_components/app-chrome';
import { LoadingHeadline } from '../../../_components/ui/loading-headline';

// Evidence record (workbench) loading fallback. This route awaits live Stripe
// charge enrichment before it can render the readiness gauge and proof panels,
// so a meaningful loading state matters here. We keep the app shell mounted and
// mirror the workbench layout: a masthead band over a two-column grid (main +
// sticky sidebar), with calm skeletons in place. A visible LoadingHeadline (S4)
// sits in the masthead so the wait reads as "opening", not "stuck". Shimmer
// (.skel) is stilled under reduced-motion by the global block in globals.css.
export default function WorkbenchLoading() {
  return (
    <AppShell email={null} active="disputes">
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading this evidence record</span>

        {/* Masthead band */}
        <div className="border-b border-rule-strong bg-surface-2 px-6 py-6 md:px-10">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
            <LoadingHeadline eyebrow="Loading" title="Opening this dispute…" />
            <span className="skel block h-3 w-28" />
            <span className="skel block h-4 w-56" />
            <span className="skel block h-9 w-2/3 max-w-md rounded-md" />
            <span className="skel block h-4 w-1/2 max-w-sm" />
          </div>
        </div>

        {/* Content grid: main column + sticky sidebar */}
        <section className="mx-auto grid w-full max-w-[1280px] gap-6 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <span className="skel block h-44 rounded-md" />
            <span className="skel block h-32 rounded-md" />
            <span className="skel block h-32 rounded-md" />
          </div>
          <aside className="space-y-5">
            <span className="skel block h-56 rounded-md" />
            <span className="skel block h-32 rounded-md" />
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
