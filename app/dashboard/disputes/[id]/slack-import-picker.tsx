'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlackChannel, SlackMessageSnapshot } from '@/lib/slack/api';

/**
 * In-dispute Slack picker. The merchant opens ONE channel, sees its recent
 * messages, picks the exact ones where the customer agreed / accepted / used the
 * work, previews the snapshot, and attaches. Only the opened channel is read,
 * and only the picked messages are saved — the selected-message guarantee is
 * enforced here in app logic, never by a Slack permission.
 *
 * Reads go through server routes that hold the encrypted user token:
 *   GET  /api/slack/channels            (uncapped)
 *   GET  /api/slack/messages?channelId  (rate-capped: ~1/min, 15 objects)
 *   POST /api/evidence/import/slack     (snapshot -> one evidence_files row)
 */

type ApiMessagesResponse = {
  connected?: boolean;
  messages?: SlackMessageSnapshot[];
  nextCursor?: string | null;
  error?: string;
  retryAfter?: number;
};

type ApiChannelsResponse = {
  connected?: boolean;
  channels?: SlackChannel[];
  error?: string;
  retryAfter?: number;
};

export function SlackImportPicker({
  disputeId,
  slackConnected,
}: {
  disputeId: string;
  slackConnected: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [channelFilter, setChannelFilter] = useState('');
  const [active, setActive] = useState<SlackChannel | null>(null);

  const [messages, setMessages] = useState<SlackMessageSnapshot[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/slack/channels');
      const json = (await res.json().catch(() => ({}))) as ApiChannelsResponse;
      if (res.status === 429) {
        setError(json.error ?? 'Slack is rate-limiting this workspace. Try again shortly.');
      } else if (!res.ok || json.connected === false) {
        setError(json.error ?? 'Could not load Slack channels.');
      } else {
        setChannels(json.channels ?? []);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    setOpen(true);
    if (!channels) void loadChannels();
  }, [channels, loadChannels]);

  // When the Stage 1E Resolve card's "Import from Slack" route deep-links here
  // (#import-slack), open the picker straight away so the merchant lands on the
  // channel browser instead of a collapsed card.
  useEffect(() => {
    if (!slackConnected) return;
    const openIfTargeted = () => {
      if (window.location.hash === '#import-slack') openPicker();
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    return () => window.removeEventListener('hashchange', openIfTargeted);
  }, [slackConnected, openPicker]);

  const loadMessages = useCallback(
    async (channel: SlackChannel, cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ channelId: channel.id });
        if (cursor) qs.set('cursor', cursor);
        const res = await fetch(`/api/slack/messages?${qs.toString()}`);
        const json = (await res.json().catch(() => ({}))) as ApiMessagesResponse;
        if (res.status === 429) {
          setError(json.error ?? 'Slack limits message reads to about once a minute. Try again shortly.');
          return;
        }
        if (!res.ok || json.connected === false) {
          setError(json.error ?? 'Could not load messages.');
          return;
        }
        const incoming = json.messages ?? [];
        setMessages((prev) => (cursor ? [...prev, ...incoming] : incoming));
        setNextCursor(json.nextCursor ?? null);
      } catch {
        setError('Network error. Try again.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const chooseChannel = useCallback(
    (channel: SlackChannel) => {
      setActive(channel);
      setMessages([]);
      setNextCursor(null);
      setSelected(new Set());
      setDone(null);
      void loadMessages(channel);
    },
    [loadMessages],
  );

  const toggle = useCallback((ts: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  }, []);

  const attach = useCallback(async () => {
    if (!active || selected.size === 0) return;
    setAttaching(true);
    setError(null);
    setDone(null);
    const picked = messages
      .filter((m) => selected.has(m.ts))
      .map((m) => ({ ts: m.ts, author: m.author, authorId: m.authorId, text: m.text }));
    try {
      const res = await fetch('/api/evidence/import/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          channelId: active.id,
          channelName: active.name,
          messages: picked,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; deduped?: boolean };
      if (!res.ok) {
        setError(json.error ?? 'Could not attach the selected messages.');
        return;
      }
      setDone(json.deduped ? 'Those messages are already attached.' : 'Attached to this dispute.');
      setSelected(new Set());
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setAttaching(false);
    }
  }, [active, selected, messages, disputeId, router]);

  // Not connected: a compact connect card. No workspace is read until connected.
  if (!slackConnected) {
    return (
      <section className="overflow-hidden rounded-md border border-rule-strong bg-surface-2">
        <header className="flex items-center gap-4 bg-surface-3/60 px-5 py-4">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-rule-strong bg-surface text-ink-mute">
            <SlackGlyph className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="label-mono-strong text-ink-mute">Import from Slack</span>
            <span className="font-display mt-1 block text-[1.05rem] font-semibold leading-tight text-ink">
              Attach the messages where the customer agreed
            </span>
          </span>
        </header>
        <div className="px-5 pb-5 pt-4">
          <p className="text-sm leading-6 text-ink-mute">
            Connect a Slack workspace, then pick the exact messages where the customer agreed,
            accepted, or used the work. Nothing is read until you choose a channel, and only the
            messages you select are saved.
          </p>
          <a
            href="/api/slack/connect/start"
            className="mt-4 inline-flex rounded-md bg-action px-4 py-2 text-sm font-semibold text-white"
          >
            Connect Slack
          </a>
        </div>
      </section>
    );
  }

  const filteredChannels = (channels ?? []).filter((c) =>
    c.name.toLowerCase().includes(channelFilter.trim().toLowerCase()),
  );

  return (
    <section className="overflow-hidden rounded-md border border-rule-strong bg-surface-2">
      <header className="flex items-center gap-4 bg-surface-3/60 px-5 py-4">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-rule-strong bg-surface text-ink-mute">
          <SlackGlyph className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-mono-strong text-ink-mute">Import from Slack</span>
          <span className="font-display mt-1 block text-[1.05rem] font-semibold leading-tight text-ink">
            Pick the exact messages, then attach
          </span>
        </span>
        {!open ? (
          <button
            type="button"
            className="flex-none rounded-md border border-rule-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:border-action hover:bg-action-soft"
            onClick={openPicker}
          >
            Browse Slack
          </button>
        ) : null}
      </header>

      {open ? (
        <div className="px-5 pb-5 pt-4">
          {error ? (
            <p className="mb-3 rounded-md border border-accent-rule bg-accent-soft px-3 py-2 text-sm text-accent">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="mb-3 rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm text-trust">
              {done}
            </p>
          ) : null}

          {!active ? (
            <>
              <label className="label-mono mb-1.5 block" htmlFor="slack-channel-filter">
                Choose a channel
              </label>
              <input
                id="slack-channel-filter"
                type="text"
                placeholder="Filter channels"
                className="w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              />
              {loading && channels === null ? (
                <p className="mt-3 text-sm text-ink-mute">Loading channels…</p>
              ) : (
                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {filteredChannels.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md border border-rule bg-surface px-3 py-2 text-left text-sm text-ink hover:border-action hover:bg-action-soft"
                        onClick={() => chooseChannel(c)}
                      >
                        <span className="text-ink-faint">{c.isPrivate ? '🔒' : '#'}</span>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </button>
                    </li>
                  ))}
                  {filteredChannels.length === 0 ? (
                    <li className="px-1 py-2 text-sm text-ink-mute">No channels match.</li>
                  ) : null}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-ink">
                  {active.isPrivate ? '🔒 ' : '#'}
                  {active.name}
                </p>
                <button
                  type="button"
                  className="flex-none text-xs font-semibold text-action underline"
                  onClick={() => {
                    setActive(null);
                    setMessages([]);
                    setSelected(new Set());
                    setError(null);
                  }}
                >
                  Pick another channel
                </button>
              </div>

              {loading && messages.length === 0 ? (
                <p className="text-sm text-ink-mute">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-ink-mute">No readable messages in this channel.</p>
              ) : (
                <ul className="space-y-1.5">
                  {messages.map((m) => {
                    const checked = selected.has(m.ts);
                    return (
                      <li key={m.ts}>
                        <label
                          className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                            checked
                              ? 'border-action bg-action-soft'
                              : 'border-rule bg-surface hover:border-action'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 flex-none"
                            checked={checked}
                            onChange={() => toggle(m.ts)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-ink">{m.author}</span>
                              <span className="meta-mono flex-none text-ink-faint">{formatTs(m.ts)}</span>
                            </span>
                            <span className="mt-0.5 block whitespace-pre-wrap break-words text-ink-soft">
                              {m.text}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              {nextCursor ? (
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    className="rounded-md border border-rule-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft hover:border-action disabled:opacity-60"
                    onClick={() => active && loadMessages(active, nextCursor)}
                    disabled={loading}
                  >
                    {loading ? 'Loading…' : 'Load older messages'}
                  </button>
                  <span className="text-xs text-ink-faint">
                    Slack limits this to about once a minute.
                  </span>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-rule-strong pt-3">
                <p className="text-xs leading-5 text-ink-mute">
                  {selected.size === 0
                    ? 'Select the messages to save. Only what you pick is stored.'
                    : `${selected.size} message${selected.size === 1 ? '' : 's'} will be saved as evidence.`}
                </p>
                <button
                  type="button"
                  className="flex-none rounded-md bg-action px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={attach}
                  disabled={attaching || selected.size === 0}
                >
                  {attaching ? 'Attaching…' : 'Attach selected'}
                </button>
              </div>
            </>
          )}

          <p className="mt-3 border-t border-dashed border-rule-strong pt-3 text-xs leading-5 text-ink-mute">
            Imported messages are stored privately as a text record and never sent to the bank until
            you approve and file.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function formatTs(ts: string): string {
  const seconds = Number(ts.split('.')[0]);
  if (!Number.isFinite(seconds)) return ts;
  return new Date(seconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SlackGlyph({ className }: { className?: string }) {
  // Simplified Slack-style four-tile glyph, stroke-matched to the workbench.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3a2 2 0 0 0 0 4h2V5a2 2 0 0 0-2-2zM5 13a2 2 0 1 0 0 4 2 2 0 0 0 2-2v-2H5zm6 6a2 2 0 1 0 4 0v-2h-2a2 2 0 0 0-2 2zm8-8a2 2 0 1 0 0-4h-2v2a2 2 0 0 0 2 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
