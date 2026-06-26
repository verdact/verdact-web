import { AppShell } from '../_components/app-chrome';

// Dark-aware loading state for Account health (same flash fix as Settings).
export default function AccountHealthLoading() {
  return (
    <AppShell email={null} active="account-health">
      <div
        className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-6 pb-16 pt-7"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading account health</span>
        <span className="skel block h-7 w-48" />
        <span className="skel block h-4 w-2/3 max-w-lg" />
        <span className="skel block h-40 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-3">
          <span className="skel block h-24 rounded-md" />
          <span className="skel block h-24 rounded-md" />
          <span className="skel block h-24 rounded-md" />
        </div>
      </div>
    </AppShell>
  );
}
