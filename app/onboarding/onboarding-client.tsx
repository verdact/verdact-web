'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { PERSONA_OPTIONS } from '@/lib/guidance';
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  LockIcon,
  PlugIcon,
  ShieldIcon,
} from '@/app/dashboard/dash-icons';
import { ReassureCard } from '@/app/_components/ui/reassure-card';
import { StatusBadge } from '@/app/_components/ui/status-badge';
import {
  saveOnboardingBasicsAction,
  savePersonaAction,
  completeOnboardingAction,
  type OnboardingState,
} from './actions';
import s from './onboarding.module.css';

type Step = 'welcome' | 'persona' | 'basics' | 'stripe' | 'finish';

const STEP_ORDER: Step[] = ['welcome', 'persona', 'basics', 'stripe', 'finish'];

// Welcome is a calm cover, not a counted step. The four counted steps are the
// ones that actually do setup, so the visible count stays honest at "4".
const COUNTED_STEPS: Step[] = ['persona', 'basics', 'stripe', 'finish'];
const TOTAL_COUNTED = COUNTED_STEPS.length;

// Mono eyebrow that names each step's INTENT (verdict-colored), plus the short
// stepper caption label. Drives the single progress caption line.
const STEP_META: Record<Step, { eyebrow: string; caption: string; numeral: string }> = {
  welcome: { eyebrow: "Let's get you set up", caption: 'Welcome', numeral: '0' },
  persona: { eyebrow: 'Tailoring your tips', caption: 'About you', numeral: '1' },
  basics: { eyebrow: 'Your workspace', caption: 'Your details', numeral: '2' },
  stripe: { eyebrow: 'The one connection', caption: 'Connect Stripe', numeral: '3' },
  finish: { eyebrow: "You're ready", caption: 'All set', numeral: '4' },
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

  const countedIndex = COUNTED_STEPS.indexOf(step); // -1 on the welcome cover

  // a11y (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages): each step swap is a
  // full content change with no focus move and nothing announced. Move focus to
  // the step region on every step change so keyboard and screen-reader users
  // land on the new content. Focus alone (no smooth-scroll) is reduced-motion-safe.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [step]);

  return (
    // data-app-surface opts the setup flow into the app's theme tokens so it
    // follows the OS color scheme (and any stored Light/Dark choice) exactly
    // like the dashboard — instead of rendering hardcoded light. The setup flow
    // has no theme toggle by design; this only makes it honor system/stored
    // preference. Dark tokens are scoped to .app-shell / [data-app-surface] in
    // globals.css, so adding the hook here (without the .app-shell nav chrome)
    // is the minimal, correct fix.
    <div className={s.shell} data-app-surface>
      <header className={s.topbar}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            V
          </span>
          Verdact
        </span>
        <SkipButton />
      </header>

      <main className={s.main} id="main" tabIndex={-1} ref={mainRef}>
        <div className={`${s.wiz} ${s.rise}`}>
          {initialError ? (
            <div className={s.pageError} role="alert">
              <AlertIcon className={s.pageErrorIcon} />
              <span>{initialError}</span>
            </div>
          ) : null}

          {/* Labeled stepper: only shown once setup begins (Welcome is the cover). */}
          {countedIndex >= 0 ? (
            <Stepper currentStep={step} countedIndex={countedIndex} />
          ) : null}

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
        </div>
      </main>

      <footer className={s.foot}>
        <span>Verdact: dispute defense you control.</span>
        <span className={s.footLinks}>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:support@verdact.io">support@verdact.io</a>
        </span>
      </footer>
    </div>
  );
}

// ── Labeled stepper ────────────────────────────────────────────────────────────

function Stepper({ currentStep, countedIndex }: { currentStep: Step; countedIndex: number }) {
  const stepNumber = countedIndex + 1;
  const caption = STEP_META[currentStep].caption;

  return (
    <div className={s.stepper}>
      <ol className={s.prog} aria-label="Setup progress">
        {COUNTED_STEPS.map((key, i) => (
          <li
            key={key}
            className={`${s.progStep} ${i === countedIndex ? s.progCurrent : ''} ${
              i < countedIndex ? s.progDone : ''
            }`}
            aria-current={i === countedIndex ? 'step' : undefined}
          >
            <span className="sr-only">
              {`Step ${i + 1} of ${TOTAL_COUNTED}: ${STEP_META[key].caption}${
                i < countedIndex ? ', done' : i === countedIndex ? ', current step' : ''
              }`}
            </span>
          </li>
        ))}
      </ol>
      {/* Single shared caption line. aria-hidden: the sr-only <ol> above already
          announces position, so this avoids a double announcement. */}
      <p className={s.progCaption} aria-hidden="true">
        <span className={s.progCaptionNum}>{`Step ${stepNumber} of ${TOTAL_COUNTED}`}</span>
        <span className={s.progCaptionDot}>·</span>
        <span className={s.progCaptionName}>{caption}</span>
      </p>
    </div>
  );
}

