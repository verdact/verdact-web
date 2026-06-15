import { ThemeToggle } from '@/app/_components/theme-toggle';
import { VerdactLogo } from '@/app/_components/verdact-logo';
import {
  getAdminDashboardData,
  type AdminDashboardData,
  type AdminTrend,
  type AuditLeadRow,
  type MerchantRow,
  type PlatformInviteRow,
  type WaitlistSignupRow,
} from '@/lib/admin/queries';
import { approveInviteAction, revokeInviteAction, setAdmissionModeAction } from './actions';
import s from './admin.module.css';

export const metadata = {
  title: 'Admin | Verdact',
  description: 'Founder-only platform operations for Verdact.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = {
  notice?: string | string[];
  error?: string | string[];
};

const NOTICE_COPY: Record<string, string> = {
  'invite-approved': 'Invite approved.',
  'invite-revoked': 'Invite revoked.',
  'open-beta-enabled': 'Open beta is enabled.',
  'invite-only-enabled': 'Invite-only mode is enabled.',
};

const ERROR_COPY: Record<string, string> = {
  'invalid-email': 'Enter a valid email address.',
  'invite-failed': 'Invite could not be saved.',
  'invalid-invite': 'Invite was not recognized.',
  'revoke-failed': 'Invite could not be revoked.',
  'invalid-mode': 'Admission mode was not recognized.',
  'open-beta-confirmation': 'Type OPEN BETA to enable open beta.',
  'mode-failed': 'Admission mode could not be updated.',
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminDashboardData();
  const notice = firstParam(params.notice);
  const error = firstParam(params.error);

  return (
    <AdminShell data={data}>
      <div className={s.page}>
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Founder admin</p>
            <h1 className={s.title}>Platform operations</h1>
          </div>
          <div className={s.headerMeta}>
            <span className={s.metaLabel}>Signed in</span>
            <span className={s.metaValue}>{data.admin.email}</span>
          </div>
        </header>

        {notice && NOTICE_COPY[notice] ? (
          <div className={s.notice} role="status">
            {NOTICE_COPY[notice]}
          </div>
        ) : null}
        {error && ERROR_COPY[error] ? (
          <div className={`${s.notice} ${s.noticeError}`} role="alert">
            {ERROR_COPY[error]}
          </div>
        ) : null}

        <section className={s.statusStrip} aria-label="Platform status">
          <div>
            <span className={s.statusLabel}>Admission</span>
            <strong className={s.statusValue}>{formatMode(data.policy.mode)}</strong>
          </div>
          <div>
            <span className={s.statusLabel}>Waitlist</span>
            <strong className={s.statusValue}>{formatNumber(data.stats.waitlistSignups)}</strong>
          </div>
          <div>
            <span className={s.statusLabel}>Merchants</span>
            <strong className={s.statusValue}>{formatNumber(data.stats.merchants)}</strong>
          </div>
          <div>
            <span className={s.statusLabel}>Stripe connected</span>
            <strong className={s.statusValue}>{formatNumber(data.stats.stripeConnections)}</strong>
          </div>
        </section>

        <Metrics data={data} />

        <section id="admission" className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Access</p>
              <h2 className={s.panelTitle}>Admission control</h2>
            </div>
            <span className={`${s.modePill} ${data.policy.mode === 'open_beta' ? s.modeOpen : ''}`}>
              {formatMode(data.policy.mode)}
            </span>
          </div>

          <div className={s.modeGrid}>
            <div className={s.modeMeta}>
              <span>Updated</span>
              <strong>{formatDateTime(data.policy.updated_at)}</strong>
            </div>
            <form action={setAdmissionModeAction} className={s.inlineForm}>
              <input type="hidden" name="mode" value="invite_only" />
              <button
                type="submit"
                className={s.secondaryBtn}
                disabled={data.policy.mode === 'invite_only'}
              >
                Set invite-only
              </button>
            </form>
            <form action={setAdmissionModeAction} className={s.openForm}>
              <input type="hidden" name="mode" value="open_beta" />
              <label className={s.label} htmlFor="confirmation">
                Confirm open beta
              </label>
              <div className={s.formRow}>
                <input
                  id="confirmation"
                  name="confirmation"
                  className={s.input}
                  placeholder="OPEN BETA"
                  autoComplete="off"
                  disabled={data.policy.mode === 'open_beta'}
                />
                <button
                  type="submit"
                  className={s.primaryBtn}
                  disabled={data.policy.mode === 'open_beta'}
                >
                  Enable open beta
                </button>
              </div>
            </form>
          </div>
        </section>

        <section id="invites" className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Closed beta</p>
              <h2 className={s.panelTitle}>Beta invites</h2>
            </div>
            <span className={s.countPill}>{formatNumber(data.stats.invitesApproved)} approved</span>
          </div>

          <form action={approveInviteAction} className={s.inviteForm}>
            <div className={s.field}>
              <label className={s.label} htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                className={s.input}
                placeholder="founder@example.com"
                autoComplete="off"
                required
              />
            </div>
            <div className={s.fieldWide}>
              <label className={s.label} htmlFor="invite-notes">
                Notes
              </label>
              <input
                id="invite-notes"
                name="notes"
                className={s.input}
                placeholder="Source, cohort, or context"
                autoComplete="off"
              />
            </div>
            <button type="submit" className={s.primaryBtn}>
              Approve access
            </button>
          </form>

          <InvitesTable invites={data.invites} />
        </section>

        <section id="leads" className={s.split}>
          <LeadTable waitlist={data.waitlist} />
          <AuditLeadTable leads={data.auditLeads} />
        </section>

        <section id="trends" className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Trends</p>
              <h2 className={s.panelTitle}>Last 7 days vs prior 7</h2>
            </div>
          </div>
          <TrendTable trends={data.trends} />
        </section>

        <section id="merchants" className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <p className={s.panelKicker}>Accounts</p>
              <h2 className={s.panelTitle}>Recent merchants</h2>
            </div>
            <span className={s.countPill}>{formatNumber(data.stats.activeMerchantUsers)} active users</span>
          </div>
          <MerchantsTable merchants={data.merchants} />
        </section>

        <section id="security" className={s.split}>
          <AdminsPanel data={data} />
          <EventsPanel data={data} />
        </section>
      </div>
    </AdminShell>
  );
}

