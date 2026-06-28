'use client';

import { useState } from 'react';
import s from '../admin.module.css';

// Shared, fully-typed client-side table sorting for the admin tables. All
// comparators return a NEW array (never mutate) and keep null/empty values
// pinned last regardless of direction.

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string> = { key: K; dir: SortDir };

/**
 * Sort state with a single toggle: clicking the active column flips direction,
 * clicking a new column selects it ascending.
 */
export function useSortState<K extends string>(
  initial: SortState<K>,
): [SortState<K>, (key: K) => void] {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K): void => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  };
  return [sort, toggle];
}

interface SortThProps<K extends string> {
  sortKey: K;
  label: string;
  state: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortTh<K extends string>({
  sortKey,
  label,
  state,
  onSort,
  className,
  align = 'left',
}: SortThProps<K>) {
  const active = state.key === sortKey;
  const dir = active ? state.dir : undefined;
  return (
    <th
      className={className}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`${s.thSortBtn} ${align === 'right' ? s.thSortBtnRight : ''}`.trim()}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span
          className={`${s.sortChevron} ${active ? s.sortChevronActive : ''}`.trim()}
          aria-hidden="true"
        >
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

// ── Pure comparators (immutable; nulls/empties always last) ──────────────────

export function sortByString<T>(
  rows: ReadonlyArray<T>,
  get: (row: T) => string | null | undefined,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    const aEmpty = !av;
    const bEmpty = !bv;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const base = av.localeCompare(bv);
    return dir === 'asc' ? base : -base;
  });
}

export function sortByNumber<T>(
  rows: ReadonlyArray<T>,
  get: (row: T) => number | null | undefined,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => {
    const av = get(a);
    const bv = get(b);
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    const base = av - bv;
    return dir === 'asc' ? base : -base;
  });
}

/** Parse an ISO date string to epoch ms, or null when absent/invalid. */
export function parseDateTs(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}
