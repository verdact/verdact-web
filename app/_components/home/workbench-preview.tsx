'use client';

import { useRef, useState } from 'react';
import { IconAlert, IconCheck } from '../ui/icons';
import styles from './workbench-preview.module.css';

/**
 * Homepage section 7 preview: the composed evidence workbench from the Stage 6
 * hi-fi gallery (case readiness, evidence lines with source tags, packet
 * validator). Desktop shows all three panels; mobile collapses to ARIA tabs
 * per addendum D20 instead of horizontal inner scrolling.
 */

type PanelId = 'readiness' | 'evidence' | 'validator';

const TABS: { id: PanelId; label: string }[] = [
  { id: 'readiness', label: 'Readiness' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'validator', label: 'Validator' },
];

export function WorkbenchPreview() {
  const [active, setActive] = useState<PanelId>('readiness');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const wrapped = (next + TABS.length) % TABS.length;
    setActive(TABS[wrapped].id);
    tabRefs.current[wrapped]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Workbench preview" className={styles.tabs}>
        {TABS.map(({ id, label }, index) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            id={`wb-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`wb-panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            onClick={() => setActive(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.panels}>
        <section
          role="tabpanel"
          id="wb-panel-readiness"
          aria-labelledby="wb-tab-readiness"
          data-inactive={active !== 'readiness'}
          className={styles.panel}
        >
          <h3 className={styles.panelTitle}>Case readiness</h3>
          <p className={styles.readyFigure}>
            6<small> of 7</small>
          </p>
          <p style={{ marginTop: 'var(--space-3)' }}>
            <span className="pill pill--warning">
              <span className="ping" />1 gap to close
            </span>
          </p>
          <p className={styles.readyNote}>
            Proof pillars covered for this dispute. Verdact scores readiness as
            you add evidence, so you know where the case stands before you file.
          </p>
        </section>

        <section
          role="tabpanel"
          id="wb-panel-evidence"
          aria-labelledby="wb-tab-evidence"
          data-inactive={active !== 'evidence'}
          className={styles.panel}
        >
          <h3 className={styles.panelTitle}>Evidence record</h3>
          <div className={styles.evRow}>
            <span className="dot dot--ok"><IconCheck size={12} /></span>
            <div>
              <span className="tag tag--stripe">Stripe</span>
              <p className={styles.evText}>Payment captured, IP match on checkout</p>
            </div>
          </div>
          <div className={styles.evRow}>
            <span className="dot dot--ok"><IconCheck size={12} /></span>
            <div>
              <span className="tag tag--email">Email</span>
              <p className={styles.evText}>Delivery confirmation, Apr 12</p>
            </div>
          </div>
          <div className={styles.evRow}>
            <span className="dot dot--ok"><IconCheck size={12} /></span>
            <div>
              <span className="tag tag--slack">Slack</span>
              <p className={styles.evText}>Client: &ldquo;Looks great, ship it&rdquo;</p>
            </div>
          </div>
          <div className={styles.evRow}>
            <span className="dot dot--ok"><IconCheck size={12} /></span>
            <div>
              <span className="tag tag--policy">Policy</span>
              <p className={styles.evText}>Refund policy accepted at checkout</p>
            </div>
          </div>
          <div className={styles.evRow}>
            <span className="dot dot--miss"><IconAlert size={12} /></span>
            <div>
              <span className="tag tag--missing">Missing</span>
              <p className={styles.evText} style={{ color: 'var(--accent)' }}>
                Final acceptance note
              </p>
            </div>
          </div>
        </section>

        <section
          role="tabpanel"
          id="wb-panel-validator"
          aria-labelledby="wb-tab-validator"
          data-inactive={active !== 'validator'}
          className={styles.panel}
        >
          <h3 className={styles.panelTitle}>Packet validator</h3>
          <p className={styles.checkRow}>
            <IconCheck size={14} className={styles.checkOk} />
            Response window open, 8 days left
          </p>
          <p className={styles.checkRow}>
            <IconCheck size={14} className={styles.checkOk} />
            Reason code 13.1 addressed
          </p>
          <p className={styles.checkRow}>
            <IconCheck size={14} className={styles.checkOk} />
            Every claim mapped to evidence
          </p>
          <p className={styles.checkRow}>
            <IconAlert size={14} className={styles.checkMiss} />
            <span style={{ color: 'var(--accent)' }}>
              Final acceptance note missing
            </span>
          </p>
          <p className={styles.validatorNote}>
            The validator runs before anything is submitted. You see every gap
            while there is still time to close it.
          </p>
        </section>
      </div>
    </div>
  );
}
