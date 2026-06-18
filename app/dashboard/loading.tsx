import { AppShell } from '../_components/app-chrome';

// Dashboard loading fallback. Replaces the page output while the server fetches
// disputes, account health, and guidance, so we keep the app shell (rail +
// topbar) mounted and lay calm skeletons where the masthead, ledger line, and
// docket will land. Skeleton shimmer (.skel) is stilled under reduced-motion by
// the global block in globals.css. AppShell tolerates a null email.
export default function DashboardLoading() {
  return (
    <AppShell email={null} active="dashboard">
      <div
        className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 pb-16 pt-7"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading your workspace</span>

        {/* Masthead: title + connection chip */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="skel block h-7 w-40" />
          <span className="skel block h-7 w-48 rounded-full" />
        </div>

        {/* Standing sentence */}
        <span className="skel block h-4 w-3/4 max-w-xl" />

        {/* Ledger line */}
        <div className="grid gap-3 sm:grid-cols-3">
          <span className="skel block h-20 rounded-md" />
          <span className="skel block h-20 rounded-md" />
          <span className="skel block h-20 rounded-md" />
        </div>

        {/* The record / docket rows */}
        <div className="flex flex-col gap-3">
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
        </div>
      </div>
    </AppShell>
  );
}
