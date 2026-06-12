// Shared email validation + domain-typo suggestion for the auth forms.
// Field-level validation copy approved 2026-06-09 (auth wireframe §errors).
// Suggestion is UI-only: Supabase never verifies the mailbox at signup, so a
// typo'd domain dead-ends at the confirmation email. Catch it at the field.

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

export function validateEmail(value: string): string | undefined {
  if (!value) return 'Enter your email address.';
  if (!EMAIL_SHAPE.test(value)) return 'That email does not look right. Check for typos.';
  return undefined;
}

const POPULAR_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'msn.com',
];

const TLD_TYPOS: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  vom: 'com',
  comm: 'com',
  'co,': 'com',
};

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Returns a corrected full address ("founder@gmail.com") or undefined.
export function suggestEmail(value: string): string | undefined {
  const at = value.lastIndexOf('@');
  if (at < 1) return undefined;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (!domain || POPULAR_DOMAINS.includes(domain)) return undefined;

  const dot = domain.lastIndexOf('.');
  if (dot > 0) {
    const tld = domain.slice(dot + 1);
    const fixedTld = TLD_TYPOS[tld];
    if (fixedTld) {
      const fixed = `${domain.slice(0, dot)}.${fixedTld}`;
      if (POPULAR_DOMAINS.includes(fixed)) return `${local}@${fixed}`;
    }
  }

  let best: string | undefined;
  let bestDist = 3;
  for (const candidate of POPULAR_DOMAINS) {
    const dist = editDistance(domain, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  // Distance 1-2 of a popular domain = almost certainly a typo. Anything
  // further is treated as a legitimate corporate domain — never nag those.
  return best && bestDist <= 2 ? `${local}@${best}` : undefined;
}