function AdminShell({
  data,
  children,
}: {
  data: AdminDashboardData;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="app-rail__head">
          <a href="/admin" className="app-rail__logo">
            <VerdactLogo variant="mark" className="h-8 w-8 shrink-0" />
            <div className="app-rail__workspace">
              <span className="app-rail__workspace-label">admin</span>
              <span className="app-rail__workspace-name">Verdact platform</span>
            </div>
          </a>
        </div>
        <nav className="app-rail__nav" aria-label="Admin navigation">
          <a className="app-rail__link is-active" href="/admin">
            Overview
          </a>
          <a className="app-rail__link" href="#admission">
            Admission
          </a>
          <a className="app-rail__link" href="#invites">
            Invites
          </a>
          <a className="app-rail__link" href="#leads">
            Leads
          </a>
          <a className="app-rail__link" href="#merchants">
            Merchants
          </a>
          <a className="app-rail__link" href="/dashboard">
            App dashboard
          </a>
        </nav>
        <div className="app-rail__foot">
          <div className="app-rail__user">
            <span className="app-rail__email" title={data.admin.email}>
              {data.admin.email}
            </span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="app-rail__signout">
                Sign out
              </button>
            </form>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <header className="app-topbar">
        <a href="/admin" className="app-topbar__logo" aria-label="Admin">
          <VerdactLogo variant="lockup" className="h-6 w-auto" />
        </a>
        <span className="app-topbar__workspace">Founder admin</span>
      </header>

      <main className="app-content" id="main" tabIndex={-1}>
        {children}
      </main>

      <nav className="app-bottom-nav" aria-label="Admin navigation">
        <a className="app-bottom-nav__item is-active" href="/admin">
          <span>Admin</span>
        </a>
        <a className="app-bottom-nav__item" href="#admission">
          <span>Access</span>
        </a>
        <a className="app-bottom-nav__item" href="#leads">
          <span>Leads</span>
        </a>
        <a className="app-bottom-nav__item" href="/dashboard">
          <span>App</span>
        </a>
      </nav>
    </div>
  );
}

function Metrics({ data }: { data: AdminDashboardData }) {
  const metrics = [
    { label: 'Audit leads', value: data.stats.auditLeads, sub: `${data.stats.convertedAuditLeads} converted` },
    { label: 'Open disputes', value: data.stats.openDisputes, sub: `${data.stats.disputes} total disputes` },
    { label: 'Won disputes', value: data.stats.wonDisputes, sub: `${data.stats.lostDisputes} lost` },
    { label: 'VAMP at-risk', value: data.stats.vampAtRiskMerchants, sub: 'Latest snapshot above 0.75%' },
  ];

  return (
    <section className={s.metrics} aria-label="Platform metrics">
      {metrics.map((metric) => (
        <div key={metric.label} className={s.metric}>
          <span className={s.metricLabel}>{metric.label}</span>
          <strong className={s.metricValue}>{formatNumber(metric.value)}</strong>
          <span className={s.metricSub}>{metric.sub}</span>
        </div>
      ))}
    </section>
  );
}

