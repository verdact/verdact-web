/**
 * Apply the merchant's CONFIRMED merges to the email-grouped customer list
 * (strategy doc §R8). Pure: it never mutates its inputs.
 *
 * Only `decision === 'merge'` links combine groups; `split` links suppress
 * suggestions (handled by the suggestion engine), they don't combine anything.
 * Union-find folds chains of confirmed merges (A=B, B=C → one group). The
 * canonical identity is the group whose key is the union root, else the
 * most-disputed group in the set.
 */

import type { CustomerGroup } from '@/lib/dal';
import type { IdentityLink } from './types';

export function applyConfirmedMerges(
  groups: CustomerGroup[],
  links: IdentityLink[],
): CustomerGroup[] {
  const merges = links.filter((l) => l.decision === 'merge');
  if (merges.length === 0) return groups;

  // ── Union-find over customer keys ──────────────────────────────────────────
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    // Path-compress for stability.
    let cur = key;
    while (parent.has(cur) && parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const ensure = (key: string) => {
    if (!parent.has(key)) parent.set(key, key);
  };

  for (const g of groups) {
    if (g.customerKey !== null) ensure(g.customerKey);
  }
  for (const m of merges) {
    ensure(m.primaryKey);
    ensure(m.linkedKey);
    const rootPrimary = find(m.primaryKey);
    const rootLinked = find(m.linkedKey);
    if (rootPrimary !== rootLinked) {
      // primary wins as the root of the union.
      parent.set(rootLinked, rootPrimary);
    }
  }

  // ── Bucket linked groups by union root; pass the unlinked bucket through ─────
  const buckets = new Map<string, CustomerGroup[]>();
  const passthrough: CustomerGroup[] = [];
  for (const g of groups) {
    if (g.customerKey === null) {
      passthrough.push(g);
      continue;
    }
    const root = find(g.customerKey);
    const bucket = buckets.get(root) ?? [];
    bucket.push(g);
    buckets.set(root, bucket);
  }

  const merged: CustomerGroup[] = [];
  for (const [root, bucket] of buckets) {
    if (bucket.length === 1) {
      merged.push(bucket[0]);
      continue;
    }
    const canonical =
      bucket.find((g) => g.customerKey === root) ??
      [...bucket].sort((a, b) => b.disputes.length - a.disputes.length)[0];

    const out: CustomerGroup = { ...canonical, disputes: [...canonical.disputes] };
    for (const g of bucket) {
      if (g === canonical) continue;
      out.disputes.push(...g.disputes);
      out.totalAmount += g.totalAmount;
      out.openCount += g.openCount;
      out.wonCount += g.wonCount;
      out.lostCount += g.lostCount;
      if (!out.customerName && g.customerName) out.customerName = g.customerName;
    }
    merged.push(out);
  }

  // Same ordering as the DAL: repeat groups first, then by total amount.
  return [...merged, ...passthrough].sort((a, b) => {
    if (a.disputes.length !== b.disputes.length) return b.disputes.length - a.disputes.length;
    return b.totalAmount - a.totalAmount;
  });
}
