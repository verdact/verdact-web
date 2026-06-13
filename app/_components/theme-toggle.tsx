"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "verdact-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle() {
  // `active` is the theme currently on screen. With no explicit choice stored,
  // it mirrors the OS preference (system default) without persisting anything.
  const [active, setActive] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setActive(stored);
      return;
    }

    // No explicit choice yet — follow the system preference and keep tracking
    // it until the user picks Light or Dark. The pre-paint script in layout.tsx
    // already set data-theme to the resolved system value; here we keep both the
    // button state and the attribute in sync if the OS preference changes live.
    setActive(systemTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const next = mq.matches ? "dark" : "light";
        setActive(next);
        document.documentElement.setAttribute("data-theme", next);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function select(choice: Theme) {
    setActive(choice);
    document.documentElement.setAttribute("data-theme", choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // ignore storage failures (private mode, disabled, etc.)
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color scheme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`theme-toggle__btn${active === opt.value ? " is-active" : ""}`}
          aria-pressed={active === opt.value}
          onClick={() => select(opt.value)}
          title={opt.label}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {opt.icon}
          </span>
          <span className="theme-toggle__label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
