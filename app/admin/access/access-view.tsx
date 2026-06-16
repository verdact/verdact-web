'use client';

import { useMemo, useState } from 'react';
import type {
  AccessData,
  AdminEventRow,
  PlatformAdminListRow,
  PlatformInviteRow,
} from '@/lib/admin/queries';
import {
  approveInviteAction,
  revokeInviteAction,
  setAdmissionModeAction,
  addAdminAction,
  revokeAdminAction,
} from '../actions';
import { Drawer, DrawerSection, DetailRow, WhyNow } from '../_components/drawer';
import { Badge, SearchIcon } from '../_components/console';
import {
  EmptyRow,
  Notice,
  formatDateShort,
  formatDateTime,
  formatNumber,
  relativeTime,
  shortId,
} from '../_components/ui';
import s from '../admin.module.css';
import a from './access.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Access cockpit — a control surface for who can sign up, who is invited, and
// who holds founder access. Admission state is framed as a deliberate, reversible
// decision; invites and admins are searchable/filterable; the audit trail
// explains who did what and when. Detail opens in the shared right-side drawer.
// Nothing is sent from here — every change is a gated server action.
// ─────────────────────────────────────────────────────────────────────────────

const NOTICE_COPY = {
  notices: {
    'invite-approved': 'Invite approved. The address can now create an account.',
    'invite-revoked': 'Invite revoked. The address can no longer create an account.',
    'open-beta-enabled': 'Open beta is live. Anyone can now sign up.',
    'invite-only-enabled': 'Invite-only is back on. Only approved addresses can sign up.',
    'admin-added': 'Admin added.',
    'admin-revoked': 'Admin access revoked.',
  },
  errors: {
    'invalid-email': 'Enter a valid email address.',
    'invite-failed': 'Invite could not be saved. Try again.',
    'invalid-invite': 'That invite was not recognized.',
    'revoke-failed': 'Invite could not be revoked. Try again.',
    'invalid-mode': 'Admission mode was not recognized.',
    'open-beta-confirmation': 'Type OPEN BETA exactly to switch to open beta.',
    'mode-failed': 'Admission mode could not be updated. Try again.',
    'owner-only': 'Only owners can perform this action.',
    'admin-failed': 'Admin change could not be saved. Try again.',
    'last-owner': 'You cannot revoke the last active owner.',
  },
};

type InviteFilter = 'all' | 'approved' | 'revoked';
type AdminFilter = 'all' | 'owner' | 'admin' | 'revoked';

type Selection =
  | { kind: 'invite'; row: PlatformInviteRow }
  | { kind: 'admin'; row: PlatformAdminListRow }
  | { kind: 'event'; row: AdminEventRow }
  | null;

