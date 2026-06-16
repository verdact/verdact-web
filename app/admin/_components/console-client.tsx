'use client';

import { useState } from 'react';
import type { Draft } from '@/lib/admin/convert';
import s from '../admin.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Client-only console bits: copy-to-clipboard + the outreach draft block.
// Drafts are NEVER auto-sent — the founder copies and sends from their own
// account. The note makes that explicit.
// ─────────────────────────────────────────────────────────────────────────────

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (permissions / insecure context). Fail quietly;
      // the founder can still select the text manually.
      setCopied(false);
    }
  }

  return (
    <button type="button" className={s.secondaryBtn} onClick={onCopy}>
      {copied ? 'Copied' : label}
    </button>
  );
}

export function DraftBlock({ draft }: { draft: Draft }) {
  const full = `Subject: ${draft.subject}\n\n${draft.body}`;
  return (
    <div className={s.draftBlock}>
      <div className={s.draftSubject}>{draft.subject}</div>
      <div className={s.draftBody}>{draft.body}</div>
      <div className={s.draftActions}>
        <CopyButton text={full} label="Copy email" />
        <CopyButton text={draft.body} label="Copy body only" />
      </div>
      <p className={s.draftNote}>Draft only. Nothing is sent from Verdact. Copy this and send it from your own inbox.</p>
    </div>
  );
}