// ── Shared step header ─────────────────────────────────────────────────────────

function StepHeader({
  step,
  title,
  children,
}: {
  step: Step;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.stepHead}>
      <span className={s.stepNumeral} aria-hidden="true">
        {STEP_META[step].numeral}
      </span>
      <div className={s.stepHeadText}>
        <p className={s.eyebrow}>{STEP_META[step].eyebrow}</p>
        <h1 className={s.stepTitle}>{title}</h1>
        <p className={s.stepBody}>{children}</p>
      </div>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className={`${s.step} ${s.stepWelcome}`}>
      <StepHeader step="welcome" title="Let's get Verdact watching your back">
        Four quick steps and Verdact starts watching your Stripe account for disputes. You can add
        anything you skip later, whenever a case needs it.
      </StepHeader>

      <div className={s.welcomeCard}>
        <ReassureCard icon={<ShieldIcon />} title="Verdact never files anything without your say-so.">
          You stay in control the whole way. Nothing goes to Stripe until you read it and approve it.
        </ReassureCard>
        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={onNext}>
            Start setup
          </button>
          <span className={s.actionAside}>Takes about a minute.</span>
        </div>
      </div>
    </div>
  );
}

function PersonaStep({ onNext }: { onNext: () => void }) {
  // Ask-only persona: each option is a submit button carrying its id; skipping
  // advances without saving (persona stays null -> generic guidance ranking).
  // `picking` is a display-only marker so the chosen card stays lit while the
  // server action runs; it changes nothing about the data path.
  const [picking, setPicking] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    async (prev, formData) => {
      const result = await savePersonaAction(prev, formData);
      if (result?.ok) onNext();
      else setPicking(null);
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className={s.step}>
      <StepHeader step="persona" title="Which sounds most like you?">
        Pick one so your dashboard tips match how you actually get paid. Not sure? Skip it, you can
        set this in Settings anytime.
      </StepHeader>

      <button type="button" className={s.skipLinkLead} onClick={onNext} disabled={pending}>
        Skip this step
      </button>

      {state?.error ? (
        <p className={`${s.formMsg} ${s.formMsgError}`} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={s.personaGrid}>
        {PERSONA_OPTIONS.map((option, i) => {
          const isPicked = picking === option.id;
          return (
            <button
              key={option.id}
              type="submit"
              name="persona"
              value={option.id}
              className={s.personaCard}
              onClick={() => setPicking(option.id)}
              disabled={pending}
              aria-busy={pending && isPicked ? true : undefined}
            >
              <span className={s.personaIndex} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={s.personaText}>
                <span className={s.personaLabel}>{option.label}</span>
                <span className={s.personaHint}>{option.hint}</span>
              </span>
              {pending && isPicked ? (
                <span className={s.personaSaving} aria-hidden="true">
                  Saving
                </span>
              ) : null}
            </button>
          );
        })}
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

  // Inline, per-field validation (O5). Helpful hints, never scolding. Focus
  // moves to the first invalid field on submit. Server `state.error` stays for
  // genuine save failures only.
  const nameId = useId();
  const businessId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const businessRef = useRef<HTMLInputElement>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);

  const NAME_HINT = 'Add your name so Verdact can greet you.';
  const BUSINESS_HINT = 'Add your business name to label your workspace.';

  function validateName(value: string): boolean {
    const ok = value.trim().length > 0;
    setNameError(ok ? null : NAME_HINT);
    return ok;
  }
  function validateBusiness(value: string): boolean {
    const ok = value.trim().length > 0;
    setBusinessError(ok ? null : BUSINESS_HINT);
    return ok;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nameOk = validateName(nameRef.current?.value ?? '');
    const businessOk = validateBusiness(businessRef.current?.value ?? '');
    if (!nameOk || !businessOk) {
      event.preventDefault();
      if (!nameOk) nameRef.current?.focus();
      else businessRef.current?.focus();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className={s.step} noValidate>
      <StepHeader step="basics" title="Tell Verdact who you are">
        Your name is how Verdact greets you. Your business name labels your workspace and every
        evidence record.
      </StepHeader>

      {state?.error ? (
        <p className={`${s.formMsg} ${s.formMsgError}`} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={s.fieldPanel}>
        <div className={s.field}>
          <label className={s.label} htmlFor={nameId}>
            Your name
          </label>
          <input
            id={nameId}
            ref={nameRef}
            name="fullName"
            className={`${s.input} ${nameError ? s.inputError : ''}`}
            defaultValue={initialFullName}
            autoComplete="name"
            placeholder="Alex Rivera"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-err` : undefined}
            onBlur={(e) => validateName(e.target.value)}
            onInput={(e) => {
              if (nameError) validateName((e.target as HTMLInputElement).value);
            }}
          />
          {nameError ? (
            <p id={`${nameId}-err`} className={s.fieldError}>
              <AlertIcon className={s.fieldErrorIcon} />
              {nameError}
            </p>
          ) : null}
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor={businessId}>
            Business name
          </label>
          <input
            id={businessId}
            ref={businessRef}
            name="businessName"
            className={`${s.input} ${businessError ? s.inputError : ''}`}
            defaultValue={initialBusinessName}
            autoComplete="organization"
            placeholder="Northstar Studio"
            aria-invalid={businessError ? true : undefined}
            aria-describedby={businessError ? `${businessId}-err` : undefined}
            onBlur={(e) => validateBusiness(e.target.value)}
            onInput={(e) => {
              if (businessError) validateBusiness((e.target as HTMLInputElement).value);
            }}
          />
          {businessError ? (
            <p id={`${businessId}-err`} className={s.fieldError}>
              <AlertIcon className={s.fieldErrorIcon} />
              {businessError}
            </p>
          ) : null}
        </div>
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
      <StepHeader step="stripe" title="Connect Stripe so Verdact can see your disputes">
        This is the only connection setup needs. It takes about a minute, and your dashboard fills in
        the moment it is done.
      </StepHeader>

      {stripeConnected ? (
        <div className={s.successBand}>
          <CheckIcon className={s.successBandIcon} />
          <span>
            <b>Stripe connected.</b> Verdact can see your account now.
          </span>
        </div>
      ) : null}

      {/* Dominant, hero action card. Deep verdict field is dark in both themes by
          design, so its mint/white text is correct here too. */}
      <div className={s.connectCard}>
        <div className={s.connectText}>
          <p className={s.connectEyebrow}>
            <PlugIcon className={s.connectEyebrowIcon} />
            The one connection
          </p>
          <p className={s.connectHead}>
            {stripeConnected ? 'Stripe is connected' : 'Connect your Stripe account'}
          </p>
          <p className={s.connectSub}>
            {stripeConnected
              ? 'You are all set. You can move on whenever you are ready.'
              : 'Read-only access. Your dashboard fills in the moment it is done.'}
          </p>
        </div>
        <a href="/api/stripe/connect/start" className={s.connectCta}>
          <PlugIcon className={s.connectCtaIcon} />
          {stripeConnected ? 'Reconnect a different account' : 'Connect Stripe'}
        </a>
      </div>

      {/* Re-ranked trust: lead with the #1 fear-reliever, demote housekeeping. */}
      <ReassureCard
        icon={<EyeIcon />}
        title="Verdact only reads your Stripe data."
        className={s.trustLead}
      >
        You decide every action, and nothing is filed without you.
      </ReassureCard>

      <ul className={s.trust} aria-label="What to expect">
        <li className={s.trustRow}>
          <LockIcon className={s.trustRowIcon} />
          <span>We store only your Stripe account ID, never your keys, and never train on your data.</span>
        </li>
        <li className={s.trustRow}>
          <ShieldIcon className={s.trustRowIcon} />
          <span>You can disconnect anytime from Settings.</span>
        </li>
      </ul>

      {stripeConnected ? (
        <div className={s.actions}>
          <button type="button" className={s.primaryBtn} onClick={onSkip}>
            Continue
          </button>
        </div>
      ) : (
        <div className={s.skipConsequence}>
          <p className={s.skipConsequenceText}>
            Not ready? You can do this later, but Verdact cannot see any disputes or account health
            until Stripe is connected.
          </p>
          <button type="button" className={s.skipLink} onClick={onSkip}>
            Do this later
          </button>
        </div>
      )}
    </div>
  );
}

function FinishStep({ stripeConnected }: { stripeConnected: boolean }) {
  return (
    <form action={completeOnboardingAction} className={`${s.step} ${s.stepFinish}`}>
      <div className={s.finishSeal} aria-hidden="true">
        <CheckIcon className={s.finishSealIcon} />
      </div>

      <StepHeader step="finish" title="You're all set">
        {stripeConnected
          ? 'Stripe is connected and Verdact is watching your account. Your first account-health reading is on its way, it lands on your dashboard shortly.'
          : 'Your workspace is ready. Connect Stripe from your dashboard whenever you want Verdact to start watching disputes and account health.'}
      </StepHeader>

      {stripeConnected ? (
        <div className={s.finishBadge}>
          <StatusBadge tone="done" icon={<CheckIcon />}>
            Stripe connected
          </StatusBadge>
        </div>
      ) : (
        <div className={s.finishBadge}>
          <StatusBadge tone="watch" icon={<PlugIcon />}>
            Connect Stripe when you are ready
          </StatusBadge>
        </div>
      )}

      <p className={s.finishReassure}>
        <ShieldIcon className={s.finishReassureIcon} />
        <span>One dispute will not suspend your Stripe account. Take your time and respond well.</span>
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
      <button
        type="submit"
        className={s.skipBtn}
        title="Skip setup and go to dashboard"
        aria-label="Skip setup and go to dashboard"
      >
        Skip for now
      </button>
    </form>
  );
}
