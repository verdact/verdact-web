import { tryDecryptToken, type DecryptResult, type DecryptErrorCode } from './crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionTokenResult {
  /** The decrypted plaintext token, or null if decryption failed. */
  token: string | null;
  /** Whether a valid token was retrieved successfully. */
  valid: boolean;
  /** If invalid, the error code from the decryption attempt. */
  errorCode?: DecryptErrorCode;
  /** If invalid, a human-readable error message. */
  errorMessage?: string;
  /** Whether the calling code should mark this connection as revoked. */
  shouldRevoke: boolean;
}

// Error codes that indicate the token envelope is permanently unrecoverable.
// The connection should be marked as revoked so the user sees a reconnect prompt.
const REVOCABLE_ERRORS: Set<DecryptErrorCode> = new Set([
  'MALFORMED_ENVELOPE',
  'AUTH_FAILED',
  'UNKNOWN_KEY_VERSION',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Safely retrieves a decrypted token from an encrypted envelope + key version.
 *
 * If decryption fails, this function returns a structured result instead of
 * throwing, so calling code can:
 *   1. Show a "reconnect" prompt to the user.
 *   2. Optionally mark the connection as `status = 'revoked'` in the DB.
 *   3. Log the failure for audit/alerting without crashing the request.
 *
 * @param envelope     The encrypted token envelope (from a `*_encrypted` column).
 * @param keyVersion   The key version (from the `token_key_version` column).
 * @param connectionId Optional connection UUID for logging context.
 */
export function resolveConnectionToken(
  envelope: string | null | undefined,
  keyVersion: string | null | undefined,
  connectionId?: string
): ConnectionTokenResult {
  const result = tryDecryptToken(envelope, keyVersion);

  if (result.ok) {
    return {
      token: result.plaintext,
      valid: true,
      shouldRevoke: false,
    };
  }

  // Log server-side for audit trail (non-throwing)
  console.error(
    `[connections] Token decryption failed${connectionId ? ` for connection ${connectionId}` : ''}: ` +
    `code=${result.errorCode} message="${result.error}"`
  );

  return {
    token: null,
    valid: false,
    errorCode: result.errorCode,
    errorMessage: result.error,
    shouldRevoke: REVOCABLE_ERRORS.has(result.errorCode),
  };
}

/**
 * Returns the user-facing status label for a connection based on its DB
 * status and whether its token is decryptable.
 */
export function connectionDisplayStatus(
  dbStatus: string,
  tokenResult: ConnectionTokenResult
): 'connected' | 'expired' | 'revoked' | 'error' {
  if (dbStatus === 'revoked') return 'revoked';
  if (!tokenResult.valid) {
    if (tokenResult.shouldRevoke) return 'revoked';
    if (tokenResult.errorCode === 'MISSING_KEY') return 'error';
    return 'expired';
  }
  return 'connected';
}
