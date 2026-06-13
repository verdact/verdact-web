import { AppShell } from '../_components/app-chrome';
import {
  BusinessForm,
  PoliciesForm,
  EmailForm,
  PasswordForm,
  SignOutButton,
  DisconnectStripe,
  DeleteAccount,
  type BusinessInitial,
  type PoliciesInitial,
} from './settings-client';
import s from './settings.module.css';

export type TabKey = 'connections' | 'business' | 'policies' | 'notifications' | 'account';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'connections', label: 'Connections' },
  { key: 'business', label: 'Business' },
  { key: 'policies', label: 'Policies' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'account', label: 'Account' },
];

export type SettingsStripe = {
  processor_account_id: string;
  livemode: boolean;
  connected_at: string | null;
} | null;

export type SettingsViewProps = {
  email: string;
  businessName: string | null;
  activeTab: TabKey;
  justDisconnected: boolean;
  businessInitial: BusinessInitial;
  policiesInitial: PoliciesInitial;
  stripe: SettingsStripe;
};

export function isTabKey(value: string | undefined): value is TabKey {
  return (
    value === 'connections' ||
    value === 'business' ||
    value === 'policies' ||
    value === 'notifications' ||
    value === 'account'
  );
}

// Pure render layer for /settings. Data wrapper lives in page.tsx; a dev-only
// preview route renders this directly with sample data.
export function SettingsView({
  email,
  businessName,
  activeTab,
  justDisconnected,
  businessInitial,
  policiesInitial,
  stripe,
}: SettingsViewProps) {
  return (
    <AppShell email={email} businessName={businessName} active="settings">
      <div className={s.page}>
        <div className={s.headerText}>
          <h1 className={s.pageTitle}>Settings</h1>
          <p className={s.sub}>Connections, business details, evidence policies, and your account.</p>
        </div>

        <nav className={s.tabs} aria-label="Settings sections">
          {TABS.map((tab) => (
            <a
              key={tab.key}
              href={`/settings?tab=${tab.key}`}
              className={`${s.tab} ${activeTab === tab.key ? s.tabActive : ''}`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        {justDisconnected && activeTab === 'connections' ? (
          <div className={s.banner} role="status">
            Stripe disconnected. Your dispute history is still here, and you can reconnect any time.
          </div>
        ) : null}

        {activeTab === 'connections' ? <ConnectionsPanel stripe={stripe} /> : null}
        {activeTab === 'business' ? (
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>Business details</h2>
              <p className={s.panelDesc}>
                What you sell and how you deliver it. Verdact uses this to frame the strongest
                version of your evidence.
              </p>
            </div>
            <BusinessForm initial={businessInitial} />
          </section>
        ) : null}
        {activeTab === 'policies' ? (
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>Evidence policies</h2>
              <p className={s.panelDesc}>
                Your refund, cancellation, and terms. These are the policies banks look for, so
                having them ready makes every submission stronger.
              </p>
            </div>
            <PoliciesForm initial={policiesInitial} />
          </section>
        ) : null}
        {activeTab === 'notifications' ? <NotificationsPanel /> : null}
        {activeTab === 'account' ? <AccountPanel email={email} /> : null}
      </div>
    </AppShell>
  );
}

// ── Connections panel ────────────────────────────────────────────────────────

function ConnectionsPanel({ stripe }: { stripe: SettingsStripe }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>Connections</h2>
        <p className={s.panelDesc}>
          Connect the accounts Verdact watches for disputes. Your email evidence is added per
          dispute in the workbench, not connected here.
        </p>
      </div>

      <div className={s.connRow}>
        <div className={s.connLeft}>
          <div className={`${s.connIcon} ${s.connIconStripe}`}>S</div>
          <div>
            <p className={s.connName}>Stripe</p>
            <p className={s.connDesc}>
              The connected account Verdact watches for disputes and early fraud warnings. We store
              the account ID only, never your API keys.
            </p>
            {stripe ? (
              <p className={s.connMeta}>
                {formatStripeAccountId(stripe.processor_account_id)}
                {stripe.livemode ? '' : ' · test mode'}
                {stripe.connected_at ? ` · connected ${formatDate(stripe.connected_at)}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        <div className={s.connRight}>
          {stripe ? (
            <>
              <span className={`${s.statusPill} ${s.statusPillConnected}`}>
                <span className={`${s.statusDot} ${s.statusDotOn}`} aria-hidden="true" />
                Connected
              </span>
              <DisconnectStripe accountLabel={formatStripeAccountId(stripe.processor_account_id)} />
            </>
          ) : (
            <a href="/api/stripe/connect/start" className={s.connectBtn}>
              Connect Stripe
            </a>
          )}
        </div>
      </div>

      <hr className={s.divider} />

      <div className={s.connRow}>
        <div className={s.connLeft}>
          <div className={s.connIcon}>#</div>
          <div>
            <p className={s.connName}>Slack</p>
            <p className={s.connDesc}>
              Import delivery and support threads as evidence. Coming soon. You will be able to
              connect a workspace and pull selected threads per dispute.
            </p>
          </div>
        </div>
        <div className={s.connRight}>
          <span className={s.disabledTag}>Coming soon</span>
        </div>
      </div>
    </section>
  );
}

// ── Notifications panel (disabled preview) ───────────────────────────────────

function NotificationsPanel() {
  const previews: Array<{ label: string; desc: string }> = [
    { label: 'Account-health alerts', desc: 'A heads-up before your dispute rate approaches the 0.75% line.' },
    { label: 'New dispute notifications', desc: 'When a dispute opens and the clock starts.' },
    { label: 'Deadline reminders', desc: 'Before an open dispute is due.' },
    { label: 'Early fraud warnings', desc: 'When a refund now could prevent a dispute.' },
  ];

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>Notifications</h2>
        <p className={s.panelDesc}>
          Alerts are on the way. During beta, every alert is available to you at no charge. You will
          be able to choose what reaches you here.
        </p>
      </div>
      <div className={s.previewList}>
        {previews.map((item) => (
          <div key={item.label} className={s.previewItem}>
            <div>
              <p className={s.previewLabel}>{item.label}</p>
              <p className={s.previewDesc}>{item.desc}</p>
            </div>
            <span className={s.toggleGhost} aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Account panel ────────────────────────────────────────────────────────────

function AccountPanel({ email }: { email: string }) {
  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>Account</h2>
          <p className={s.panelDesc}>Your sign-in details and plan.</p>
        </div>
        <EmailForm email={email} />
        <hr className={s.divider} />
        <PasswordForm />
        <hr className={s.divider} />
        <div className={s.planRow}>
          <p className={s.planText}>
            You are on the Verdact beta. Every feature is unlocked, with nothing to pay while the
            beta runs.
          </p>
          <span className={s.planTag}>Beta · all unlocked</span>
        </div>
        <SignOutButton />
      </section>

      <section className={s.danger}>
        <h2 className={s.dangerTitle}>Delete account</h2>
        <p className={s.dangerText}>
          This sends a deletion request to the Verdact team. We action it within 2 business days and
          email you to confirm. Your data is not removed immediately.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatStripeAccountId(accountId: string): string {
  if (accountId.length <= 12) return accountId;
  return `${accountId.slice(0, 8)}…${accountId.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
