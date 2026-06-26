import type { ChainNode } from '@/lib/evidence';
import { AlertIcon, CheckIcon } from '../../dash-icons';
import styles from './workbench.module.css';

/**
 * Chain of Intent timeline (C-E2). Renders the assembled evidence as a vertical,
 * chronological story a reviewer reads: checkout authorization first, then what
 * the customer agreed to, then delivery, usage, and client acceptance.
 *
 * Present nodes carry the verdict-green marker (icon + text); a missing
 * authorization or acceptance signal renders as a vermilion "Gap" node the
 * merchant can close. Layout-only: nothing here animates a layout-bound
 * property, so it is reduced-motion safe by construction.
 */
export function ChainOfIntentTimeline({ nodes }: { nodes: ChainNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="border-b border-rule bg-surface-3/60 px-6 py-4">
        <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>Chain of Intent</p>
        <p className={`${styles.labelMono} mt-1.5`}>
          The story in order, from checkout to acceptance. Banks read a timeline, not a pile.
        </p>
      </header>
      <div className="px-6 py-6">
        <ol className={styles.coiList}>
          {nodes.map((node) => (
            <ChainNodeRow key={node.id} node={node} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function ChainNodeRow({ node }: { node: ChainNode }) {
  const isGap = node.state === 'gap';
  return (
    <li className={styles.coiNode}>
      <span
        className={isGap ? styles.coiMarkerGap : styles.coiMarkerOk}
        aria-hidden="true"
      >
        {isGap ? <AlertIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
      </span>
      <div className={styles.coiBody}>
        <p className={isGap ? styles.coiTitleGap : styles.coiTitle}>
          {node.title}
          {isGap ? (
            <span className={styles.pillGap}>
              <AlertIcon className="h-3 w-3" />
              Gap
            </span>
          ) : (
            <span className={styles.pillVerdict}>
              <CheckIcon className="h-3 w-3" />
              In the chain
            </span>
          )}
          {node.when ? <span className={styles.coiWhen}>{node.when}</span> : null}
        </p>
        <p className={styles.coiDetail}>{node.detail}</p>
        {isGap ? (
          <a
            href="#add-evidence"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-action underline underline-offset-4 hover:text-action-deep"
          >
            Fix this in Build
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}
