import crypto from 'crypto';

export const REVIEWER_COOKIE = 'verdact_reviewer_session';
export const GOOGLE_STATE_COOKIE = 'verdact_google_oauth_state';
export const GMAIL_REVIEWER_COOKIE = 'verdact_gmail_reviewer';
export const GMAIL_TOKEN_COOKIE = 'verdact_gmail_token';

export function appBaseUrl(requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return configured;
  }

  if (requestUrl) {
    const url = new URL(requestUrl);
    return url.origin;
  }

  return 'http://localhost:3000';
}

export function isProductionUrl(url: string) {
  return url.startsWith('https://');
}

export function reviewerCodeIsValid(value: FormDataEntryValue | null) {
  const expected = process.env.REVIEWER_ACCESS_CODE?.trim();
  // Fail closed: with no access code configured, the reviewer path is locked.
  if (!expected) {
    return false;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const provided = value.trim();
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');

  // Length check first: timingSafeEqual throws on unequal-length buffers.
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Returns a same-origin relative path safe to redirect to, or the fallback.
 * Rejects absolute URLs and protocol-relative / backslash tricks (e.g. "//evil.com",
 * "/\evil.com") that resolve to an external origin via new URL(path, base).
 */
export function safeRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return fallback;
  }

  // Resolve against a throwaway origin: any value that escapes to a different
  // host — absolute URL, protocol-relative "//host", literal or %5C-encoded
  // backslash, etc. — changes the hostname and is rejected. Only a value that
  // stays on this origin (a true same-origin relative path) is returned.
  try {
    const sentinel = 'reviewer.invalid';
    const url = new URL(value, `https://${sentinel}`);
    if (url.hostname !== sentinel) {
      return fallback;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function encryptForCookie(value: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to encrypt reviewer cookies.');
  }

  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptFromCookie(value: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return null;
  }

  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) {
    return null;
  }

  try {
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
