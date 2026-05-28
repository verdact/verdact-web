// Inline icon set for the dashboard overview, matching the wireframe v2
// workbench stroke style (2.2-3 stroke, round caps/joins). Pure SVG, no
// interactivity, so these render fine inside the server component tree.
//
// Every status icon here is paired with a text label at the call site so
// state is never conveyed by color alone.

type IconProps = {
  className?: string;
};

function Svg({
  className,
  children,
  strokeWidth = 2.4,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={3}>
      <path d="m5 12 5 5L20 7" />
    </Svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.8}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </Svg>
  );
}

export function InfoCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.6}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function PlugIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.2}>
      <path d="M9 4a2 2 0 1 0-2 2h2zM4 9a2 2 0 1 0 2 2V9zm11 11a2 2 0 1 0 2-2h-2zm5-5a2 2 0 1 0-2-2v2z" />
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.2}>
      <path d="M12 2 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.2}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function DocIcon({ className }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </Svg>
  );
}
