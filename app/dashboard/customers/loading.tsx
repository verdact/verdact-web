import { AppShell } from '../../_components/app-chrome';

// Dark-aware loading state for the Customers page (same flash fix as Settings).
export default function CustomersLoading() {
  return (
    <AppShell email={null} active="customers">
      <div
        className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-6 pb-16 pt-7"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading customers</span>
        <span className="skel block h-7 w-40" />
        <span className="skel block h-4 w-2/3 max-w-md" />
        <div className="flex flex-col gap-3">
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
          <span className="skel block h-16 rounded-md" />
        </div>
      </div>
    </AppShell>
  );
}
