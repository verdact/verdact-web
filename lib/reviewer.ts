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
  const expected = process.env.REVIEWER_ACCESS_CODE;
  if (!expected) {
    return true;
  }

  return typeof value === 'string' && value.trim() === expected;
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
