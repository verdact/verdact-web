'use client';

import { useRef } from 'react';
import s from './measured-popup.module.css';

// "How is this measured?" explainer. Uses the native <dialog> element, which
// traps focus and handles ESC for us. Network-neutral, cited, no exact-VAMP
// promise: we describe the inputs and the reference lines, not a guarantee.

const SOURCES: Array<{ source: string; detail: string }> = [
  {
    source: 'Stripe',
    detail:
      'Flags accounts whose dispute rate trends toward 0.75% of payments. This is the line Verdact scores you against, because most early-stage merchants reach it first.',
  },
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
  {
    source: 'CE 3.0',
    detail:
      'Disputes that qualify under Visa Compelling Evidence 3.0 can be excluded from the rate, which is why a qualifying win can move your headroom.',
  },
];

export function MeasuredPopup() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={s.trigger}
        onClick={() => ref.current?.showModal()}
      >
        How is this measured?
      </button>

      <dialog ref={ref} className={s.dialog} aria-labelledby="measured-title">
        <div className={s.inner}>
          <div className={s.head}>
            <h2 id="measured-title" className={s.title}>
              How your account health is measured
            </h2>
            <button
              type="button"
              className={s.close}
              aria-label="Close"
              onClick={() => ref.current?.close()}
            >
              ×
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

            <ul className={s.list}>
              {SOURCES.map((item) => (
                <li key={item.source} className={s.row}>
                  <span className={s.source}>{item.source}</span>
                  <span className={s.detail}>{item.detail}</span>
                </li>
              ))}
            </ul>

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
