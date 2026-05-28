import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Key Registry — TOKEN ENCRYPTION ONLY
// ---------------------------------------------------------------------------
// These keys are used exclusively for AES-256-GCM encryption of OAuth token
// envelopes (Slack, Gmail). They are NOT the same as VERDACT_SIGNING_KEY_V{n}
// which is reserved for HMAC-SHA256 evidence submission signatures.
//
// Add new versions here when rotating keys. Old versions MUST remain until
// all rows encrypted with them have been re-encrypted to the latest version.
// ---------------------------------------------------------------------------

const KEY_ENV_MAP: Record<string, string> = {
  v1: 'VERDACT_ENCRYPTION_KEY_V1',
  // v2: 'VERDACT_ENCRYPTION_KEY_V2',  — uncomment when rotating
};

/** The version used for all new encryptions. */
export const CURRENT_KEY_VERSION = 'v1';

/** All versions that are still valid for decryption. */
export function supportedKeyVersions(): string[] {
  return Object.keys(KEY_ENV_MAP);
}

/**
 * Returns true if the given version is the latest encryption key version.
 * Useful for identifying rows that need re-encryption after a key rotation.
 */
export function isCurrentKeyVersion(version: string): boolean {
  return version === CURRENT_KEY_VERSION;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getKeyForVersion(version: string): Buffer {
  const envVar = KEY_ENV_MAP[version];
  if (!envVar) {
    throw new Error(
      `Unknown key version "${version}". Supported versions: ${supportedKeyVersions().join(', ')}.`
    );
  }

  const base64Key = process.env[envVar];
  if (!base64Key) {
    throw new Error(
      `Encryption key for version "${version}" is not configured. Set the ${envVar} environment variable.`
    );
  }

  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `Encryption key for version "${version}" must be exactly 32 bytes (256 bits) when decoded from base64. Got ${key.length} bytes.`
    );
  }

  return key;
}

// ---------------------------------------------------------------------------
// Public API — encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext token using AES-256-GCM.
 *
 * @param plaintext The plaintext string to encrypt (e.g., OAuth access/refresh token).
 * @param version   The key version to use. Defaults to {@link CURRENT_KEY_VERSION}.
 * @returns An object containing the base64url-encoded envelope and the key version.
 */
export function encryptToken(
  plaintext: string,
  version: string = CURRENT_KEY_VERSION
): { encryptedText: string; keyVersion: string } {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty or null plaintext.');
  }

  const key = getKeyForVersion(version);
  const iv = crypto.randomBytes(12); // 96-bit IV per NIST SP 800-38D
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  const envelope = [iv, tag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');

  return {
    encryptedText: envelope,
    keyVersion: version,
  };
}

/**
 * Decrypts a token envelope using AES-256-GCM.
 *
 * @param envelope The dot-separated encryption envelope (iv.tag.ciphertext).
 * @param version  The key version used when the token was encrypted.
 * @returns The decrypted plaintext string.
 * @throws {Error} If the envelope is malformed, the key is missing, or authentication fails.
 */
export function decryptToken(envelope: string, version: string): string {
  if (!envelope) {
    throw new Error('Cannot decrypt empty or null envelope.');
  }

  const parts = envelope.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encryption envelope format. Expected [iv].[tag].[ciphertext].');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Corrupted encryption envelope: missing parts.');
  }

  const key = getKeyForVersion(version);

  try {
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(ciphertextB64, 'base64url');

    if (iv.length !== 12) {
      throw new Error('Invalid initialization vector length.');
    }
    if (tag.length !== 16) {
      throw new Error('Invalid authentication tag length.');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error: any) {
    throw new Error(`Token decryption failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Public API — safe decryption (Improvement C)
// ---------------------------------------------------------------------------

export type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; error: string; errorCode: DecryptErrorCode };

export type DecryptErrorCode =
  | 'EMPTY_ENVELOPE'
  | 'MALFORMED_ENVELOPE'
  | 'UNKNOWN_KEY_VERSION'
  | 'MISSING_KEY'
  | 'AUTH_FAILED'
  | 'DECRYPTION_ERROR';

/**
 * Attempts to decrypt a token envelope without throwing.
 * Returns a discriminated union so callers can react gracefully
 * (e.g., marking the connection as revoked/expired instead of crashing).
 */
export function tryDecryptToken(
  envelope: string | null | undefined,
  version: string | null | undefined
): DecryptResult {
  if (!envelope) {
    return { ok: false, error: 'Envelope is empty or null.', errorCode: 'EMPTY_ENVELOPE' };
  }
  if (!version) {
    return { ok: false, error: 'Key version is empty or null.', errorCode: 'UNKNOWN_KEY_VERSION' };
  }

  const parts = envelope.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, error: 'Malformed encryption envelope.', errorCode: 'MALFORMED_ENVELOPE' };
  }

  const envVar = KEY_ENV_MAP[version];
  if (!envVar) {
    return {
      ok: false,
      error: `Unknown key version "${version}".`,
      errorCode: 'UNKNOWN_KEY_VERSION',
    };
  }
  if (!process.env[envVar]) {
    return {
      ok: false,
      error: `Encryption key for version "${version}" is not set in environment.`,
      errorCode: 'MISSING_KEY',
    };
  }

  try {
    const plaintext = decryptToken(envelope, version);
    return { ok: true, plaintext };
  } catch (error: any) {
    const msg: string = error.message ?? 'Unknown decryption error';
    const isAuthFailure =
      msg.includes('Unsupported state') || msg.includes('unable to authenticate');
    return {
      ok: false,
      error: msg,
      errorCode: isAuthFailure ? 'AUTH_FAILED' : 'DECRYPTION_ERROR',
    };
  }
}

// ---------------------------------------------------------------------------
// Public API — re-encryption (Improvement A)
// ---------------------------------------------------------------------------

/**
 * Re-encrypts an existing envelope from an old key version to the current version.
 * Returns null if the envelope is already on the current version.
 *
 * @returns The new envelope + version, or null if already current.
 * @throws  If decryption with the old key fails (caller should mark the row as broken).
 */
export function reEncryptToken(
  envelope: string,
  currentVersion: string
): { encryptedText: string; keyVersion: string } | null {
  if (currentVersion === CURRENT_KEY_VERSION) {
    return null; // Already up to date
  }

  const plaintext = decryptToken(envelope, currentVersion);
  return encryptToken(plaintext, CURRENT_KEY_VERSION);
}
