'use client';

import { useActionState, useRef, useState } from 'react';
import { disconnectStripeAction } from '@/lib/stripe/actions';
import { signOutAction } from '@/lib/auth/actions';
import {
  updateBusinessAction,
  updatePoliciesAction,
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

// ── Business form ────────────────────────────────────────────────────────────

export type BusinessInitial = {
  businessName: string;
  productDescription: string;
  deliveryMethod: string;
  customerType: string;
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
