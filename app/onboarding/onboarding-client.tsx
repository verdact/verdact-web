'use client';

import { useActionState, useState } from 'react';
import { PERSONA_OPTIONS } from '@/lib/guidance';
import {
  saveOnboardingBasicsAction,
  savePersonaAction,
  completeOnboardingAction,
  type OnboardingState,
} from './actions';
import s from './onboarding.module.css';

type Step = 'welcome' | 'persona' | 'basics' | 'stripe' | 'finish';

const STEP_ORDER: Step[] = ['welcome', 'persona', 'basics', 'stripe', 'finish'];

const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  persona: 'About you',
  basics: 'Your details',
  stripe: 'Connect Stripe',
  finish: 'All set',
};

export type OnboardingClientProps = {
  initialFullName: string;
  initialBusinessName: string;
  stripeConnected: boolean;
};

export function OnboardingClient({
  initialFullName,
  initialBusinessName,
  stripeConnected,
}: OnboardingClientProps) {
  // If the user already connected Stripe (came back from the OAuth round-trip),
  // start them on the finish step so the moment is acknowledged.
  const [step, setStep] = useState<Step>(stripeConnected ? 'finish' : 'welcome');

  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <span className={s.brand}>Verdact</span>
        <SkipButton />
      </header>

      <main className={s.main} id="main" tabIndex={-1}>
        <ol className={s.ledger} aria-label="Setup progress">
          {STEP_ORDER.map((key, i) => (
            <li
              key={key}
              className={`${s.ledgerStep} ${i === currentIndex ? s.ledgerCurrent : ''} ${
                i < currentIndex ? s.ledgerDone : ''
              }`}
              aria-current={i === currentIndex ? 'step' : undefined}
            >
              <span className={s.ledgerNum}>{i + 1}</span>
              <span className={s.ledgerLabel}>{STEP_LABELS[key]}</span>
            </li>
          ))}
        </ol>

        <section className={s.panel}>
          {step === 'welcome' ? <WelcomeStep onNext={() => setStep('persona')} /> : null}
          {step === 'persona' ? <PersonaStep onNext={() => setStep('basics')} /> : null}
          {step === 'basics' ? (
            <BasicsStep
              initialFullName={initialFullName}
              initialBusinessName={initialBusinessName}
              onNext={() => setStep('stripe')}
            />
          ) : null}
          {step === 'stripe' ? (
            <StripeStep stripeConnected={stripeConnected} onSkip={() => setStep('finish')} />
          ) : null}
          {step === 'finish' ? <FinishStep stripeConnected={stripeConnected} /> : null}
        </section>
      </main>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className={s.step}>
      <h1 className={s.stepTitle}>Set up your dispute workbench</h1>
      <p className={s.stepBody}>
        Verdact uses your business context and Stripe data to assemble stronger dispute records. You
        can add missing policies or proof later when a case needs them.
      </p>
      <ul className={s.facts}>
        <li className={s.fact}>A few quick steps</li>
        <li className={s.fact}>Stripe is the only connection in setup</li>
        <li className={s.fact}>You approve before anything is filed</li>
      </ul>
      <div className={s.actions}>
        <button type="button" className={s.primaryBtn} onClick={onNext}>
          Start setup
        </button>
      </div>
    </div>
  );
}

function PersonaStep({ onNext }: { onNext: () => void }) {
  // Ask-only persona: each option is a submit button carrying its id; skipping
  // advances without saving (persona stays null → generic guidance ranking).
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    async (prev, formData) => {
      const result = await savePersonaAction(prev, formData);
      if (result?.ok) onNext();
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className={s.step}>
      <h1 className={s.stepTitle}>Which best describes your business?</h1>
      <p className={s.stepBody}>
        This tailors the tips Verdact shows you. You can skip it — and change it later in Settings.
      </p>

      {state?.error ? (
        <p className={`${s.formMsg} ${s.formMsgError}`} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={s.personaGrid}>
        {PERSONA_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="submit"
            name="persona"
            value={option.id}
            className={s.personaCard}
            disabled={pending}
          >
            <span className={s.personaLabel}>{option.label}</span>
            <span className={s.personaHint}>{option.hint}</span>
          </button>
        ))}
      </div>

      <div className={s.actions}>
        <button type="button" className={s.secondaryBtn} onClick={onNext} disabled={pending}>
          Skip this question
        </button>
      </div>
    </form>
  );
}