function InvitesTable({ invites }: { invites: PlatformInviteRow[] }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Source</th>
            <th>Created</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {invites.length === 0 ? (
            <EmptyRow colSpan={5} label="No invites yet." />
          ) : (
            invites.map((invite) => (
              <tr key={invite.id}>
                <td>
                  <span className={s.strong}>{invite.email}</span>
                  {invite.notes ? <span className={s.cellNote}>{invite.notes}</span> : null}
                </td>
                <td>
                  <span className={`${s.status} ${invite.status === 'approved' ? s.statusOk : s.statusIdle}`}>
                    {invite.status}
                  </span>
                </td>
                <td>{invite.source ?? 'admin'}</td>
                <td>{formatDateShort(invite.created_at)}</td>
                <td className={s.actionsCell}>
                  {invite.status === 'approved' ? (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className={s.textBtn}>
                        Revoke
                      </button>
                    </form>
                  ) : (
                    <span className={s.muted}>Revoked</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadTable({ waitlist }: { waitlist: WaitlistSignupRow[] }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Waitlist</p>
          <h2 className={s.panelTitle}>Latest signups</h2>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Source</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {waitlist.length === 0 ? (
              <EmptyRow colSpan={3} label="No waitlist signups yet." />
            ) : (
              waitlist.map((row) => (
                <tr key={row.id}>
                  <td className={s.strong}>{row.email}</td>
                  <td>{row.source ?? 'signup'}</td>
                  <td>{formatDateShort(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditLeadTable({ leads }: { leads: AuditLeadRow[] }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Audit funnel</p>
          <h2 className={s.panelTitle}>Latest audit leads</h2>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Rate</th>
              <th>Unwon</th>
              <th>Band</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <EmptyRow colSpan={5} label="No audit leads yet." />
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <span className={s.strong}>{lead.business_name || lead.email}</span>
                    {lead.business_name ? <span className={s.cellNote}>{lead.email}</span> : null}
                  </td>
                  <td>{formatPercentFraction(lead.estimated_dispute_rate)}</td>
                  <td>{formatNumber(lead.should_have_won_count)}</td>
                  <td>{lead.standing_band ?? 'unknown'}</td>
                  <td>{formatDateShort(lead.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrendTable({ trends }: { trends: AdminTrend[] }) {
  return (
    <div className={s.trendGrid}>
      {trends.map((item) => {
        const delta = item.last7 - item.previous7;
        return (
          <div key={item.label} className={s.trendItem}>
            <span className={s.metricLabel}>{item.label}</span>
            <strong className={s.trendValue}>{formatNumber(item.last7)}</strong>
            <span className={delta >= 0 ? s.deltaUp : s.deltaDown}>
              {delta >= 0 ? '+' : ''}
              {formatNumber(delta)} vs prior 7
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MerchantsTable({ merchants }: { merchants: MerchantRow[] }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>Merchant</th>
            <th>ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {merchants.length === 0 ? (
            <EmptyRow colSpan={3} label="No merchants yet." />
          ) : (
            merchants.map((merchant) => (
              <tr key={merchant.id}>
                <td className={s.strong}>{merchant.business_name || 'Unnamed workspace'}</td>
                <td className={s.mono}>{shortId(merchant.id)}</td>
                <td>{formatDateShort(merchant.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminsPanel({ data }: { data: AdminDashboardData }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Security</p>
          <h2 className={s.panelTitle}>Founder admins</h2>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {data.admins.map((admin) => (
              <tr key={admin.email}>
                <td className={s.strong}>{admin.email}</td>
                <td>{admin.role}</td>
                <td>{admin.last_seen_at ? formatDateShort(admin.last_seen_at) : 'Not seen'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventsPanel({ data }: { data: AdminDashboardData }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Audit trail</p>
          <h2 className={s.panelTitle}>Recent admin events</h2>
        </div>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.events.length === 0 ? (
              <EmptyRow colSpan={3} label="No admin events yet." />
            ) : (
              data.events.map((event) => (
                <tr key={event.id}>
                  <td className={s.strong}>{event.action}</td>
                  <td>{event.admin_email ?? 'unknown'}</td>
                  <td>{formatDateShort(event.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={s.emptyCell}>
        {label}
      </td>
    </tr>
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatMode(mode: 'invite_only' | 'open_beta'): string {
  return mode === 'open_beta' ? 'Open beta' : 'Invite only';
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentFraction(value: number | string | null): string {
  if (value == null) return 'n/a';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${(numeric * 100).toFixed(2)}%`;
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
