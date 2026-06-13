'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { VerdactLogo } from '../verdact-logo';
import { IconClose, IconMenu } from '../ui/icons';

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'How it works', href: '/#how' },
  { label: 'What it costs', href: '/#plans' },
  { label: 'Account health', href: '/#health' },
  { label: 'Security', href: '/#control' },
];

interface MarketingHeaderProps {
  ctaLabel?: string;
  ctaHref?: string;
}

export function MarketingHeader({
  ctaLabel = 'Start free',
  ctaHref = '/signup',
}: MarketingHeaderProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (drawerOpen && drawerRef.current) {
      const first = drawerRef.current.querySelector<HTMLElement>(
        'a[href],button:not([disabled])'
      );
      first?.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const isActive = (href: string) => {
    const path = href.replace(/\/#.*$/, '');
    return path ? pathname.startsWith(path) : false;
  };

  const drawerVariants = {
    hidden: { x: '100%', opacity: reducedMotion ? 1 : 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: '100%', opacity: reducedMotion ? 1 : 0 },
  };

  return (
    <>
      <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-overlay)' as string,
        background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--rule)',
        borderTop: '3px solid var(--verdict)',
      }}
      role="banner"
    >
      <nav
        className="wrap"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 60,
          gap: 8,
        }}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            flexShrink: 0,
          }}
          aria-label="Verdact home"
        >
          <VerdactLogo variant="mark" className="w-[22px] h-[22px]" />
          <span
            style={{
              fontWeight: 700,
              fontSize: 17,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            Verdact
          </span>
        </Link>

        {/* Desktop nav links */}
        <ul
          role="list"
          style={{
            gap: 28,
            listStyle: 'none',
            margin: '0 0 0 28px',
            padding: 0,
          }}
          className="hidden md:flex"
        >
          {NAV_ITEMS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive(href) ? 'var(--verdict)' : 'var(--ink-2)',
                  textDecoration: 'none',
                  transition: 'color 150ms',
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop CTAs */}
        <div
          style={{
            marginLeft: 'auto',
            alignItems: 'center',
            gap: 8,
          }}
          className="hidden md:flex"
        >
          <Link
            href="/login"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--ink-2)',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              transition: 'color 150ms, background 150ms',
            }}
          >
            Sign in
          </Link>
          <Link
            href={ctaHref}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--paper)',
              background: 'var(--verdict)',
              textDecoration: 'none',
              padding: '7px 18px',
              borderRadius: 6,
              transition: 'background 150ms',
            }}
          >
            {ctaLabel}
          </Link>
        </div>

        {/* Mobile inline CTA (visible in the bar, before the hamburger) */}
        <Link
          href={ctaHref}
          style={{
            marginLeft: 'auto',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--paper)',
            background: 'var(--verdict)',
            textDecoration: 'none',
            padding: '7px 16px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
          }}
          className="inline-flex md:hidden"
        >
          {ctaLabel}
        </Link>

        {/* Mobile hamburger */}
        <button
          ref={triggerRef}
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setDrawerOpen((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            color: 'var(--ink)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="flex md:hidden"
        >
          {drawerOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </nav>
      </header>

      {/* Mobile drawer — portaled to body so the header's backdrop-filter
          (which establishes a containing block for fixed descendants) does not
          collapse the fixed drawer. */}
      {mounted && createPortal(
        <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Scrim */}
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              onClick={closeDrawer}
              style={{
                position: 'fixed',
                inset: 0,
                top: 63,
                zIndex: 'calc(var(--z-overlay) - 1)' as string,
                background: 'rgba(21,16,13,0.3)',
              }}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={drawerRef}
              id="mobile-nav-panel"
              role="dialog"
              aria-label="Navigation menu"
              aria-modal="true"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={drawerVariants}
              transition={{
                type: 'spring',
                stiffness: reducedMotion ? 300 : 200,
                damping: reducedMotion ? 100 : 25,
              }}
              style={{
                position: 'fixed',
                top: 63,
                right: 0,
                bottom: 0,
                width: 'min(320px, 100vw)',
                zIndex: 'var(--z-overlay)' as string,
                background: 'var(--paper)',
                borderLeft: '1px solid var(--rule)',
                display: 'flex',
                flexDirection: 'column',
                padding: '24px 20px',
                gap: 4,
                overflowY: 'auto',
              }}
            >
              <nav aria-label="Mobile navigation">
                <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {NAV_ITEMS.map(({ label, href }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={closeDrawer}
                        style={{
                          display: 'block',
                          padding: '12px 4px',
                          fontSize: 16,
                          fontWeight: 500,
                          color: isActive(href) ? 'var(--verdict)' : 'var(--ink)',
                          textDecoration: 'none',
                          borderBottom: '1px solid var(--rule)',
                        }}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link
                  href="/login"
                  onClick={closeDrawer}
                  style={{
                    display: 'block',
                    padding: '11px 18px',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    textDecoration: 'none',
                    border: '1px solid var(--rule-strong)',
                    borderRadius: 6,
                    textAlign: 'center',
                  }}
                >
                  Sign in
                </Link>
                <Link
                  href={ctaHref}
                  onClick={closeDrawer}
                  style={{
                    display: 'block',
                    padding: '12px 18px',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--paper)',
                    background: 'var(--verdict)',
                    textDecoration: 'none',
                    borderRadius: 6,
                    textAlign: 'center',
                  }}
                >
                  {ctaLabel}
                </Link>
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
