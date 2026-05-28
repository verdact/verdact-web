'use client';

import { useEffect, useState } from 'react';

/**
 * Theme selector — segmented [System | Light | Dark].
 *
 * - "system" is the default / unset state: no `verdact-theme` in
 *   localStorage and no `data-theme` attribute, so CSS follows the OS
 *   `prefers-color-scheme`.
 * - "light" / "dark" are explicit overrides persisted to localStorage and
 *   reflected as `data-theme` on <html>. The inline script in the root
 *   layout applies the stored value before paint to avoid a flash.
 *
 * Safe to mount in any chrome (public nav, app header, auth shell). Takes
 * no required props.
 */

type Mode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'verdact-theme';

const MODES: { value: Mode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function readStoredMode(): Mode {
  if (typeof document === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore storage failures */
  }
  // Fall back to whatever the FOUC script may have set on <html>.
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'system';
}

export function ThemeToggle({ className }: { className?: string }) {
  // Render the system default until mounted so SSR and first paint agree;
  // the real value is read in the effect below.
  const [mode, setMode] = useState<Mode>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(readStoredMode());
    setMounted(true);
  }, []);

  function apply(next: Mode) {
    setMode(next);
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      /* ignore storage failures */
    }

    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', next);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center gap-0.5 rounded border border-rule bg-surface-2 p-0.5 ${className ?? ''}`}
    >
      {MODES.map(({ value, label }) => {
        const active = mounted && mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => apply(value)}
            className="rounded-sm px-2.5 py-1 transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: active ? 'var(--surface-3)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-mute)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