export function AccessView({
  data,
  notice,
  error,
}: {
  data: AccessData;
  notice: string | null;
  error: string | null;
}) {
  const isOwner = data.admin.role === 'owner';
  const openBeta = data.policy.mode === 'open_beta';
  const [selected, setSelected] = useState<Selection>(null);

  const activeAdmins = data.admins.filter((row) => row.status === 'active');
  const activeOwners = activeAdmins.filter((row) => row.role === 'owner');

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Founder admin</p>
          <h1 className={s.title}>Access</h1>
          <p className={s.sectionLead}>
            The platform&apos;s front door and its keys: who can sign up, who is invited, and who has founder access to this console.
          </p>
        </div>
        <div className={s.headerMeta}>
          <span className={s.metaLabel}>Signed in as</span>
          <span className={s.metaValue}>
            {data.admin.email} · {data.admin.role}
          </span>
        </div>
      </header>

      <Notice notice={notice} error={error} copy={NOTICE_COPY} />

      <AdmissionHero
        openBeta={openBeta}
        isOwner={isOwner}
        updatedAt={data.policy.updated_at}
      />

      <InvitesPanel
        invites={data.invites}
        approvedCount={data.invitesApproved}
        onOpen={(row) => setSelected({ kind: 'invite', row })}
      />

      <AdminsPanel
        admins={data.admins}
        isOwner={isOwner}
        selfEmail={data.admin.emailNormalized}
        activeOwnerCount={activeOwners.length}
        onOpen={(row) => setSelected({ kind: 'admin', row })}
      />

      <AuditPanel
        events={data.events}
        onOpen={(row) => setSelected({ kind: 'event', row })}
      />

      <DetailDrawer
        selection={selected}
        isOwner={isOwner}
        selfEmail={data.admin.emailNormalized}
        activeOwnerCount={activeOwners.length}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ── Admission hero ───────────────────────────────────────────────────────────

function AdmissionHero({
  openBeta,
  isOwner,
  updatedAt,
}: {
  openBeta: boolean;
  isOwner: boolean;
  updatedAt: string;
}) {
  const stateLabel = openBeta ? 'Open beta' : 'Invite only';
  const consequence = openBeta
    ? 'Anyone with the link can create an account right now. Growth is uncapped, but so is the mix of who lands inside.'
    : 'Only addresses you approve below can create an account. Every new merchant is one you chose to let in.';

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Admission</p>
          <h2 className={s.panelTitle}>Who can sign up</h2>
        </div>
        <span className={`${s.modePill} ${openBeta ? s.modeOpen : ''}`}>{stateLabel}</span>
      </div>

      <div className={a.admissionHero}>
        <div className={a.admissionState}>
          <span className={a.admissionStateValue}>{stateLabel}</span>
          <p className={a.admissionConsequence}>{consequence}</p>
          <div className={a.admissionMeta}>
            <span>
              Last changed <strong>{formatDateTime(updatedAt)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>This is reversible at any time.</span>
          </div>
        </div>

        <div className={a.admissionControl}>
          {isOwner ? (
            openBeta ? (
              <CloseToInviteOnly />
            ) : (
              <OpenBetaConfirm />
            )
          ) : (
            <p className={a.lockNote}>
              Admission mode is owner-controlled. Ask an owner to open or close public signups.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function OpenBetaConfirm() {
  return (
    <>
      <p className={a.admissionControlLead}>
        Switching to open beta lets anyone sign up. To avoid an accidental flip, type{' '}
        <strong>OPEN BETA</strong> to confirm.
      </p>
      <form action={setAdmissionModeAction} className={a.confirmStack}>
        <input type="hidden" name="mode" value="open_beta" />
        <label className={s.label} htmlFor="confirmation">
          Confirmation
        </label>
        <div className={a.confirmRow}>
          <input
            id="confirmation"
            name="confirmation"
            className={s.input}
            placeholder="OPEN BETA"
            autoComplete="off"
            aria-describedby="open-beta-hint"
          />
          <button type="submit" className={s.primaryBtn}>
            Open public signups
          </button>
        </div>
      </form>
    </>
  );
}

function CloseToInviteOnly() {
  return (
    <>
      <p className={a.admissionControlLead}>
        Public signups are open. Closing the door again is immediate and takes one click. Existing
        accounts keep their access.
      </p>
      <form action={setAdmissionModeAction} className={a.confirmStack}>
        <input type="hidden" name="mode" value="invite_only" />
        <button type="submit" className={s.secondaryBtn}>
          Close to invite-only
        </button>
      </form>
    </>
  );
}

// ── Invites ──────────────────────────────────────────────────────────────────

function InvitesPanel({
  invites,
  approvedCount,
  onOpen,
}: {
  invites: PlatformInviteRow[];
  approvedCount: number;
  onOpen: (row: PlatformInviteRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InviteFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invites.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.email.toLowerCase().includes(q) ||
        (row.notes ?? '').toLowerCase().includes(q) ||
        (row.source ?? '').toLowerCase().includes(q)
      );
    });
  }, [invites, query, filter]);

  const counts: Record<InviteFilter, number> = {
    all: invites.length,
    approved: invites.filter((r) => r.status === 'approved').length,
    revoked: invites.filter((r) => r.status === 'revoked').length,
  };

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Invites</p>
          <h2 className={s.panelTitle}>Approved addresses</h2>
        </div>
        <span className={s.countPill}>{formatNumber(approvedCount)} approved</span>
      </div>

      {/* Approve where you actually use it — top of the list. */}
      <form action={approveInviteAction} className={a.quickApprove}>
        <div className={s.field}>
          <label className={s.label} htmlFor="invite-email">
            Approve an email
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
        <div className={s.field}>
          <label className={s.label} htmlFor="invite-notes">
            Notes (source, cohort, context)
          </label>
          <input
            id="invite-notes"
            name="notes"
            className={s.input}
            placeholder="LinkedIn warm lead"
            autoComplete="off"
          />
        </div>
        <button type="submit" className={s.primaryBtn}>
          Approve access
        </button>
      </form>

      <div className={s.filterBar}>
        <div className={s.searchWrap}>
          <SearchIcon />
          <input
            type="search"
            className={s.searchInput}
            placeholder="Search by email, note, or source"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search invites"
          />
        </div>
        <div className={s.chipRow} role="group" aria-label="Filter invites by status">
          {(['all', 'approved', 'revoked'] as InviteFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${s.chip} ${filter === key ? s.chipActive : ''}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {INVITE_FILTER_LABELS[key]} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Source</th>
              <th>Expiry</th>
              <th>Age</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow
                colSpan={6}
                label={invites.length === 0 ? 'No invites yet. Approve an email above to let someone in.' : 'No invites match this filter.'}
              />
            ) : (
              filtered.map((invite) => (
                <tr key={invite.id}>
                  <td>
                    <button type="button" className={a.rowButton} onClick={() => onOpen(invite)}>
                      <span className={a.rowButtonLabel}>{invite.email}</span>
                      {invite.notes ? <span className={s.cellNote}>{invite.notes}</span> : null}
                    </button>
                  </td>
                  <td>
                    <InviteStatusBadge status={invite.status} />
                  </td>
                  <td className={s.muted}>{invite.source ?? 'admin'}</td>
                  <td>{expiryLabel(invite.expires_at)}</td>
                  <td className={s.muted}>{relativeTime(invite.created_at)}</td>
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
    </section>
  );
}

const INVITE_FILTER_LABELS: Record<InviteFilter, string> = {
  all: 'All',
  approved: 'Approved',
  revoked: 'Revoked',
};

function InviteStatusBadge({ status }: { status: PlatformInviteRow['status'] }) {
  return status === 'approved' ? (
    <Badge tone="verdict">Approved</Badge>
  ) : (
    <Badge tone="muted">Revoked</Badge>
  );
}

// ── Admins ───────────────────────────────────────────────────────────────────

function AdminsPanel({
  admins,
  isOwner,
  selfEmail,
  activeOwnerCount,
  onOpen,
}: {
  admins: PlatformAdminListRow[];
  isOwner: boolean;
  selfEmail: string;
  activeOwnerCount: number;
  onOpen: (row: PlatformAdminListRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AdminFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return admins.filter((row) => {
      if (filter === 'revoked' && row.status !== 'revoked') return false;
      if ((filter === 'owner' || filter === 'admin') && (row.role !== filter || row.status !== 'active')) {
        return false;
      }
      if (!q) return true;
      return row.email.toLowerCase().includes(q);
    });
  }, [admins, query, filter]);

  const counts: Record<AdminFilter, number> = {
    all: admins.length,
    owner: admins.filter((r) => r.role === 'owner' && r.status === 'active').length,
    admin: admins.filter((r) => r.role === 'admin' && r.status === 'active').length,
    revoked: admins.filter((r) => r.status === 'revoked').length,
  };

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Founder access</p>
          <h2 className={s.panelTitle}>Console admins</h2>
        </div>
        {isOwner ? (
          <span className={s.countPill}>{formatNumber(counts.owner)} owners · {formatNumber(counts.admin)} admins</span>
        ) : (
          <span className={s.countPill}>View only — owners manage access</span>
        )}
      </div>

      {isOwner ? (
        <form action={addAdminAction} className={a.quickApprove}>
          <div className={s.field}>
            <label className={s.label} htmlFor="admin-email">
              Grant console access
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              className={s.input}
              placeholder="teammate@verdact.io"
              autoComplete="off"
              required
            />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="admin-role">
              Role
            </label>
            <select id="admin-role" name="role" className={s.input} defaultValue="admin">
              <option value="admin">Admin — full console, cannot manage access</option>
              <option value="owner">Owner — can manage access and admission</option>
            </select>
          </div>
          <button type="submit" className={s.primaryBtn}>
            Add admin
          </button>
        </form>
      ) : null}

      <div className={s.filterBar}>
        <div className={s.searchWrap}>
          <SearchIcon />
          <input
            type="search"
            className={s.searchInput}
            placeholder="Search admins by email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search admins"
          />
        </div>
        <div className={s.chipRow} role="group" aria-label="Filter admins">
          {(['all', 'owner', 'admin', 'revoked'] as AdminFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${s.chip} ${filter === key ? s.chipActive : ''}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {ADMIN_FILTER_LABELS[key]} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last seen</th>
              {isOwner ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={isOwner ? 5 : 4} label={admins.length === 0 ? 'No admins found.' : 'No admins match this filter.'} />
            ) : (
              filtered.map((entry) => {
                const isSelf = entry.email.trim().toLowerCase() === selfEmail;
                // The action guards the last owner server-side; mirror that here so
                // the destructive control isn't even offered when it would fail.
                const wouldStrandOwners = entry.role === 'owner' && entry.status === 'active' && activeOwnerCount <= 1;
                const canRevoke = entry.status === 'active' && !isSelf && !wouldStrandOwners;
                return (
                  <tr key={entry.email}>
                    <td>
                      <button type="button" className={a.rowButton} onClick={() => onOpen(entry)}>
                        <span className={a.rowButtonLabel}>
                          {entry.email}
                          {isSelf ? <span className={a.selfTag}>You</span> : null}
                        </span>
                      </button>
                    </td>
                    <td>
                      {entry.role === 'owner' ? <Badge tone="verdict">Owner</Badge> : <Badge tone="neutral">Admin</Badge>}
                    </td>
                    <td>
                      {entry.status === 'active' ? <Badge tone="neutral" dot>Active</Badge> : <Badge tone="muted">Revoked</Badge>}
                    </td>
                    <td>
                      <LastSeen iso={entry.last_seen_at} />
                    </td>
                    {isOwner ? (
                      <td className={s.actionsCell}>
                        {canRevoke ? (
                          <form action={revokeAdminAction}>
                            <input type="hidden" name="email" value={entry.email} />
                            <button type="submit" className={s.textBtn}>
                              Revoke
                            </button>
                          </form>
                        ) : (
                          <span className={s.muted}>
                            {isSelf ? 'You' : wouldStrandOwners ? 'Last owner' : '—'}
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ADMIN_FILTER_LABELS: Record<AdminFilter, string> = {
  all: 'All',
  owner: 'Owners',
  admin: 'Admins',
  revoked: 'Revoked',
};

function LastSeen({ iso }: { iso: string | null }) {
  if (!iso) {
    return <span className={s.muted}>Not seen yet</span>;
  }
  const recent = Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
  return (
    <span className={a.presence}>
      <span className={`${a.presenceDot} ${recent ? a.presenceActive : ''}`} aria-hidden="true" />
      {relativeTime(iso)}
    </span>
  );
}

// ── Audit trail ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  platform_invite_approved: 'Invite approved',
  platform_invite_revoked: 'Invite revoked',
  admission_mode_changed: 'Admission mode changed',
  platform_admin_added: 'Admin added',
  platform_admin_revoked: 'Admin revoked',
  platform_financials_updated: 'Economics inputs updated',
};

function humanizeAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ');
}

type EventFilter = 'all' | 'invites' | 'admins' | 'admission';

const EVENT_FILTER_MATCH: Record<EventFilter, (action: string) => boolean> = {
  all: () => true,
  invites: (action) => action.startsWith('platform_invite_'),
  admins: (action) => action.startsWith('platform_admin_'),
  admission: (action) => action === 'admission_mode_changed',
};

function AuditPanel({
  events,
  onOpen,
}: {
  events: AdminEventRow[];
  onOpen: (row: AdminEventRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EventFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = EVENT_FILTER_MATCH[filter];
    return events.filter((row) => {
      if (!match(row.action)) return false;
      if (!q) return true;
      return (
        humanizeAction(row.action).toLowerCase().includes(q) ||
        (row.admin_email ?? '').toLowerCase().includes(q) ||
        row.target_type.toLowerCase().includes(q)
      );
    });
  }, [events, query, filter]);

  const counts: Record<EventFilter, number> = {
    all: events.length,
    invites: events.filter((e) => EVENT_FILTER_MATCH.invites(e.action)).length,
    admins: events.filter((e) => EVENT_FILTER_MATCH.admins(e.action)).length,
    admission: events.filter((e) => EVENT_FILTER_MATCH.admission(e.action)).length,
  };

  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.panelKicker}>Audit trail</p>
          <h2 className={s.panelTitle}>Who changed what</h2>
        </div>
        <span className={s.countPill}>{formatNumber(events.length)} recent events</span>
      </div>

      <div className={s.filterBar}>
        <div className={s.searchWrap}>
          <SearchIcon />
          <input
            type="search"
            className={s.searchInput}
            placeholder="Search by action or admin"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search audit trail"
          />
        </div>
        <div className={s.chipRow} role="group" aria-label="Filter audit events">
          {(['all', 'invites', 'admins', 'admission'] as EventFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${s.chip} ${filter === key ? s.chipActive : ''}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {EVENT_FILTER_LABELS[key]} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>Target</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={4} label={events.length === 0 ? 'No admin events yet.' : 'No events match this filter.'} />
            ) : (
              filtered.map((event) => (
                <tr key={event.id}>
                  <td>
                    <button type="button" className={a.rowButton} onClick={() => onOpen(event)}>
                      <span className={a.rowButtonLabel}>{humanizeAction(event.action)}</span>
                    </button>
                  </td>
                  <td className={s.muted}>{event.admin_email ?? 'unknown'}</td>
                  <td className={s.muted}>{event.target_type.replace(/_/g, ' ')}</td>
                  <td title={formatDateTime(event.created_at)}>{relativeTime(event.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const EVENT_FILTER_LABELS: Record<EventFilter, string> = {
  all: 'All',
  invites: 'Invites',
  admins: 'Admins',
  admission: 'Admission',
};

// ── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  selection,
  isOwner,
  selfEmail,
  activeOwnerCount,
  onClose,
}: {
  selection: Selection;
  isOwner: boolean;
  selfEmail: string;
  activeOwnerCount: number;
  onClose: () => void;
}) {
  if (!selection) {
    return null;
  }

  if (selection.kind === 'invite') {
    return <InviteDrawer invite={selection.row} onClose={onClose} />;
  }
  if (selection.kind === 'admin') {
    return (
      <AdminDrawer
        entry={selection.row}
        isOwner={isOwner}
        selfEmail={selfEmail}
        activeOwnerCount={activeOwnerCount}
        onClose={onClose}
      />
    );
  }
  return <EventDrawer event={selection.row} onClose={onClose} />;
}

function InviteDrawer({ invite, onClose }: { invite: PlatformInviteRow; onClose: () => void }) {
  const expired = isExpired(invite.expires_at);
  return (
    <Drawer open onClose={onClose} title={invite.email} eyebrow="Beta invite">
      <DrawerSection>
        {invite.status === 'approved' && !expired ? (
          <WhyNow tone="verdict">
            This address is cleared to create an account. They can sign up even while the platform is invite-only.
          </WhyNow>
        ) : invite.status === 'approved' && expired ? (
          <WhyNow tone="gap">
            This invite has passed its expiry date. The address may no longer be able to sign up. Re-approve to extend it.
          </WhyNow>
        ) : (
          <WhyNow tone="gap">This invite was revoked. The address cannot create an account.</WhyNow>
        )}
      </DrawerSection>

      <DrawerSection title="Invite">
        <DetailRow label="Status">
          <InviteStatusBadge status={invite.status} />
        </DetailRow>
        <DetailRow label="Source">{invite.source ?? 'admin'}</DetailRow>
        <DetailRow label="Approved">{formatDateTime(invite.created_at)}</DetailRow>
        <DetailRow label="Last updated">{formatDateTime(invite.updated_at)}</DetailRow>
        <DetailRow label="Expiry">{expiryLabel(invite.expires_at)}</DetailRow>
        <DetailRow label="Invite ID">
          <span className={s.mono}>{shortId(invite.id)}</span>
        </DetailRow>
      </DrawerSection>

      {invite.notes ? (
        <DrawerSection title="Notes">
          <p className={s.feedText}>{invite.notes}</p>
        </DrawerSection>
      ) : null}

      {invite.status === 'approved' ? (
        <DrawerSection title="Action">
          <form action={revokeInviteAction}>
            <input type="hidden" name="inviteId" value={invite.id} />
            <button type="submit" className={s.secondaryBtn}>
              Revoke this invite
            </button>
          </form>
        </DrawerSection>
      ) : null}
    </Drawer>
  );
}

function AdminDrawer({
  entry,
  isOwner,
  selfEmail,
  activeOwnerCount,
  onClose,
}: {
  entry: PlatformAdminListRow;
  isOwner: boolean;
  selfEmail: string;
  activeOwnerCount: number;
  onClose: () => void;
}) {
  const isSelf = entry.email.trim().toLowerCase() === selfEmail;
  const wouldStrandOwners = entry.role === 'owner' && entry.status === 'active' && activeOwnerCount <= 1;
  const canRevoke = isOwner && entry.status === 'active' && !isSelf && !wouldStrandOwners;

  return (
    <Drawer open onClose={onClose} title={entry.email} eyebrow="Console admin">
      <DrawerSection>
        {entry.role === 'owner' ? (
          <WhyNow tone="verdict">
            Owners can manage admins and flip admission mode. Keep at least two so no single account can lock everyone out.
          </WhyNow>
        ) : (
          <WhyNow>Admins see the full console but cannot manage access or change admission mode.</WhyNow>
        )}
      </DrawerSection>

      <DrawerSection title="Access">
        <DetailRow label="Role">
          {entry.role === 'owner' ? <Badge tone="verdict">Owner</Badge> : <Badge tone="neutral">Admin</Badge>}
        </DetailRow>
        <DetailRow label="Status">
          {entry.status === 'active' ? <Badge tone="neutral" dot>Active</Badge> : <Badge tone="muted">Revoked</Badge>}
        </DetailRow>
        <DetailRow label="Last seen">
          {entry.last_seen_at ? formatDateTime(entry.last_seen_at) : 'Not seen yet'}
        </DetailRow>
        <DetailRow label="Added">{formatDateShort(entry.created_at)}</DetailRow>
        {isSelf ? <DetailRow label="Note">This is you.</DetailRow> : null}
      </DrawerSection>

      {isOwner ? (
        <DrawerSection title="Action">
          {canRevoke ? (
            <form action={revokeAdminAction}>
              <input type="hidden" name="email" value={entry.email} />
              <button type="submit" className={s.secondaryBtn}>
                Revoke console access
              </button>
            </form>
          ) : (
            <p className={a.inlineEmpty}>
              {isSelf
                ? 'You cannot revoke your own access from here.'
                : wouldStrandOwners
                  ? 'This is the last active owner and cannot be revoked.'
                  : entry.status !== 'active'
                    ? 'This admin is already revoked.'
                    : 'No action available.'}
            </p>
          )}
        </DrawerSection>
      ) : null}
    </Drawer>
  );
}

function EventDrawer({ event, onClose }: { event: AdminEventRow; onClose: () => void }) {
  const metaEntries = event.metadata
    ? Object.entries(event.metadata).filter(([key]) => key !== 'schema_version')
    : [];

  return (
    <Drawer open onClose={onClose} title={humanizeAction(event.action)} eyebrow="Audit event">
      <DrawerSection>
        <WhyNow>
          {event.admin_email ?? 'An admin'} performed this action {relativeTime(event.created_at)}.
        </WhyNow>
      </DrawerSection>

      <DrawerSection title="Event">
        <DetailRow label="Action">{humanizeAction(event.action)}</DetailRow>
        <DetailRow label="By">{event.admin_email ?? 'unknown'}</DetailRow>
        <DetailRow label="Target type">{event.target_type.replace(/_/g, ' ')}</DetailRow>
        {event.target_id ? (
          <DetailRow label="Target ID">
            <span className={s.mono}>{shortId(event.target_id)}</span>
          </DetailRow>
        ) : null}
        <DetailRow label="When">{formatDateTime(event.created_at)}</DetailRow>
      </DrawerSection>

      <DrawerSection title="Details">
        {metaEntries.length === 0 ? (
          <p className={a.inlineEmpty}>No additional details captured for this event.</p>
        ) : (
          <div className={a.metaList}>
            {metaEntries.map(([key, value]) => (
              <div key={key} className={a.metaPair}>
                <span className={a.metaKey}>{key}</span>
                <span>{formatMetaValue(value)}</span>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>
    </Drawer>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now();
}

function expiryLabel(iso: string | null): string {
  if (!iso) return 'No expiry';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'No expiry';
  return t < Date.now() ? `Expired ${formatDateShort(iso)}` : `Expires ${formatDateShort(iso)}`;
}

function formatMetaValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
