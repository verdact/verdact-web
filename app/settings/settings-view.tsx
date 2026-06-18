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
  SettingsTabs,
  type BusinessInitial,
  type PoliciesInitial,
} from './settings-client';
import s from './settings.module.css';

// Redesign 2026-06 (Port decision #4): Settings consolidated from 5 tabs to 3.
//   Integrations  = Stripe + Slack connections + the manual-first email card
//   Business      = business profile + the merged Policies group
//   Account       = identity / security / plan, a quiet notifications line, danger zone
// Legacy tab keys (connections / policies / notifications) are still accepted so
// old bookmarks resolve, and the dev preview route keeps compiling. They are
// normalized to one of the three live tabs by resolveTab().
export type ActiveTab = 'integrations' | 'business' | 'account';
type LegacyTab = 'connections' | 'policies' | 'notifications';
export type TabKey = ActiveTab | LegacyTab;

const TABS: Array<{ key: ActiveTab; label: string }> = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'business', label: 'Business' },
  { key: 'account', label: 'Account' },
];

// Old → new mapping so /settings?tab=connections and friends still land somewhere.
const LEGACY_MAP: Record<LegacyTab, ActiveTab> = {
  connections: 'integrations',
  policies: 'business',
  notifications: 'account',
};

function resolveTab(tab: TabKey): ActiveTab {
  return tab === 'integrations' || tab === 'business' || tab === 'account'
    ? tab
    : LEGACY_MAP[tab];
}

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
  // workspace-scoped tabs (integrations, business) and the account-deletion
  // request all need a workspace, so we show an honest state instead of forms
  // that would fail with "Workspace not found". Optional so the dev-only
  // preview route can render the full populated UI without supplying it; the
  // real /settings always passes it explicitly.
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
    value === 'integrations' ||
    value === 'business' ||
    value === 'account' ||
    value === 'connections' ||
    value === 'policies' ||
    value === 'notifications'
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
  const tab = resolveTab(activeTab);
  // Tabs that operate on a workspace. With no membership these would render
  // forms whose actions fail server-side, so we swap in an honest panel.
  const workspaceTab = tab === 'integrations' || tab === 'business';

  return (
    <AppShell email={email} businessName={businessName} active="settings">
      <div className={s.page}>
        <div className={s.headerText}>
          <h1 className={s.pageTitle}>Settings</h1>
          <p className={s.sub}>Your integrations, business details, and account.</p>
        </div>

        <SettingsTabs tabs={TABS} activeTab={tab} />

        {workspaceTab && !hasMerchant ? <NoWorkspacePanel activeTab={tab} /> : null}

        {tab === 'integrations' && hasMerchant ? (
          <IntegrationsTab
            justDisconnected={justDisconnected}
            stripe={stripe}
            slack={slack}
            slackNotice={slackNotice}
            slackError={slackError}
          />
        ) : null}

        {tab === 'business' && hasMerchant ? (
          <BusinessTab businessInitial={businessInitial} policiesInitial={policiesInitial} />
        ) : null}

        {tab === 'account' ? (
          <AccountPanel email={email} fullName={fullName} hasMerchant={hasMerchant} />
        ) : null}
      </div>
    </AppShell>
  );
}

// ── Integrations tab (Stripe + Slack + manual-first email evidence) ───────────

type IntegrationsTabProps = {
  justDisconnected: boolean;
  stripe: SettingsStripe;
  slack: SettingsSlack;
  slackNotice: SlackNotice;
  slackError: string | null;
};

