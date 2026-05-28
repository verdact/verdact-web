'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'verdact-theme';

function readInitial(): Theme | null {
  if (typeof document === 'undefined') return null;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return null;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readInitial());
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  }

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded border border-rule bg-surface-2 p-0.5"
    >
      {(['light', 'dark'] as const).map((t) => {
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => apply(t)}
            className="px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--surface-3)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-mute)',
              borderRadius: 2,
            }}
          >
            {t === 'light' ? 'Light' : 'Dark'}
          </button>
        );
      })}
    </div>
  );
}
