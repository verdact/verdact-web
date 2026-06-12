'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One-shot figure number-roll (design system 3.3): counts up when the figure
 * first scrolls into view. SSR and crawlers see the final value; reduced
 * motion snaps to it.
 */

interface CountUpProps {
  value: number;
  decimals?: number;
  suffix?: string;
}

const ROLL_DURATION_MS = 400;

export function CountUp({ value, decimals = 2, suffix = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasRolled = useRef(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRolled.current) return;
        hasRolled.current = true;
        io.disconnect();
        if (reduced) {
          setDisplay(value);
          return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / ROLL_DURATION_MS, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(value * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
