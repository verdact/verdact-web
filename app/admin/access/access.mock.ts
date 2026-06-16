import type { AccessData } from '@/lib/admin/queries';

// ─────────────────────────────────────────────────────────────────────────────
// Sample data for the dev preview of the Access cockpit. No DB, no 'server-only'
// — pure fixture so the view renders without an authenticated founder session.
// Numbers are illustrative, not real platform metrics.
// ─────────────────────────────────────────────────────────────────────────────

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

const hoursAgo = (n: number): string => {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - n);
  return d.toISOString();
};

export const MOCK_ACCESS: AccessData = {
  admin: {
    userId: 'preview',
    email: 'rishi@verdact.io',
    emailNormalized: 'rishi@verdact.io',
    role: 'owner',
    source: 'database',
  },
  policy: { mode: 'invite_only', updated_at: daysAgo(4), updated_by: null },
  invitesApproved: 22,
  invites: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'founder@acme.dev',
      status: 'approved',
      source: 'admin',
      notes: 'LinkedIn warm lead, runs a B2B SaaS doing ~$40k/mo.',
      expires_at: daysAgo(-26),
      created_at: hoursAgo(20),
      updated_at: hoursAgo(20),
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'ops@northwind.io',
      status: 'approved',
      source: 'audit',
      notes: 'Converted from audit lead, getting close on VAMP.',
      expires_at: null,
      created_at: daysAgo(2),
      updated_at: daysAgo(2),
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'cadence@example.com',
      status: 'approved',
      source: 'admin',
      notes: null,
      expires_at: daysAgo(2),
      created_at: daysAgo(34),
      updated_at: daysAgo(30),
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'old@example.com',
      status: 'revoked',
      source: 'admin',
      notes: 'Bounced twice, no longer pursuing.',
      expires_at: null,
      created_at: daysAgo(12),
      updated_at: daysAgo(3),
    },
  ],
  admins: [
    {
      email: 'rishi@verdact.io',
      role: 'owner',
      status: 'active',
      last_seen_at: hoursAgo(1),
      created_at: daysAgo(40),
    },
    {
      email: 'cofounder@verdact.io',
      role: 'owner',
      status: 'active',
      last_seen_at: daysAgo(3),
      created_at: daysAgo(38),
    },
    {
      email: 'ops@verdact.io',
      role: 'admin',
      status: 'active',
      last_seen_at: null,
      created_at: daysAgo(6),
    },
    {
      email: 'former@verdact.io',
      role: 'admin',
      status: 'revoked',
      last_seen_at: daysAgo(15),
      created_at: daysAgo(30),
    },
  ],
  events: [
    {
      id: 'e1',
      admin_email: 'rishi@verdact.io',
      action: 'platform_invite_approved',
      target_type: 'platform_invite',
      target_id: '11111111-1111-4111-8111-111111111111',
      metadata: { email: 'founder@acme.dev' },
      created_at: hoursAgo(20),
    },
    {
      id: 'e2',
      admin_email: 'cofounder@verdact.io',
      action: 'platform_admin_added',
      target_type: 'platform_admin',
      target_id: '99999999-9999-4999-8999-999999999999',
      metadata: { email: 'ops@verdact.io', role: 'admin' },
      created_at: daysAgo(6),
    },
    {
      id: 'e3',
      admin_email: 'rishi@verdact.io',
      action: 'platform_invite_revoked',
      target_type: 'platform_invite',
      target_id: '44444444-4444-4444-8444-444444444444',
      metadata: { email: 'old@example.com' },
      created_at: daysAgo(3),
    },
    {
      id: 'e4',
      admin_email: 'rishi@verdact.io',
      action: 'admission_mode_changed',
      target_type: 'platform_admission_policy',
      target_id: 'singleton',
      metadata: { mode: 'invite_only' },
      created_at: daysAgo(4),
    },
    {
      id: 'e5',
      admin_email: 'rishi@verdact.io',
      action: 'platform_financials_updated',
      target_type: 'platform_financials',
      target_id: null,
      metadata: null,
      created_at: daysAgo(8),
    },
  ],
};
