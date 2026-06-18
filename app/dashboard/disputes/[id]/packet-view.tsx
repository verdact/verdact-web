import type { EvidencePacket } from '@/lib/evidence/packet';
import { PaidGate } from '../../../_components/ui/paid-gate';
import { PacketDownloadButton } from './packet-download';
import { AlertIcon, CheckIcon, DocIcon } from '../../dash-icons';
import styles from './workbench.module.css';

/**
 * Generated evidence packet view (R2 sub-stage 1).
 *
 * Build + view is FREE. The packet is rendered as the submission-ready view —
 * Stripe native evidence fields + the exhibit manifest + the combined-size
 * indicator. Download is gated through can() + <PaidGate> (beta = unlocked;
 * watermarked-preview copy when gated). The QA gate blocks the DOWNLOAD when
 * analyzeEvidence().filingBlocked, never the view itself.
 */
export function PacketView({
  packet,
  canDownload,
  packetText,
  downloadFilename,
  reasonLabel,
}: {
  packet: EvidencePacket;
  canDownload: boolean;
  packetText: string;
  downloadFilename: string;
  // C-E1: the detected reason code, shown as the bank-ready header so each
  // mapped field reads against the requirement it satisfies.
  reasonLabel: string;
}) {
  const sizeTone = packet.limits.withinSizeLimit ? styles.pillVerdict : styles.pillGap;

  return (
    <section className={`${styles.card} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface-3/60 px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${styles.fontDisplay} text-lg font-semibold text-ink`}>Bank-ready evidence packet</p>
            <span className={styles.pillNeutral}>Preview</span>
          </div>
          <p className={`${styles.labelMono} mt-1.5`}>
            Reason code: {reasonLabel}. Each field below maps to what this code requires.
          </p>
        </div>
        <span className={sizeTone}>
          {packet.limits.withinSizeLimit ? <CheckIcon className="h-3 w-3" /> : <AlertIcon className="h-3 w-3" />}
          {packet.limits.totalLabel} of 4.5 MB
        </span>
      </header>

      <div className="px-6 py-2">
        {packet.fields.map((field) => (
          <div key={field.key} className="border-b border-rule py-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{field.label}</span>
              {field.present ? (
                <span className={styles.pillVerdict}>
                  <CheckIcon className="h-3 w-3" />
                  Mapped to required field
                </span>
              ) : (
                <span className={styles.pillGap}>
                  <AlertIcon className="h-3 w-3" />
                  Gap: not yet addressed
                </span>
              )}
            </div>
            {field.present ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{field.value}</p>
            ) : (
              <p className="mt-2 text-sm italic leading-6 text-ink-mute">Not provided yet</p>
            )}
            <p className={`${styles.labelMono} mt-2`}>
              From {field.source} · {field.key}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-rule px-6 py-4">
        <p className={`${styles.labelMono} mb-3`}>Exhibits ({packet.exhibits.length})</p>
        {packet.exhibits.length === 0 ? (
          <p className="text-sm leading-6 text-ink-mute">
            No files attached yet. Add evidence above and it appears here as an exhibit.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {packet.exhibits.map((exhibit) => (
              <li
                key={exhibit.id}
                className="flex items-center gap-3 rounded-md border border-rule bg-surface px-3 py-2"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-md border border-rule-strong bg-surface-2 text-action">
                  <DocIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{exhibit.name}</span>
                  <span className={styles.metaMono}>maps to {exhibit.stripeField}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-rule bg-surface-2 px-6 py-4">
        {packet.filingBlocked ? (
          <p className="flex items-center gap-2 text-sm leading-6 text-accent-deep">
            <AlertIcon className="h-4 w-4 flex-none" />
            Resolve the QA blocker above before downloading. You can still view and edit the packet.
          </p>
        ) : (
          <PaidGate action="download_packet" allowed={canDownload}>
            <PacketDownloadButton text={packetText} filename={downloadFilename} label="Download packet" />
          </PaidGate>
        )}
      </div>
    </section>
  );
}
