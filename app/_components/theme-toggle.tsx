'use client';

import { useEffect, useState } from 'react';

/**
 * Theme selector, segmented [System | Light | Dark].
 *
 * Storage contract (shared with the FOUC script in the root layout):
 * - "system": no `verdact-theme` key, no `data-theme` attribute; CSS follows
 *   the OS `prefers-color-scheme`.
 * - "light" / "dark": persisted to localStorage and mirrored as `data-theme`
 *   on <html>.
 *
 * Accessibility (Stage 8 addendum 7.3): buttons are an aria-pressed group;
 * the System button's accessible name includes the resolved theme.
 */

type Mode = 'system' | 'light' | 'dark';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'verdact-theme';

function readStoredMode(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable: fall through to system */
  }
  return 'system';
}

function readSystemTheme(): Resolved {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeToggle({ className }: { className?: string }) {
  // SSR and first client paint agree on the default; the effect syncs truth.
  const [mode, setMode] = useState<Mode>('system');
  const [systemTheme, setSystemTheme] = useState<Resolved>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(readStoredMode());
    setSystemTheme(readSystemTheme());
    setMounted(true);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
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
      /* storage unavailable: attribute still applies for this page view */
    }

    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', next);
    }
  }

  const systemLabel = mounted
    ? `System, currently ${systemTheme}`
    : 'System';

  const modes: { value: Mode; label: string; ariaLabel?: string }[] = [
    { value: 'system', label: 'System', ariaLabel: systemLabel },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <div role="group" aria-label="Color theme" className={`themeseg ${className ?? ''}`}>
      {modes.map(({ value, label, ariaLabel }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mounted && mode === value}
          aria-label={ariaLabel}
          onClick={() => apply(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
