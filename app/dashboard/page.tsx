import { AppShell } from '../_components/app-chrome';
import { getMerchant, verifySession } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { disconnectStripeAction } from '@/lib/stripe/actions';

export const metadata = {
  title: 'Overview · Verdact',
  description: 'Verdact evidence workspace overview.',
};

export const dynamic = 'force-dynamic';

type StripeConnection = {
  id: string;
  processor_account_id: string;
  livemode: boolean;
  connected_at: string | null;
} | null;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const justConnected = params.connected === 'stripe';
  const stripeError = typeof params.stripe_error === 'string' ? params.stripe_error : null;

  const user = await verifySession();
  const membership = await getMerchant();
  const businessName = membership?.merchant?.business_name?.trim() || null;
  const greetingName = businessName || user.email?.split('@')[0] || 'there';
  const workspaceId = membership?.merchant?.id ?? null;

  let stripeConnection: StripeConnection = null;
  if (membership) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('processor_connections')
      .select('id, processor_account_id, livemode, connected_at')
      .eq('merchant_id', membership.merchant.id)
      .eq('processor', 'stripe')
      .eq('connection_status', 'connected')
      .maybeSingle();
    stripeConnection = data ?? null;
  }

  const stripeAccountLabel = stripeConnection
    ? formatStripeAccountId(stripeConnection.processor_account_id)
    : null;
  const stripeModeLabel = stripeConnection
    ? stripeConnection.livemode
      ? 'Live mode'
      : 'Test mode'
    : null;
  const connectedAtLabel = stripeConnection?.connected_at
    ? formatDateTime(stripeConnection.connected_at)
    : null;

  const stripeStep = stripeConnection
    ? ({
        key: 'stripe',
        label: 'Connect Stripe',
        status: 'done',
        blurb: `${stripeModeLabel}. Account ${stripeAccountLabel}. Verdact stores the connected account ID only.`,
      } as const)
    : ({
        key: 'stripe',
        label: 'Connect Stripe',
        status: 'next',
        blurb: 'Standard OAuth — Verdact holds your connected account ID only, not your API keys.',
      } as const);

  const SETUP_STEPS = [
    {
      key: 'workspace',
      label: 'Workspace created',
      status: 'done',
      blurb: 'Your Verdact account and merchant workspace are active.',
    },
    stripeStep,
    {
      key: 'intake',
      label: 'Turn on dispute intake',
      status: stripeConnection ? 'next' : 'waiting',
      blurb: stripeConnection
        ? 'Stripe is ready. Webhook intake comes next so disputes and early fraud warnings can appear here automatically.'
        : 'Connect Stripe first, then Verdact can listen for disputes and early fraud warnings.',
    },
    {
      key: 'sources',
      label: 'Add evidence sources',
      status: 'waiting',
      blurb: 'Gmail, Slack, and file evidence stay off until you explicitly connect or upload them.',
    },
    {
      key: 'record',
      label: 'Review first evidence record',
      status: 'waiting',
      blurb: 'Verdact will organize proof, open questions, gaps, and the filing controls before action.',
    },
  ] as const;

  const completed = SETUP_STEPS.filter((s) => s.status === 'done').length;

  const STRIPE_ERROR_MESSAGES: Record<string, string> = {
    denied: 'Stripe connection was cancelled.',
    invalid_state: 'OAuth state mismatch — please try again.',
    no_code: 'No authorization code received from Stripe.',
    exchange_failed: 'Stripe token exchange failed — please try again.',
    db_error: 'Connection was authorised but could not be saved — please try again.',
    account_in_use: 'That Stripe account is already connected to another workspace.',
    no_merchant: 'Workspace not found — please sign out and back in.',
    not_configured: 'Stripe Connect is not configured on this deployment.',
  };

  return (
    <AppShell email={user.email} businessName={businessName} active="dashboard">
      <section className="px-6 pb-20 pt-12 md:px-10 md:pt-16">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 lg:grid-cols-[1.35fr_minmax(300px,0.65fr)] lg:items-start">
          <div>
            {justConnected && (
              <div
                className="mb-6 rounded-lg border border-trust bg-trust/10 px-5 py-3 text-sm text-trust"
                role="status"
              >
                Stripe connected successfully. Verdact saved the connected account ID; no API keys were stored.
              </div>
            )}
            {stripeError && (
              <div className="mb-6 rounded-lg border border-ce bg-ce/10 px-5 py-3 text-sm text-ce">
                {STRIPE_ERROR_MESSAGES[stripeError] ?? 'Something went wrong with Stripe — please try again.'}
              </div>
            )}

            <div className="reveal reveal-1">
              <p className="label-mono">Overview</p>
              <h1 className="font-display-light mt-5 text-[2.6rem] leading-[1.04] text-ink md:text-[3.5rem]">
                Your evidence workspace is ready, {greetingName}.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
                {stripeConnection
                  ? 'Stripe is connected. Next, turn on dispute intake so new cases can become evidence records.'
                  : 'Your account is set up. Connecting Stripe comes next.'}
              </p>
            </div>

            {stripeConnection && (
              <div className="reveal reveal-2 mt-10 grid gap-3 sm:grid-cols-3">
                <ConnectionMetric label="Stripe" value="Connected" tone="trust" />
                <ConnectionMetric label="Mode" value={stripeModeLabel ?? '-'} />
                <ConnectionMetric label="Account" value={stripeAccountLabel ?? '-'} mono />
              </div>
            )}

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
                      <p className="mt-1 text-sm leading-6 text-ink-mute">{step.blurb}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={step.status} />
                      {step.key === 'stripe' && !stripeConnection && (
                        <a href="/api/stripe/connect/start" className="btn-secondary py-1 text-sm">
                          Connect
                        </a>
                      )}
                      {step.key === 'stripe' && stripeConnection && (
                        <form action={disconnectStripeAction}>
                          <button
                            type="submit"
                            className="label-mono text-ink-mute underline underline-offset-4 hover:text-ce"
                          >
                            Disconnect
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="reveal reveal-3 mt-10 grid gap-3 sm:grid-cols-3">
              {WORKSPACE_NOTES.map((note) => (
                <div className="surface-card-flat p-4" key={note.title}>
                  <p className="label-mono text-ink">{note.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{note.body}</p>
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
                  value={<span className="capitalize">{membership?.role ?? '-'}</span>}
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
                <Row
                  label="Stripe"
                  value={
                    stripeConnection ? (
                      <span className="flex flex-col items-start gap-1">
                        <span className="pill-trust">Connected</span>
                        <span className="font-mono text-[0.72rem] text-ink-mute">
                          {stripeAccountLabel}
                        </span>
                      </span>
                    ) : (
                      <span className="pill-neutral">Not connected</span>
                    )
                  }
                />
                <Row label="Mode" value={stripeModeLabel ?? '-'} />
                <Row label="Connected" value={connectedAtLabel ?? '-'} />
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

function ProgressTrack({ total, completed }: { total: number; completed: number }) {
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
          className={`h-1 w-7 rounded-full ${i < completed ? 'bg-trust' : 'bg-rule-strong'}`}
        />
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: 'done' | 'next' | 'waiting' }) {
  if (status === 'done') return <span className="pill-trust w-fit">Done</span>;
  if (status === 'next') return <span className="pill-neutral w-fit">Next</span>;
  return <span className="pill-neutral w-fit">Waiting</span>;
}

function ConnectionMetric({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'trust';
}) {
  return (
    <div className="surface-card-flat p-4">
      <p className="label-mono text-ink-mute">{label}</p>
      <p
        className={`mt-2 text-base font-medium leading-snug ${
          mono ? 'font-mono text-sm' : ''
        } ${tone === 'trust' ? 'text-trust' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3 px-5 py-3.5">
      <dt className="label-mono pt-1">{label}</dt>
      <dd className="text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}

function formatStripeAccountId(accountId: string) {
  if (accountId.length <= 12) return accountId;
  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
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
