import { AppShell } from '../_components/app-chrome';
import { SectionBar } from '@/app/_components/ui/section-bar';
import { StatusBadge } from '@/app/_components/ui/status-badge';
import { ReassureCard } from '@/app/_components/ui/reassure-card';
import {
  PlugIcon,
  DocIcon,
  UserCheckIcon,
  ShieldIcon,
  CheckIcon,
  AlertIcon,
  InfoCircleIcon,
  LockIcon,
  GavelIcon,
  ListIcon,
  ArrowRightIcon,
} from '@/app/dashboard/dash-icons';
import {
  BusinessForm,
  PoliciesForm,
  FilingForm,
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
  // Filing opt-in (merchant_profiles.submission_opt_in). Optional so the dev
  // preview can render without them; real /settings always passes them.
  submissionOptIn?: boolean;
  canManageFiling?: boolean;
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
  submissionOptIn = false,
  canManageFiling = true,
}: SettingsViewProps) {
  const tab = resolveTab(activeTab);
  // Tabs that operate on a workspace. With no membership these would render
  // forms whose actions fail server-side, so we swap in an honest panel.
  const workspaceTab = tab === 'integrations' || tab === 'business';

  return (
    <AppShell email={email} businessName={businessName} active="settings">
      <div className={s.page}>
        <div className={s.headerText}>
          <span className={s.kicker}>Your workspace</span>
          <h1 className={s.pageTitle}>Settings</h1>
          <p className={s.sub}>Your integrations, business details, and account.</p>
          <p className={s.headerAssure}>
            <ShieldIcon />
            <span>
              <b>Nothing here files or changes a dispute.</b> These are your account details and the
              accounts Verdact reads from.
            </span>
          </p>
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
            submissionOptIn={submissionOptIn}
            canManageFiling={canManageFiling}
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
  submissionOptIn: boolean;
  canManageFiling: boolean;
};

function IntegrationsTab({
  justDisconnected,
  stripe,
  slack,
  slackNotice,
  slackError,
  submissionOptIn,
  canManageFiling,
}: IntegrationsTabProps) {
  // Connection-count read for the summary numeral. Email evidence is handled
  // per dispute, so only the two real integrations count toward "connected".
  const connectedCount = (stripe ? 1 : 0) + (slack ? 1 : 0);
  const allConnected = connectedCount === 2;

  return (
    <div
      id="settings-panel-integrations"
      role="tabpanel"
      aria-labelledby="settings-tab-integrations"
      tabIndex={0}
      className={s.stack}
    >
      {justDisconnected ? (
        <div className={`${s.banner} ${s.bannerInfo}`} role="status">
          <CheckIcon className={s.bannerIcon} />
          <span>
            Stripe disconnected. Your dispute history is still here, and you can reconnect any time.
          </span>
        </div>
      ) : null}
      {slackNotice === 'connected' ? (
        <div className={`${s.banner} ${s.bannerInfo}`} role="status">
          <CheckIcon className={s.bannerIcon} />
          <span>
            Slack connected. Open any dispute to import the messages where the customer agreed,
            accepted, or used the work.
          </span>
        </div>
      ) : null}
      {slackNotice === 'disconnected' ? (
        <div className={`${s.banner} ${s.bannerInfo}`} role="status">
          <CheckIcon className={s.bannerIcon} />
          <span>
            Slack disconnected. Imported messages stay on your disputes, and you can reconnect any
            time.
          </span>
        </div>
      ) : null}
      {slackError ? (
        <div className={`${s.banner} ${s.bannerError}`} role="alert">
          <AlertIcon className={s.bannerIcon} />
          <span>{slackError}</span>
        </div>
      ) : null}

      <section className={`${s.panel} ${s.panelHero}`}>
        <SectionBar
          icon={<PlugIcon />}
          title="Connected accounts"
          note="The accounts Verdact reads from to watch for disputes."
        />

        <div className={`${s.connSummary} ${allConnected ? '' : s.connSummaryGap}`}>
          <span className={s.connCount}>
            {connectedCount}
            <small>/2</small>
          </span>
          <div className={s.connSummaryMid}>
            <span className={s.connSummaryLabel}>
              {allConnected ? 'Accounts connected' : 'Connect both to get the full picture'}
            </span>
            <div className={s.meter} role="presentation">
              <span className={s.meterFill} style={{ width: `${(connectedCount / 2) * 100}%` }} />
              {!allConnected ? (
                <span className={s.meterGap} style={{ width: `${((2 - connectedCount) / 2) * 100}%` }} />
              ) : null}
            </div>
          </div>
        </div>

        <div className={s.connList}>
          <div className={`${s.connRow} ${stripe ? s.connRowConnected : ''}`}>
            <div className={s.connLeft}>
              <div className={`${s.connIcon} ${stripe ? s.connIconOn : ''}`} aria-hidden="true">
                S
              </div>
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
                  <StatusBadge tone="done" icon={<CheckIcon />}>
                    Connected
                  </StatusBadge>
                  <DisconnectStripe accountLabel={formatStripeAccountId(stripe.processor_account_id)} />
                </>
              ) : (
                <a href="/api/stripe/connect/start" className={s.connectBtn}>
                  Connect Stripe
                </a>
              )}
            </div>
          </div>

          <div className={`${s.connRow} ${slack ? s.connRowConnected : ''}`}>
            <div className={s.connLeft}>
              <div className={`${s.connIcon} ${slack ? s.connIconOn : ''}`} aria-hidden="true">
                #
              </div>
              <div>
                <p className={s.connName}>Slack</p>
                <p className={s.connDesc}>
                  Import the messages where a customer agreed, accepted, or used the work, per
                  dispute. Verdact reads only the channel you open and saves only the messages you
                  pick.
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
                  <StatusBadge tone="done" icon={<CheckIcon />}>
                    Connected
                  </StatusBadge>
                  <DisconnectSlack workspaceLabel={slack.team_name} />
                </>
              ) : (
                <a href="/api/slack/connect/start" className={s.connectBtn}>
                  Connect Slack
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Email evidence is handled per dispute, not connected here. Keep it as
            a quiet note so it never reads as a dead/broken integration. */}
        <p className={s.connNote}>
          <DocIcon />
          <span>
            <b>Email evidence</b> is added inside each dispute by upload, paste, or screenshot. There
            is nothing to connect here.
          </span>
        </p>

        <p className={s.trustLine}>
          <LockIcon />
          We store your account ID only, never your keys, and never train on your data.
        </p>
      </section>

      <section className={`${s.panel} ${s.panelMuted}`}>
        <SectionBar
          icon={<GavelIcon />}
          title="Filing to Stripe"
          note="Whether Verdact may submit your approved evidence for you."
        />
        <FilingForm optedIn={submissionOptIn} canManage={canManageFiling} />
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
      <SectionBar
        icon={<DocIcon />}
        title="About your business"
        note="So drafted responses match how you actually operate."
        className={s.firstBar}
      />
      <BusinessForm initial={businessInitial} />

      <SectionBar
        icon={<ListIcon />}
        title="Your policies"
        note="The refund and terms banks look for. Having them ready makes every response stronger."
      />
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
      <SectionBar
        icon={<InfoCircleIcon />}
        title="No workspace yet"
        note="Your login is not attached to a workspace yet."
      />
      <p className={s.connNote}>
        <InfoCircleIcon />
        <span>
          Your login is not attached to a workspace, so integrations and business details are not
          available yet.
        </span>
      </p>
      <p className={s.connNote}>
        <InfoCircleIcon />
        <span>
          You can still update your name, email, and password under Account. If you expected a
          workspace here, contact the Verdact team and we will sort it out.
        </span>
      </p>
      <a href="/settings?tab=account" className={s.navBtn}>
        Go to Account
        <ArrowRightIcon />
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
        <div className={s.acctGroup}>
          <SectionBar
            icon={<UserCheckIcon />}
            title="Your identity"
            note="Your name and sign-in email."
            className={s.firstBar}
          />
          <NameForm fullName={fullName} />
          <EmailForm email={email} />
        </div>

        <div className={s.acctGroup}>
          <SectionBar icon={<LockIcon />} title="Security" note="Change your password." />
          <PasswordForm />
          <SignOutButton />
        </div>

        <div className={s.acctGroup}>
          <SectionBar
            icon={<CheckIcon />}
            title="Plan"
            note="What is unlocked on your account."
          />
          <div className={s.planRow}>
            <p className={s.planText}>
              You are on the Verdact beta. Every feature is unlocked, with nothing to pay while the
              beta runs.
            </p>
            <span className={s.planTag}>
              <CheckIcon />
              Beta · all unlocked
            </span>
          </div>
          <div>
            <p className={s.quietEyebrow}>Notifications</p>
            <p className={s.quietNote}>Email notifications are coming soon.</p>
          </div>
        </div>
      </section>

      {hasMerchant ? (
        <section className={s.danger}>
          <h2 className={s.dangerTitle}>
            <AlertIcon />
            Danger zone
          </h2>
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
