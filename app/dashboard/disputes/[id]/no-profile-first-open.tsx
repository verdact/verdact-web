import { ShieldIcon } from '../../dash-icons';
import styles from './workbench.module.css';

// First-open guided state shown when the merchant opens a dispute before they
// have set up a business profile. Without it the record cannot reason about
// delivery method, policies, or what "the work" was — so we guide setup instead
// of rendering a record that looks blank or wrong.

function formatReason(reason: string | null): string {
  if (!reason) return 'this';
  return reason.replaceAll('_', ' ');
}

export function NoProfileFirstOpen({ reason }: { reason: string | null }) {
  return (
    <section className="overflow-hidden rounded-md border border-action-rule border-l-[4px] border-l-action bg-[var(--verdict-tint)]">
      <div className="flex flex-wrap items-start gap-4 px-6 py-5">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-action text-white">
          <ShieldIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${styles.labelMonoStrong} text-action`}>Set up your business profile first</p>
          <h2 className={`${styles.fontDisplay} mt-1.5 text-[1.15rem] font-semibold leading-tight text-ink`}>
            We need a little context before this record is useful
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            This is your first dispute and you have not set up a business profile yet. A profile tells
            Verdact how you deliver, what your refund and cancellation policies say, and where they are
            disclosed{reason ? `, the exact things a ${formatReason(reason)} dispute turns on` : ''}.
            With it, the evidence record below can flag what is strong and what is missing. Without it,
            it can only show the Stripe facts.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/settings"
              className="inline-flex items-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
            >
              Set up business profile
            </a>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-md border border-action-rule px-4 py-2 text-sm font-semibold text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
            >
              Walk me through setup
            </a>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-mute">
            You can keep reviewing this dispute meanwhile. Nothing is filed without your approval.
          </p>
        </div>
      </div>
    </section>
  );
}
