import s from './connect-stripe-panel.module.css';

// Value-forward activation surface shown wherever a merchant has not connected
// Stripe yet. Replaces a blank page with: what Verdact will do, the single
// Connect Stripe action, and clearly-labelled sample preview rows so the
// merchant can see what the page becomes. Mirrors the quality of the
// account-health not-connected state. Nothing here is real merchant data.

type SamplePreviewRow = {
  reason: string;
  amount: string;
  deadline: string;
};

const VALUE_POINTS: Array<{ title: string; body: string }> = [
  {
    title: 'Watch every dispute',
    body: 'Verdact reads your Stripe disputes and early fraud warnings, so a new case and its deadline never slip past you.',
  },
  {
    title: 'Build the strongest record',
    body: 'For each dispute, Verdact assembles a source-linked evidence record from your business context and proof. You review before anything is filed.',
  },
  {
    title: 'Stay ahead of the 0.75% line',
    body: 'Your account-health reading shows where your dispute rate stands against Stripe’s line, recomputed daily.',
  },
];

const SAMPLE_ROWS: SamplePreviewRow[] = [
  { reason: 'Product not received', amount: '$480.00', deadline: 'Due in 2 days' },
  { reason: 'Subscription canceled', amount: '$1,250.00', deadline: 'Due in 6 days' },
  { reason: 'Duplicate charge', amount: '$89.00', deadline: 'Due in 11 days' },
];

type ConnectStripePanelProps = {
  // Tailors the lead line to the surface the panel renders on.
  context: 'dashboard' | 'disputes';
};

export function ConnectStripePanel({ context }: ConnectStripePanelProps) {
  const lead =
    context === 'disputes'
      ? 'Connect Stripe to see your disputes here.'
      : 'Connect Stripe to start watching your disputes and account health.';

  return (
    <section className={s.panel} aria-labelledby="connect-stripe-title">
      <div className={s.head}>
        <h2 className={s.title} id="connect-stripe-title">
          {lead}
        </h2>
        <p className={s.sub}>
          Verdact watches the connected account for disputes and early fraud warnings. We store the
          account ID only, never your Stripe password or API keys. You can disconnect any time.
        </p>
        <a href="/api/stripe/connect/start" className={s.cta}>
          Connect Stripe
        </a>
      </div>

      <ul className={s.valueList}>
        {VALUE_POINTS.map((point) => (
          <li key={point.title} className={s.valueItem}>
            <p className={s.valueTitle}>{point.title}</p>
            <p className={s.valueBody}>{point.body}</p>
          </li>
        ))}
      </ul>

      <div className={s.preview} aria-hidden="true">
        <div className={s.previewHead}>
          <span className={s.previewLabel}>Sample preview</span>
          <span className={s.previewNote}>Example only, not your data</span>
        </div>
        <div className={s.previewRows}>
          {SAMPLE_ROWS.map((row) => (
            <div key={row.reason} className={s.previewRow}>
              <span className={s.previewReason}>{row.reason}</span>
              <span className={s.previewAmount}>{row.amount}</span>
              <span className={s.previewDeadline}>{row.deadline}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