function IntegrationsTab({
  justDisconnected,
  stripe,
  slack,
  slackNotice,
  slackError,
}: IntegrationsTabProps) {
  return (
    <div
      id="settings-panel-integrations"
      role="tabpanel"
      aria-labelledby="settings-tab-integrations"
      tabIndex={0}
      className={s.stack}
    >
      {justDisconnected ? (
        <div className={s.banner} role="status">
          Stripe disconnected. Your dispute history is still here, and you can reconnect any time.
        </div>
      ) : null}
      {slackNotice === 'connected' ? (
        <div className={s.banner} role="status">
          Slack connected. Open any dispute to import the messages where the customer agreed,
          accepted, or used the work.
        </div>
      ) : null}
      {slackNotice === 'disconnected' ? (
        <div className={s.banner} role="status">
          Slack disconnected. Imported messages stay on your disputes, and you can reconnect any
          time.
        </div>
      ) : null}
      {slackError ? (
        <div className={s.banner} role="status">
          {slackError}
        </div>
      ) : null}

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>Integrations</h2>
          <p className={s.panelDesc}>
            Connect the accounts Verdact reads from. Email evidence is added per dispute in the
            workbench, not connected here.
          </p>
        </div>

        <div className={s.connRow}>
          <div className={s.connLeft}>
            <div className={`${s.connIcon} ${s.connIconStripe}`}>S</div>
            <div>
              <p className={s.connName}>Stripe</p>
              <p className={s.connDesc}>
                The connected account Verdact watches for disputes and early fraud warnings. We
                store the account ID only, never your API keys.
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

        <hr className={s.divider} />

        <div className={s.connRow}>
          <div className={s.connLeft}>
            <div className={s.connIcon} aria-hidden="true">
              @
            </div>
            <div>
              <p className={s.connName}>Email evidence</p>
              <p className={s.connDesc}>
                Add email evidence by upload, paste, or screenshot inside any dispute. There is
                nothing to connect here.
              </p>
            </div>
          </div>
        </div>

        <p className={s.trustLine}>
          We store your account ID only, never your keys, and never train on your data.
        </p>
      </section>
    </div>
  );
}

// ── Business tab (profile + merged Policies group) ────────────────────────────

function BusinessTab({
  businessInitial,
  policiesInitial,
}: {
  businessInitial: BusinessInitial;
  policiesInitial: PoliciesInitial;
}) {
  return (
    <section
      id="settings-panel-business"
      role="tabpanel"
      aria-labelledby="settings-tab-business"
      tabIndex={0}
      className={s.panel}
    >
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>Business details</h2>
        <p className={s.panelDesc}>
          Tell Verdact about your business so drafted responses match how you actually operate.
        </p>
      </div>
      <BusinessForm initial={businessInitial} />

      <hr className={s.divider} />

      <div className={s.panelHead}>
        <h3 className={s.subhead}>Policies</h3>
        <p className={s.panelDesc}>
          Your refund, cancellation, and terms. These are the policies banks look for, so having
          them ready makes every submission stronger.
        </p>
      </div>
      <PoliciesForm initial={policiesInitial} />
    </section>
  );
}

// ── No-workspace state ────────────────────────────────────────────────────────
// Shown on workspace-scoped tabs when the signed-in user has no active merchant
// membership. Honest: explains why these settings are unavailable and what still
// works, instead of forms that submit and fail with "Workspace not found".

function NoWorkspacePanel({ activeTab }: { activeTab: ActiveTab }) {
  return (
    <section
      id={`settings-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`settings-tab-${activeTab}`}
      tabIndex={0}
      className={s.panel}
    >
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>No workspace yet</h2>
        <p className={s.panelDesc}>
          Your login is not attached to a workspace, so integrations and business details are not
          available yet. You can still update your name, email, and password under the Account tab.
          If you expected a workspace here, contact the Verdact team.
        </p>
      </div>
      <a href="/settings?tab=account" className={s.connectBtn}>
        Go to Account
      </a>
    </section>
  );
}

// ── Account panel (identity / security / plan / notifications note / danger) ──

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
    <div
      id="settings-panel-account"
      role="tabpanel"
      aria-labelledby="settings-tab-account"
      tabIndex={0}
      className={s.stack}
    >
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
        <hr className={s.divider} />
        <p className={s.quietNote}>Email notifications are coming soon.</p>
        <SignOutButton />
      </section>

      {hasMerchant ? (
        <section className={s.danger}>
          <h2 className={s.dangerTitle}>Danger zone</h2>
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
