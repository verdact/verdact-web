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
  initialError?: string;
};

export function OnboardingClient({
  initialFullName,
  initialBusinessName,
  stripeConnected,
  initialError,
}: OnboardingClientProps) {
  // If the user already connected Stripe (came back from the OAuth round-trip),
  // start them on the finish step so the moment is acknowledged.
  const [step, setStep] = useState<Step>(stripeConnected ? 'finish' : 'welcome');

  const currentIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            V
          </span>
          Verdact
        </span>
        <SkipButton />
      </header>

      <main className={s.main} id="main" tabIndex={-1}>
        <div className={`${s.wiz} ${s.rise}`}>
          {initialError ? (
            <p className={`${s.formMsg} ${s.formMsgError} ${s.pageError}`} role="alert">
              {initialError}
            </p>
          ) : null}

          <ol className={s.prog} aria-label="Setup progress">
            {STEP_ORDER.map((key, i) => (
              <li
                key={key}
                className={`${s.progStep} ${i === currentIndex ? s.progCurrent : ''} ${
                  i < currentIndex ? s.progDone : ''
                }`}
                aria-current={i === currentIndex ? 'step' : undefined}
              >
                <span className="sr-only">
                  {`Step ${i + 1}: ${STEP_LABELS[key]}${
                    i < currentIndex ? ', done' : i === currentIndex ? ', current step' : ''
                  }`}
                </span>
              </li>
            ))}
          </ol>

          {step === 'welcome' ? (
            <WelcomeStep
              stepNumber={currentIndex + 1}
              totalSteps={totalSteps}
              onNext={() => setStep('persona')}
            />
          ) : null}
          {step === 'persona' ? (
            <PersonaStep
              stepNumber={currentIndex + 1}
              totalSteps={totalSteps}
              onNext={() => setStep('basics')}
            />
          ) : null}
          {step === 'basics' ? (
            <BasicsStep
              stepNumber={currentIndex + 1}
              totalSteps={totalSteps}
              initialFullName={initialFullName}
              initialBusinessName={initialBusinessName}
              onNext={() => setStep('stripe')}
            />
          ) : null}
          {step === 'stripe' ? (
            <StripeStep
              stepNumber={currentIndex + 1}
              totalSteps={totalSteps}
              stripeConnected={stripeConnected}
              onSkip={() => setStep('finish')}
            />
          ) : null}
          {step === 'finish' ? (
            <FinishStep
              stepNumber={currentIndex + 1}
              totalSteps={totalSteps}
              stripeConnected={stripeConnected}
            />
          ) : null}
        </div>
      </main>

      <footer className={s.foot}>
        <span>Verdact: merchant-controlled dispute defense</span>
        <span className={s.footLinks}>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:support@verdact.io">support@verdact.io</a>
        </span>
      </footer>
    </div>
  );
}

// ── Shared step header ─────────────────────────────────────────────────────────

type StepMeta = { stepNumber: number; totalSteps: number };

function StepEyebrow({ stepNumber, totalSteps }: StepMeta) {
  return (
    <p className={s.eyebrow}>{`Step ${stepNumber} of ${totalSteps}`}</p>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function WelcomeStep({ stepNumber, totalSteps, onNext }: StepMeta & { onNext: () => void }) {
  return (
    <div className={s.step}>
      <StepEyebrow stepNumber={stepNumber} totalSteps={totalSteps} />
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

function PersonaStep({ stepNumber, totalSteps, onNext }: StepMeta & { onNext: () => void }) {
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
      <StepEyebrow stepNumber={stepNumber} totalSteps={totalSteps} />
      <h1 className={s.stepTitle}>Which best describes your business?</h1>
      <p className={s.stepBody}>
        This tailors the tips Verdact shows you. You can skip it, and change it later in Settings.
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
  stepNumber,
  totalSteps,
  initialFullName,
  initialBusinessName,
  onNext,
}: StepMeta & {
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
      <StepEyebrow stepNumber={stepNumber} totalSteps={totalSteps} />
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
  stepNumber,
  totalSteps,
  stripeConnected,
  onSkip,
}: StepMeta & {
  stripeConnected: boolean;
  onSkip: () => void;
}) {
  return (
    <div className={s.step}>
      <StepEyebrow stepNumber={stepNumber} totalSteps={totalSteps} />
      <h1 className={s.stepTitle}>Connect Stripe to see your dispute rate</h1>
      <p className={s.stepBody}>
        This is how Verdact reads your disputes and account health. It takes about a minute, and
        everything populates from here.
      </p>

      <ul className={s.trust} aria-label="What to expect">
        <li className={s.trustRow}>
          <LockIcon />
          <span>
            We store your Stripe account ID only, never your keys, and never train on your data.
          </span>
        </li>
        <li className={s.trustRow}>
          <EyeIcon />
          <span>
            Read-only access to your Stripe account. Verdact advises, you decide, nothing is filed
            without you.
          </span>
        </li>
        <li className={s.trustRow}>
          <ShieldIcon />
          <span>You can disconnect later from Settings.</span>
        </li>
      </ul>

      {stripeConnected ? (
        <p className={s.connectedNote}>
          <CheckIcon />
          Stripe is connected. You can move on.
        </p>
      ) : null}

      <div className={s.actions}>
        <a href="/api/stripe/connect/start" className={s.primaryBtn}>
          <LinkIcon />
          {stripeConnected ? 'Reconnect Stripe' : 'Connect Stripe'}
        </a>
        <button type="button" className={s.skipLink} onClick={onSkip}>
          {stripeConnected ? 'Continue' : 'Skip for now, I will connect later'}
        </button>
      </div>
    </div>
  );
}

function FinishStep({
  stepNumber,
  totalSteps,
  stripeConnected,
}: StepMeta & { stripeConnected: boolean }) {
  return (
    <form action={completeOnboardingAction} className={s.step}>
      <StepEyebrow stepNumber={stepNumber} totalSteps={totalSteps} />
      <h1 className={s.stepTitle}>You are set up</h1>
      <p className={s.stepBody}>
        {stripeConnected
          ? 'Stripe is connected and Verdact is watching your account. Here is what Verdact is watching, your first account-health reading is on its way.'
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
        Skip setup
      </button>
    </form>
  );
}

// ── Icons (inline, decorative; rows carry the text label) ─────────────────────

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
    </svg>
  );
}
