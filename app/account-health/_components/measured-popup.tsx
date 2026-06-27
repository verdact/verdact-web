'use client';

import { useRef } from 'react';
import { IconClose, IconCheck } from '../../_components/ui/icons';
import { GlossaryTerm } from '../../_components/ui/glossary-term';
import s from './measured-popup.module.css';

// "How is this measured?" explainer. Uses the native <dialog> element, which
// traps focus and handles ESC for us. Network-neutral, cited, no exact-VAMP
// promise: we describe the inputs and the reference lines, not a guarantee.
//
// Progressive disclosure (AH5): Stripe's 0.75% line is the one number that
// matters, so it leads as an emphasized callout. The other networks and the
// stronger-evidence rule collapse behind a <details> for the few who want depth.

// Visa, Mastercard, and the stronger-evidence rule live behind the disclosure.
const OTHER_SOURCES: Array<{ source: string; detail: string }> = [
  {
    source: 'Visa',
    detail:
      'Its monitoring program acts at 1.5% and a minimum monthly dispute count (in the order of 1,500), so most lower-volume accounts sit well under the count gate.',
  },
  {
    source: 'Mastercard',
    detail:
      'Its excessive-chargeback monitoring acts around 1.5% with a 100-dispute monthly minimum.',
  },
];

export function MeasuredPopup() {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function open() {
    ref.current?.showModal();
    // Native showModal focuses the first focusable; pin it to the close control
    // so focus lands on a predictable, labeled target (SE3 family).
    closeRef.current?.focus();
  }

  return (
    <>
      <button type="button" className={s.trigger} onClick={open}>
        How is this measured?
      </button>

      <dialog ref={ref} className={s.dialog} aria-labelledby="measured-title">
        <div className={s.inner}>
          <div className={s.head}>
            <div className={s.headText}>
              <p className={s.eyebrow}>How this works</p>
              <h2 id="measured-title" className={s.title}>
                How your account health is measured
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              className={s.close}
              aria-label="Close"
              onClick={() => ref.current?.close()}
            >
              <IconClose />
            </button>
          </div>

          <div className={s.body}>
            <p className={s.para}>
              Your rate is the count of disputes and early fraud warnings on your
              connected Stripe account over a trailing 90 days, divided by the
              settled card charges in the same window. Each card charge is counted
              once, so a dispute and a fraud warning on the same charge do not
              double-count.
            </p>

            <div className={s.callout}>
              <span className={s.calloutIcon} aria-hidden="true">
                <IconCheck />
              </span>
              <div className={s.calloutText}>
                <p className={s.calloutTitle}>Stripe is the line you are scored against.</p>
                <p className={s.calloutBody}>
                  It flags accounts whose dispute rate trends toward 0.75% of payments,
                  and most early-stage businesses reach it first.
                </p>
              </div>
            </div>

            <details className={s.disclosure}>
              <summary className={s.summary}>Other networks and rules</summary>
              <ul className={s.list}>
                {OTHER_SOURCES.map((item) => (
                  <li key={item.source} className={s.row}>
                    <span className={s.source}>{item.source}</span>
                    <span className={s.detail}>{item.detail}</span>
                  </li>
                ))}
                <li className={s.row}>
                  <span className={s.source}>
                    <GlossaryTerm term="ce3">Stronger-evidence rule (Visa)</GlossaryTerm>
                  </span>
                  <span className={s.detail}>
                    Disputes that qualify can be excluded from the rate, which is why a
                    qualifying win can move your headroom.
                  </span>
                </li>
              </ul>
            </details>

            <p className={s.foot}>
              Reference lines, not a verdict on your account. The networks and
              Stripe make their own determinations. Verdact surfaces where you
              stand so you can act early.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
