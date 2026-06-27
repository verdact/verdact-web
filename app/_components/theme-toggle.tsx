"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";

type Theme = "light" | "dark";
// The user-facing choice. "system" is not a painted theme; it means "no stored
// choice, follow the OS" — selecting it clears the key and re-applies the OS
// preference, which is exactly what the pre-paint script in layout.tsx assumes
// when the key is absent. So the persistence MECHANISM is unchanged: a stored
// value is still only ever "light" or "dark"; "system" is the absence of one.
type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "verdact-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// Read the current choice from storage: an explicit light/dark wins, otherwise
// "system" (no stored key).
function readChoice(): Choice {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

const OPTIONS: { value: Choice; label: string; icon: string }[] = [
  { value: "system", label: "Auto", icon: "◐" },
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
];

/**
 * Shared theme controller hook. Tracks the user's CHOICE (system/light/dark) and
 * keeps the painted theme + storage in sync. When the choice is "system" it
 * follows live OS changes, exactly as before; an explicit choice persists.
 */
function useThemeChoice() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    setChoice(readChoice());

    // While on "system" (no stored key) keep following the OS preference live.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function select(next: Choice) {
    setChoice(next);
    if (next === "system") {
      // Clear the stored choice and fall back to the OS preference.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage failures (private mode, disabled, etc.)
      }
      applyTheme(systemTheme());
      return;
    }
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode, disabled, etc.)
    }
  }

  return { choice, select };
}

/**
 * ThemeToggle — the rail-footer segmented control. Now a three-way
 * System / Light / Dark switch so "follow my OS" is always reachable again.
 */
export function ThemeToggle() {
  const { choice, select } = useThemeChoice();

  return (
    <div className="theme-toggle" role="group" aria-label="Color scheme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`theme-toggle__btn${choice === opt.value ? " is-active" : ""}`}
          aria-pressed={choice === opt.value}
          onClick={() => select(opt.value)}
          title={opt.label === "Auto" ? "Follow system" : opt.label}
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

/**
 * ThemeToggleButton — a compact icon-only trigger for the mobile top bar (S5).
 * The rail is hidden below 1023px, so without this a phone user can never switch
 * themes. Tapping cycles System -> Light -> Dark -> System. It reuses the same
 * controller, so the rail control and this button stay perfectly in sync.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { choice, select } = useThemeChoice();

  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0];
  const nextIndex = (OPTIONS.findIndex((o) => o.value === choice) + 1) % OPTIONS.length;
  const next = OPTIONS[nextIndex];

  return (
    <button
      type="button"
      className={className ? `theme-trigger ${className}` : "theme-trigger"}
      onClick={() => select(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`Theme: ${current.label}`}
    >
      <span className="theme-trigger__icon" aria-hidden="true">
        {current.icon}
      </span>
    </button>
  );
}

// ── NavItem (client) ───────────────────────────────────────────────────────
// Co-located here (an existing client module) so AppShell can stay a SERVER
// component. Wraps next/link and, via a nested useLinkStatus() reader, shows an
// in-flight spinner + aria-busy while a slow route resolves (S1) so navigation
// feels acknowledged like the workbench buttons. Carries a leading icon so the
// active state is icon + colour + position, never colour alone (icon + text law).

interface NavItemProps {
  href: string;
  className: string;
  icon: ReactNode;
  isActive: boolean;
  children: ReactNode;
  /** Stack the icon above the label (mobile bottom-nav tab layout). */
  stacked?: boolean;
}

export function NavItem({ href, className, icon, isActive, children, stacked }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`${className}${isActive ? " is-active" : ""}${stacked ? " is-stacked" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      <NavItemInner icon={icon}>{children}</NavItemInner>
    </Link>
  );
}

// Must be a descendant of <Link> for useLinkStatus() to report this link's
// navigation state.
function NavItemInner({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span className="nav-item__row" aria-busy={pending || undefined}>
      <span className="nav-item__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-item__label">{children}</span>
      {pending ? (
        <span className="nav-item__spinner" aria-hidden="true" />
      ) : null}
    </span>
  );
}
