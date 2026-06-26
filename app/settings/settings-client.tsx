'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERSONA_OPTIONS } from '@/lib/guidance';
import { disconnectStripeAction } from '@/lib/stripe/actions';
import { disconnectSlackAction } from '@/lib/slack/actions';
import { signOutAction } from '@/lib/auth/actions';
import {
  updateBusinessAction,
  updatePoliciesAction,
  updateSubmissionOptInAction,
  updateNameAction,
  updateEmailAction,
  updatePasswordAction,
  requestAccountDeletionAction,
  type SettingsState,
} from './actions';
import s from './settings.module.css';

// ── Shared message line ──────────────────────────────────────────────────────

function FormMessage({ state }: { state: SettingsState }) {
  if (state?.error) {
    return (
      <p className={`${s.formMsg} ${s.formMsgError}`} role="alert">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p className={`${s.formMsg} ${s.formMsgOk}`} role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

// ── Settings tablist (URL-as-state + roving arrow-key focus) ─────────────────
// Tabs stay anchor-based so the active section lives in the URL (?tab=…), which
// keeps deep-links and the back button working. On top of that we layer the
// WAI-ARIA tabs pattern: role=tablist/tab, aria-selected, roving tabIndex (only
// the active tab is in the tab order), and Arrow/Home/End to move between tabs.

type SettingsTab = { key: 'integrations' | 'business' | 'account'; label: string };

export function SettingsTabs({
  tabs,
  activeTab,
}: {
  tabs: ReadonlyArray<SettingsTab>;
  activeTab: SettingsTab['key'];
}) {
  const router = useRouter();
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);

  function focusTab(index: number) {
    const next = ((index % tabs.length) + tabs.length) % tabs.length;
    const tab = tabs[next];
    refs.current[next]?.focus();
    // Match the comp: arrow keys move selection, not just focus.
    router.push(`/settings?tab=${tab.key}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={s.tabs} role="tablist" aria-label="Settings sections">
      {tabs.map((tab, index) => {
        const selected = activeTab === tab.key;
        return (
          <a
            key={tab.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={`settings-tab-${tab.key}`}
            href={`/settings?tab=${tab.key}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`settings-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            className={`${s.tab} ${selected ? s.tabActive : ''}`}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}

// ── Business form ────────────────────────────────────────────────────────────

export type BusinessInitial = {
  businessName: string;
  productDescription: string;
  deliveryMethod: string;
  customerType: string;
  persona: string;
};

export function BusinessForm({ initial }: { initial: BusinessInitial }) {
  const [state, formAction, pending] = useActionState(updateBusinessAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <div className={s.field}>
        <label className={s.label} htmlFor="businessName">
          Workspace name
        </label>
        <input
          id="businessName"
          name="businessName"
          className={s.input}
          defaultValue={initial.businessName}
          placeholder="Acme Inc."
        />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="productDescription">
          What you sell
        </label>
        <textarea
          id="productDescription"
          name="productDescription"
          className={s.textarea}
          defaultValue={initial.productDescription}
          placeholder="A short description of your product or service. Verdact uses this to frame evidence."
        />
      </div>

      <div className={s.fieldRow}>
        <div className={s.field}>
          <label className={s.label} htmlFor="deliveryMethod">
            How you deliver
          </label>
          <select
            id="deliveryMethod"
            name="deliveryMethod"
            className={s.select}
            defaultValue={initial.deliveryMethod}
          >
            <option value="">Select…</option>
            <option value="app">In-app access</option>
            <option value="email">Email</option>
            <option value="download">Download</option>
            <option value="combination">A combination</option>
          </select>
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor="customerType">
            Who you sell to
          </label>
          <select
            id="customerType"
            name="customerType"
            className={s.select}
            defaultValue={initial.customerType}
          >
            <option value="">Select…</option>
            <option value="b2b">Businesses (B2B)</option>
            <option value="b2c">Consumers (B2C)</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="persona">
          Which best describes your business?
        </label>
        <select id="persona" name="persona" className={s.select} defaultValue={initial.persona}>
          <option value="">Prefer not to say</option>
          {PERSONA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={s.hint}>Tailors which tips Verdact surfaces on your dashboard.</span>
      </div>

      <div className={s.actions}>
        <button type="submit" className={s.saveBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Save business details'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ── Policies form ────────────────────────────────────────────────────────────

export type PoliciesInitial = {
  refundPolicyText: string;
  refundPolicyUrl: string;
  cancellationPolicyText: string;
  cancellationPolicyUrl: string;
  tosUrl: string;
  policyDisclosureLocation: string;
  transactionDescriptionTemplate: string;
  logsUserActivity: string;
};

export function PoliciesForm({ initial }: { initial: PoliciesInitial }) {
  const [state, formAction, pending] = useActionState(updatePoliciesAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <div className={s.field}>
        <label className={s.label} htmlFor="refundPolicyText">
          Refund policy
        </label>
        <textarea
          id="refundPolicyText"
          name="refundPolicyText"
          className={s.textarea}
          defaultValue={initial.refundPolicyText}
          placeholder="Paste your refund policy text, or link it below."
        />
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor="refundPolicyUrl">
          Refund policy URL
        </label>
        <input
          id="refundPolicyUrl"
          name="refundPolicyUrl"
          className={s.input}
          defaultValue={initial.refundPolicyUrl}
          placeholder="https://…"
        />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="cancellationPolicyText">
          Cancellation policy
        </label>
        <textarea
          id="cancellationPolicyText"
          name="cancellationPolicyText"
          className={s.textarea}
          defaultValue={initial.cancellationPolicyText}
          placeholder="Paste your cancellation policy text, or link it below."
        />
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor="cancellationPolicyUrl">
          Cancellation policy URL
        </label>
        <input
          id="cancellationPolicyUrl"
          name="cancellationPolicyUrl"
          className={s.input}
          defaultValue={initial.cancellationPolicyUrl}
          placeholder="https://…"
        />
      </div>

      <div className={s.fieldRow}>
        <div className={s.field}>
          <label className={s.label} htmlFor="tosUrl">
            Terms of service URL
          </label>
          <input
            id="tosUrl"
            name="tosUrl"
            className={s.input}
            defaultValue={initial.tosUrl}
            placeholder="https://…"
          />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="policyDisclosureLocation">
            Where customers see your policies
          </label>
          <select
            id="policyDisclosureLocation"
            name="policyDisclosureLocation"
            className={s.select}
            defaultValue={initial.policyDisclosureLocation}
          >
            <option value="">Select…</option>
            <option value="checkout">At checkout</option>
            <option value="email">In email</option>
            <option value="in_app">In the app</option>
            <option value="all">All of the above</option>
          </select>
        </div>
      </div>

      <div className={s.fieldRow}>
        <div className={s.field}>
          <label className={s.label} htmlFor="transactionDescriptionTemplate">
            Statement descriptor
          </label>
          <input
            id="transactionDescriptionTemplate"
            name="transactionDescriptionTemplate"
            className={s.input}
            defaultValue={initial.transactionDescriptionTemplate}
            placeholder="What customers see on their card statement"
          />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="logsUserActivity">
            Do you log customer activity?
          </label>
          <select
            id="logsUserActivity"
            name="logsUserActivity"
            className={s.select}
            defaultValue={initial.logsUserActivity}
          >
            <option value="">Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="sometimes">Sometimes</option>
          </select>
          <span className={s.hint}>Usage logs are strong evidence for service-delivery disputes.</span>
        </div>
      </div>

      <div className={s.actions}>
        <button type="submit" className={s.saveBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Save policies'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// ── Filing opt-in (authorize Verdact to file approved evidence to Stripe) ─────
// Go-live prerequisite: the submit engine fail-closes unless this is true. It is
// inert during beta (the global kill switch short-circuits first), but the
// merchant can set their preference now. Owner/admin only.

export function FilingForm({ optedIn, canManage }: { optedIn: boolean; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(updateSubmissionOptInAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <label className={s.toggleRow}>
        <input
          type="checkbox"
          name="submissionOptIn"
          defaultChecked={optedIn}
          disabled={!canManage}
          className={s.toggleCheckbox}
        />
        <span className={s.toggleLabel}>Let Verdact file approved evidence to Stripe on my behalf</span>
      </label>
      <p className={s.hint}>
        Off by default. Even when on, nothing is ever filed without your explicit review and sign-off.
        Filing to Stripe is not active during the beta, so this only takes effect once live filing opens.
      </p>
      {canManage ? (
        <div className={s.actions}>
          <button type="submit" className={s.saveBtn} disabled={pending}>
            {pending ? 'Saving…' : 'Save filing preference'}
          </button>
          <FormMessage state={state} />
        </div>
      ) : (
        <p className={s.hint}>Only an owner or admin can change this.</p>
      )}
    </form>
  );
}

// ── Account: your name + email + password ────────────────────────────────────

export function NameForm({ fullName }: { fullName: string }) {
  const [state, formAction, pending] = useActionState(updateNameAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <div className={s.field}>
        <label className={s.label} htmlFor="fullName">
          Your name
        </label>
        <input
          id="fullName"
          name="fullName"
          className={s.input}
          defaultValue={fullName}
          autoComplete="name"
          placeholder="Alex Rivera"
        />
        <span className={s.hint}>How Verdact greets you. This is your name, not your company name.</span>
      </div>
      <div className={s.actions}>
        <button type="submit" className={s.saveBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Save name'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updateEmailAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <div className={s.field}>
        <label className={s.label} htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className={s.input}
          defaultValue={email}
          autoComplete="email"
        />
        <span className={s.hint}>Changing this sends a confirmation link to both addresses.</span>
      </div>
      <div className={s.actions}>
        <button type="submit" className={s.saveBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Update email'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, undefined);

  return (
    <form action={formAction} className={s.form}>
      <div className={s.fieldRow}>
        <div className={s.field}>
          <label className={s.label} htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={s.input}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className={s.input}
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className={s.actions}>
        <button type="submit" className={s.saveBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Update password'}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction} className={s.signOutForm}>
      <button type="submit" className={s.signOutBtn}>
        Sign out
      </button>
    </form>
  );
}

// ── Disconnect Stripe (destructive confirm dialog — Decision #13) ─────────────

export function DisconnectStripe({ accountLabel }: { accountLabel: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className={s.linkBtn} onClick={() => ref.current?.showModal()}>
        Disconnect
      </button>

      <dialog ref={ref} className={s.dialog} aria-labelledby="disconnect-title">
        <div className={s.dialogInner}>
          <h2 id="disconnect-title" className={s.dialogTitle}>
            Disconnect Stripe?
          </h2>
          <p className={s.dialogText}>
            Verdact will stop watching {accountLabel ? `account ${accountLabel}` : 'this account'} for
            new disputes and early fraud warnings, and your account-health reading will pause. Your
            existing dispute history stays in Verdact. You can reconnect any time.
          </p>
          <div className={s.dialogActions}>
            <button type="button" className={s.dialogCancel} onClick={() => ref.current?.close()}>
              Keep connected
            </button>
            <form action={disconnectStripeAction}>
              <button type="submit" className={s.dialogConfirm}>
                Disconnect Stripe
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ── Disconnect Slack (destructive confirm dialog) ────────────────────────────

export function DisconnectSlack({ workspaceLabel }: { workspaceLabel: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className={s.linkBtn} onClick={() => ref.current?.showModal()}>
        Disconnect
      </button>

      <dialog ref={ref} className={s.dialog} aria-labelledby="disconnect-slack-title">
        <div className={s.dialogInner}>
          <h2 id="disconnect-slack-title" className={s.dialogTitle}>
            Disconnect Slack?
          </h2>
          <p className={s.dialogText}>
            Verdact will forget {workspaceLabel ? `the ${workspaceLabel} workspace` : 'this workspace'}{' '}
            and revoke its access token. Messages you already imported stay on your disputes. You can
            reconnect any time.
          </p>
          <div className={s.dialogActions}>
            <button type="button" className={s.dialogCancel} onClick={() => ref.current?.close()}>
              Keep connected
            </button>
            <form action={disconnectSlackAction}>
              <button type="submit" className={s.dialogConfirm}>
                Disconnect Slack
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ── Danger zone: deletion request (type DELETE to confirm) ───────────────────

export function DeleteAccount() {
  const [state, formAction, pending] = useActionState(requestAccountDeletionAction, undefined);
  const [open, setOpen] = useState(false);

  if (state?.ok) {
    return (
      <p className={`${s.formMsg} ${s.formMsgOk}`} role="status">
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className={s.dangerBtn} onClick={() => setOpen(true)}>
        Request account deletion
      </button>
    );
  }

  return (
    <form action={formAction} className={s.form}>
      <div className={s.field}>
        <label className={s.label} htmlFor="confirm">
          Type DELETE to confirm your request
        </label>
        <input id="confirm" name="confirm" className={s.input} placeholder="DELETE" autoComplete="off" />
      </div>
      <div className={s.actions}>
        <button type="submit" className={s.dangerBtn} disabled={pending}>
          {pending ? 'Sending…' : 'Send deletion request'}
        </button>
        <button type="button" className={s.dialogCancel} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
