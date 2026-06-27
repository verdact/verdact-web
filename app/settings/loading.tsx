import { AppShell } from '../_components/app-chrome';
import { LoadingHeadline } from '../_components/ui/loading-headline';

// Dark-aware loading state for Settings. Keeps the themed app shell mounted
// during navigation/refresh instead of falling back to the light root spinner,
// which caused a white flash in dark mode. A visible LoadingHeadline (S4) above
// the skeletons reads as "loading". Mirrors dashboard/loading.tsx.
export default function SettingsLoading() {
  return (
    <AppShell email={null} active="settings">
      <div
        className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-6 pb-16 pt-8"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading settings</span>
        <LoadingHeadline eyebrow="Loading" title="Loading your settings…" />
        <span className="skel block h-7 w-40" />
        <span className="skel block h-4 w-3/4 max-w-md" />
        <span className="skel block h-9 w-72 rounded-full" />
        <span className="skel block h-64 rounded-md" />
      </div>
    </AppShell>
  );
}
