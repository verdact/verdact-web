// Derives how Verdact addresses the person (not the company). Greets with the
// first token of their name from auth user_metadata.full_name, falling back to
// the email local-part. Never uses the business/company name.

export function firstNameFrom(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = (fullName ?? '').trim();
  if (trimmedName) {
    const firstToken = trimmedName.split(/\s+/)[0];
    if (firstToken) return firstToken;
  }

  const localPart = (email ?? '').split('@')[0]?.trim();
  if (localPart) return localPart;

  return 'there';
}