function BasicsStep({
  initialFullName,
  initialBusinessName,
  onNext,
}: {
  initialFullName: string;
  initialBusinessName: string;
  onNext: () => void;
}) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    async (prev, formData) => {
      const result = await saveOnboardingBasicsAction(prev, formData);
      if (result?.ok) onNext();
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className={s.step}>
      <h1 className={s.stepTitle}>Tell Verdact who you are</h1>
      <p className={s.stepBody}>
        Your name is how Verdact greets you. Your business name labels the workspace and your
        evidence records.
      </p>

      {state?.error ? (
        <p className={`${s.formMsg} ${s.formMsgError}`} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={s.field}>
        <label className={s.label} htmlFor="onb-name">
          Your name
        </label>
        <input
          id="onb-name"
          name="fullName"
          className={s.input}
          defaultValue={initialFullName}
          autoComplete="name"
          placeholder="Alex Rivera"
          required
        />
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor="onb-business">
          Business name
        </label>
        <input
          id="onb-business"
          name="businessName"
          className={s.input}
          defaultValue={initialBusinessName}
          autoComplete="organization"
          placeholder="Northstar Studio"
          required
        />
      </div>

      <div className={s.actions}>
        <button type="submit" className={s.primaryBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
    </form>
  );
}

function StripeStep({
  stripeConnected,
  onSkip,
}: {
  stripeConnected: boolean;
  onSkip: () => void;
}) {
  return (
    <div className={s.step}>
      <h1 className={s.stepTitle}>Connect Stripe</h1>
      <p className={s.stepBody}>
        Verdact uses your Stripe dispute, charge, and early-fraud-warning data to show what needs
        action and to assemble the record you review. This is the activation moment, everything
        populates from here.
      </p>
      <ul className={s.scopeList}>
        <li className={s.scopeItem}>Stores your connected account ID, not your Stripe password.</li>
        <li className={s.scopeItem}>Uses Verdact’s platform key for your account. No API keys are kept.</li>
        <li className={s.scopeItem}>You can disconnect later from Settings.</li>
        <li className={s.scopeItem}>Nothing is filed without your approval.</li>
      </ul>

      {stripeConnected ? (
        <p className={s.connectedNote}>Stripe is connected. You can move on.</p>
      ) : null}

      <div className={s.actions}>
        <a href="/api/stripe/connect/start" className={s.primaryBtn}>
          {stripeConnected ? 'Reconnect Stripe' : 'Connect Stripe'}
        </a>
        <button type="button" className={s.secondaryBtn} onClick={onSkip}>
          {stripeConnected ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}

function FinishStep({ stripeConnected }: { stripeConnected: boolean }) {
  return (
    <form action={completeOnboardingAction} className={s.step}>
      <h1 className={s.stepTitle}>You’re set up</h1>
      <p className={s.stepBody}>
        {stripeConnected
          ? 'Stripe is connected and Verdact is watching your account. Your first account-health reading is on its way.'
          : 'Your workspace is ready. Connect Stripe from the dashboard whenever you want Verdact to start watching disputes and account health.'}
      </p>
      <div className={s.actions}>
        <button type="submit" className={s.primaryBtn}>
          Go to dashboard
        </button>
      </div>
    </form>
  );
}

// ── Skip for now (top bar) ───────────────────────────────────────────────────

function SkipButton() {
  // "Skip for now" marks onboarding complete so the dashboard gate stops
  // redirecting here. Nobody gets trapped in the wizard.
  return (
    <form action={completeOnboardingAction}>
      <button type="submit" className={s.skipBtn}>
        Skip for now
      </button>
    </form>
  );
}
