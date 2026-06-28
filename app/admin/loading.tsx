import { AdminShell } from './_components/admin-shell';
import { LoadingHeadline } from '../_components/ui/loading-headline';

// Admin loading fallback. Mirrors the dashboard loader: keep the AdminShell
// (rail + topbar) mounted so the fallback renders INSIDE the dark-scoped
// .app-shell instead of falling through to the light, shell-less root
// app/loading.tsx — which is what caused the dark-mode white flash on refresh.
// AdminShell tolerates a null email (renders a skeleton in its place). Skeleton
// shimmer (.skel) is stilled under reduced-motion by the global block in
// globals.css.
export default function AdminLoading() {
  return (
    <AdminShell email={null} active="overview">
      <div
        className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 pb-16 pt-7"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading the admin console</span>
        <LoadingHeadline eyebrow="Loading" title="Opening the admin console…" />

        {/* Title + chip */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="skel block h-7 w-48" />
          <span className="skel block h-7 w-40 rounded-full" />
        </div>

        {/* KPI tiles */}
        <div className="grid gap-3 sm:grid-cols-4">
          <span className="skel block h-20 rounded-md" />
          <span className="skel block h-20 rounded-md" />
          <span className="skel block h-20 rounded-md" />
          <span className="skel block h-20 rounded-md" />
        </div>

        {/* Table rows */}
        <div className="flex flex-col gap-3">
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
        </div>
      </div>
    </AdminShell>
  );
}
