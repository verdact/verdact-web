import { AppShell } from '../_components/app-chrome';
import {
  BusinessForm,
  PoliciesForm,
  NameForm,
  EmailForm,
  PasswordForm,
  SignOutButton,
  DisconnectStripe,
  DisconnectSlack,
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

export type SettingsSlack = {
  team_name: string | null;
  connected_at: string | null;
} | null;

export type SlackNotice = 'connected' | 'disconnected' | null;

export type SettingsViewProps = {
  email: string;
  fullName: string;
  businessName: string | null;
  // False when the signed-in user has no active merchant membership. The
  // workspace-scoped tabs (connections, business, policies, notifications) and
  // the account-deletion request all need a workspace, so we show an honest
  // state instead of forms that would fail with "Workspace not found".
  // Optional so the dev-only preview route can render the full populated UI
  // without supplying it; the real /settings always passes it explicitly.
  hasMerchant?: boolean;
  activeTab: TabKey;
  justDisconnected: boolean;
  businessInitial: BusinessInitial;
  policiesInitial: PoliciesInitial;
  stripe: SettingsStripe;
  slack: SettingsSlack;
  slackNotice: SlackNotice;
  slackError: string | null;
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
  fullName,
  businessName,
  hasMerchant = true,
  activeTab,
  justDisconnected,
  businessInitial,
  policiesInitial,
  stripe,
  slack,
  slackNotice,
  slackError,
}: SettingsViewProps) {
  // Tabs that operate on a workspace. With no membership these would render
  // forms whose actions fail server-side, so we swap in an honest panel.
  const workspaceTab =
    activeTab === 'connections' ||
    activeTab === 'business' ||
    activeTab === 'policies' ||
    activeTab === 'notifications';
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

        {workspaceTab && !hasMerchant ? <NoWorkspacePanel /> : null}
        {workspaceTab && hasMerchant ? (
          <WorkspaceTabs
            activeTab={activeTab}
            justDisconnected={justDisconnected}
            businessInitial={businessInitial}
            policiesInitial={policiesInitial}
            stripe={stripe}
            slack={slack}
            slackNotice={slackNotice}
            slackError={slackError}
          />
        ) : null}

        {activeTab === 'account' ? (
          <AccountPanel email={email} fullName={fullName} hasMerchant={hasMerchant} />
        ) : null}
      </div>
    </AppShell>
  );
}

// ── Workspace-scoped tabs (connections / business / policies / notifications) ─

type WorkspaceTabsProps = {
  activeTab: TabKey;
  justDisconnected: boolean;
  businessInitial: BusinessInitial;
  policiesInitial: PoliciesInitial;
  stripe: SettingsStripe;
  slack: SettingsSlack;
  slackNotice: SlackNotice;
  slackError: string | null;
};

function WorkspaceTabs({
  activeTab,
  justDisconnected,
  businessInitial,
  policiesInitial,
  stripe,
  slack,
  slackNotice,
  slackError,
}: WorkspaceTabsProps) {
  return (
    <>
      {justDisconnected && activeTab === 'connections' ? (
        <div className={s.banner} role="status">
          Stripe disconnected. Your dispute history is still here, and you can reconnect any time.
        </div>
      ) : null}

      {slackNotice === 'connected' && activeTab === 'connections' ? (
          <div className={s.banner} role="status">
            Slack connected. Open any dispute to import the messages where the customer agreed,
            accepted, or used the work.
          </div>
        ) : null}
        {slackNotice === 'disconnected' && activeTab === 'connections' ? (
          <div className={s.banner} role="status">
            Slack disconnected. Imported messages stay on your disputes, and you can reconnect any
            time.
          </div>
        ) : null}
        {slackError && activeTab === 'connections' ? (
          <div className={s.banner} role="status">
            {slackError}
          </div>
        ) : null}

        {activeTab === 'connections' ? (
          <ConnectionsPanel stripe={stripe} slack={slack} />
        ) : null}
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
    </>
  );
}

// ── No-workspace state ────────────────────────────────────────────────────────
// Shown on workspace-scoped tabs when the signed-in user has no active merchant
// membership. Honest: explains why these settings are unavailable and what still
// works, instead of forms that submit and fail with "Workspace not found".

function NoWorkspacePanel() {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>No workspace yet</h2>
        <p className={s.panelDesc}>
          Your login is not attached to a workspace, so connections, business details, evidence
          policies, and notifications are not available yet. You can still update your name, email,
          and password under the Account tab. If you expected a workspace here, contact the Verdact
          team.
        </p>
      </div>
      <a href="/settings?tab=account" className={s.connectBtn}>
        Go to Account
      </a>
    </section>
  );
}

// ── Connections panel ────────────────────────────────────────────────────────

function ConnectionsPanel({ stripe, slack }: { stripe: SettingsStripe; slack: SettingsSlack }) {
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
              Import the messages where a customer agreed, accepted, or used the work, per dispute.
              Verdact reads only the channel you open and saves only the messages you pick.
            </p>
            {slack ? (
              <p className={s.connMeta}>
                {slack.team_name ? slack.team_name : 'Workspace connected'}
                {slack.connected_at ? ` · connected ${formatDate(slack.connected_at)}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        <div className={s.connRight}>
          {slack ? (
            <>
              <span className={`${s.statusPill} ${s.statusPillConnected}`}>
                <span className={`${s.statusDot} ${s.statusDotOn}`} aria-hidden="true" />
                Connected
              </span>
              <DisconnectSlack workspaceLabel={slack.team_name} />
            </>
          ) : (
            <a href="/api/slack/connect/start" className={s.connectBtn}>
              Connect Slack
            </a>
          )}
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

function AccountPanel({
  email,
  fullName,
  hasMerchant,
}: {
  email: string;
  fullName: string;
  hasMerchant: boolean;
}) {
  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>Account</h2>
          <p className={s.panelDesc}>Your name, sign-in details, and plan.</p>
        </div>
        <NameForm fullName={fullName} />
        <hr className={s.divider} />
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

      {hasMerchant ? (
        <section className={s.danger}>
          <h2 className={s.dangerTitle}>Delete account</h2>
          <p className={s.dangerText}>
            This sends a deletion request to the Verdact team. We action it within 2 business days
            and email you to confirm. Your data is not removed immediately.
          </p>
          <DeleteAccount />
        </section>
      ) : null}
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
