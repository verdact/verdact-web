'use client';

import { useEffect } from 'react';

/**
 * Arms one-shot rise+fade reveals on every `.reveal-view` element. Elements
 * stay fully visible when JS is unavailable; reduced motion collapses the
 * animation to instant via the global media block.
 */
export function ScrollReveals() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.reveal-view'));
    if (elements.length === 0) return;

    document.documentElement.classList.add('reveals-armed');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );

    elements.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      document.documentElement.classList.remove('reveals-armed');
    };
  }, []);

  return null;
}
