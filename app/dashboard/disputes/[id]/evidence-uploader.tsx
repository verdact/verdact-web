'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_PURPOSES,
  MAX_EVIDENCE_FILE_BYTES,
  PURPOSE_HINTS,
  PURPOSE_LABELS,
  isAllowedEvidenceMime,
  type EvidencePurpose,
} from '@/lib/evidence/intake';
import styles from './workbench.module.css';

/**
 * Real evidence intake (R2 sub-stage 1): upload, drag-and-drop, or paste a
 * screenshot. Posts each file to /api/evidence/upload (auth + RLS + sha256
 * dedupe server-side), then refreshes the workbench so the new file appears in
 * the Evidence Record and recomputes readiness.
 *
 * Client-side checks (type + size) are a fast first pass only; the route handler
 * re-validates everything — never trust the browser.
 */

type ItemStatus = 'uploading' | 'done' | 'error';

interface UploadItem {
  key: number;
  name: string;
  status: ItemStatus;
  message?: string;
}

export function EvidenceUploader({
  disputeId,
  tone = 'lead',
}: {
  disputeId: string;
  // 'lead' = prominent accent treatment (when it is the primary action).
  // 'tool' = neutral surface (when the guided Resolve card leads above it).
  tone?: 'lead' | 'tool';
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [purpose, setPurpose] = useState<EvidencePurpose>('service_documentation');
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      for (const file of files) {
        const key = counter.current++;
        const name = file.name || 'Pasted image';

        if (!isAllowedEvidenceMime(file.type)) {
          setItems((prev) => [
            { key, name, status: 'error', message: 'Unsupported file type.' },
            ...prev,
          ]);
          continue;
        }
        if (file.size > MAX_EVIDENCE_FILE_BYTES) {
          setItems((prev) => [
            { key, name, status: 'error', message: 'Over the 4.5 MB limit.' },
            ...prev,
          ]);
          continue;
        }

        setItems((prev) => [{ key, name, status: 'uploading' }, ...prev]);

        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('disputeId', disputeId);
          fd.append('purpose', purpose);
          const res = await fetch('/api/evidence/upload', { method: 'POST', body: fd });
          const json = (await res.json().catch(() => ({}))) as {
            error?: string;
            deduped?: boolean;
            updated?: boolean;
          };
          if (!res.ok) {
            updateItem(setItems, key, { status: 'error', message: json.error ?? 'Upload failed.' });
            continue;
          }
          updateItem(setItems, key, {
            status: 'done',
            message: json.updated
              ? 'Re-categorized'
              : json.deduped
                ? 'Already attached'
                : 'Attached',
          });
        } catch {
          updateItem(setItems, key, { status: 'error', message: 'Network error. Try again.' });
        }
      }
      setBusy(false);
      router.refresh();
    },
    [disputeId, purpose, router],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadFiles(files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    void uploadFiles(Array.from(e.dataTransfer.files));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length > 0) {
      e.preventDefault();
      void uploadFiles(pasted);
    }
  };

  const lead = tone === 'lead';
  return (
    <section
      className={`overflow-hidden rounded-md bg-surface-2 ${
        lead
          ? 'border border-accent-rule border-l-[4px] border-l-accent'
          : 'border border-rule-strong'
      }`}
      onPaste={onPaste}
    >
      <header
        className={`flex items-center gap-4 px-5 py-4 ${lead ? 'bg-accent-soft' : 'bg-surface-3/60'}`}
      >
        <span
          className={`grid h-8 w-8 flex-none place-items-center rounded-full ${
            lead ? 'bg-accent text-white' : 'border border-rule-strong bg-surface text-ink-mute'
          }`}
        >
          <UploadGlyph className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`${styles.labelMonoStrong} ${lead ? 'text-accent-deep' : 'text-ink-mute'}`}>
            Add evidence
          </span>
          <span className={`${styles.fontDisplay} mt-1 block text-[1.05rem] font-semibold leading-tight text-ink`}>
            Upload, drag and drop, or paste a screenshot
          </span>
        </span>
      </header>

      <div className="px-5 pb-5 pt-4">
        <label className={`${styles.labelMono} mb-1.5 block`} htmlFor="evidence-purpose">
          What is this?
        </label>
        <select
          id="evidence-purpose"
          className="w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as EvidencePurpose)}
        >
          {EVIDENCE_PURPOSES.map((p) => (
            <option key={p} value={p}>
              {PURPOSE_LABELS[p]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-5 text-ink-mute">{PURPOSE_HINTS[purpose]}</p>

        <div
          className={`mt-4 grid place-items-center rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? 'border-action bg-action-soft' : 'border-rule-strong bg-surface'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <p className="text-sm font-semibold text-ink">Drag a file here</p>
          <p className="mt-1 text-xs text-ink-mute">PDF, image, or text. Up to 4.5 MB each.</p>
          <button
            type="button"
            className="mt-3 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Choose a file
          </button>
          <p className="mt-2 text-xs text-ink-faint">or paste a screenshot here</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={EVIDENCE_ACCEPT}
            className="sr-only"
            onChange={onPick}
          />
        </div>

        {items.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2.5 rounded-md border border-rule bg-surface px-3 py-2 text-sm"
              >
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-white ${
                    item.status === 'error'
                      ? 'bg-accent'
                      : item.status === 'done'
                        ? 'bg-trust'
                        : 'bg-rule-strong'
                  }`}
                  aria-hidden="true"
                >
                  {item.status === 'uploading' ? '…' : item.status === 'done' ? '✓' : '!'}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
                <span
                  className={`flex-none text-xs ${
                    item.status === 'error' ? 'text-accent' : 'text-ink-mute'
                  }`}
                >
                  {item.status === 'uploading'
                    ? 'Uploading'
                    : item.message ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 border-t border-dashed border-rule-strong pt-3 text-xs leading-5 text-ink-mute">
          Files are stored privately and never sent to the bank until you approve and file.
        </p>
      </div>
    </section>
  );
}

function updateItem(
  setItems: React.Dispatch<React.SetStateAction<UploadItem[]>>,
  key: number,
  patch: Partial<UploadItem>,
) {
  setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
}

function UploadGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0L7 9m5-5l5 5M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
