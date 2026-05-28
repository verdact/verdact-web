import { AppShell } from '../_components/app-chrome';
import { getMerchant, verifySession } from '@/lib/dal';

export const metadata = {
  title: 'Overview · Verdact',
  description: 'Verdact evidence workspace overview.',
};

export const dynamic = 'force-dynamic';

const SETUP_STEPS = [
  {
    key: 'workspace',
    label: 'Workspace created',
    status: 'done',
    blurb: 'Your Verdact account and merchant workspace are active.',
  },
  {
    key: 'stripe',
    label: 'Connect Stripe',
    status: 'next',
    blurb: 'Standard OAuth comes next. This build does not store API keys; paid filing controls come after connection.',
  },
  {
    key: 'sources',
    label: 'Add evidence sources',
    status: 'waiting',
    blurb: 'Gmail, Slack, and file evidence should be added only through explicit merchant action.',
  },
  {
    key: 'record',
    label: 'Review first evidence record',
    status: 'waiting',
    blurb: 'Verdact will organize proof, open questions, gaps, and the filing controls before action.',
  },
] as const;

export default async function DashboardPage() {
  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;
  const greetingName = businessName || user.email?.split('@')[0] || 'there';
  const workspaceId = membership?.merchant?.id ?? null;
  const completed = SETUP_STEPS.filter((step) => step.status === 'done').length;

  return (
    <AppShell email={user.email} businessName={businessName} active="dashboard">
      <section className="px-6 pb-20 pt-12 md:px-10 md:pt-16">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 lg:grid-cols-[1.35fr_minmax(300px,0.65fr)] lg:items-start">
          <div>
            <div className="reveal reveal-1">
              <p className="label-mono">Overview</p>
              <h1 className="font-display-light mt-5 text-[2.6rem] leading-[1.04] text-ink md:text-[3.5rem]">
                Your evidence workspace is ready, {greetingName}.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
                Your account is set up. Connecting Stripe and adding evidence
                sources come next.
              </p>
            </div>

            <div className="reveal reveal-2 surface-card mt-10 overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule-strong px-6 py-4">
                <div>
                  <p className="label-mono">Setup</p>
                  <p className="font-display mt-1 text-xl text-ink">
                    {completed} of {SETUP_STEPS.length} complete
                  </p>
                </div>
                <ProgressTrack total={SETUP_STEPS.length} completed={completed} />
              </header>

              <ol>
                {SETUP_STEPS.map((step, idx) => (
                  <li
                    key={step.key}
                    className="grid gap-4 border-b border-rule px-6 py-5 last:border-b-0 md:grid-cols-[2.25rem_1fr_auto] md:items-center"
                  >
                    <span className="label-mono text-ink-faint">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <p className="text-base font-medium leading-snug text-ink">
                        {step.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-ink-mute">
                        {step.blurb}
                      </p>
                    </div>
                    <StatusPill status={step.status} />
                  </li>
                ))}
              </ol>
            </div>

            <div className="reveal reveal-3 mt-10 grid gap-3 sm:grid-cols-3">
              {WORKSPACE_NOTES.map((note) => (
                <div className="surface-card-flat p-4" key={note.title}>
                  <p className="label-mono text-ink">{note.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <aside className="reveal reveal-4 lg:sticky lg:top-10">
            <div className="surface-card-flat overflow-hidden">
              <header className="border-b border-rule-strong px-5 py-4">
                <p className="label-mono">Workspace</p>
                <p className="font-display mt-1 text-lg leading-tight text-ink">
                  {businessName || 'Unnamed workspace'}
                </p>
              </header>

              <dl className="divide-y divide-rule">
                <Row label="Email" value={user.email ?? '-'} />
                <Row
                  label="Role"
                  value={
                    <span className="capitalize">{membership?.role ?? '-'}</span>
                  }
                />
                <Row
                  label="Workspace ID"
                  value={
                    workspaceId ? (
                      <span className="break-all font-mono text-[0.72rem] text-ink-soft">
                        {workspaceId}
                      </span>
                    ) : (
                      '-'
                    )
                  }
                />
                <Row label="Filing" value={<span className="pill-neutral">Not started</span>} />
              </dl>
            </div>

            <p className="mt-4 text-xs leading-6 text-ink-mute">
              Need help? Write to{' '}
              <a
                className="font-medium text-ink underline underline-offset-[5px] hover:text-accent"
                href="mailto:admin@verdact.io"
              >
                admin@verdact.io
              </a>
              .
            </p>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}

function ProgressTrack({
  total,
  completed,
}: {
  total: number;
  completed: number;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1 w-7 rounded-full ${
            i < completed ? 'bg-trust' : 'bg-rule-strong'
          }`}
        />
      ))}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: (typeof SETUP_STEPS)[number]['status'];
}) {
  if (status === 'done') {
    return <span className="pill-trust w-fit">Ready</span>;
  }

  if (status === 'next') {
    return <span className="pill-neutral w-fit">Next</span>;
  }

  return <span className="pill-neutral w-fit">Waiting</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3 px-5 py-3.5">
      <dt className="label-mono pt-1">{label}</dt>
      <dd className="text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

const WORKSPACE_NOTES = [
  {
    title: 'Filing controls',
    body: 'Manual filing by default. Paid plans unlock auto-file and review-then-submit, with edit, pause, add, and remove controls.',
  },
  {
    title: 'No stored API keys',
    body: 'Stripe is connected through Standard OAuth. Verdact holds the connected account ID, nothing else.',
  },
  {
    title: 'Reversible at any time',
    body: 'Disconnect Stripe, Gmail, or Slack any time. Revoking access removes future read.',
  },
] as const;
