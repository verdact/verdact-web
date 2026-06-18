/**
 * Lightweight in-memory rate limiter + IP hashing for the public /audit endpoint.
 *
 * This is a best-effort, single-instance limiter — it is NOT a distributed rate
 * limiter and resets on cold start. It exists to blunt casual abuse of the
 * no-auth endpoint without adding infra. For production-grade limits, front the
 * route with the platform's edge rate limiting. Deliberately dependency-free.
 */

import { createHash } from 'node:crypto';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 8; // per IP per window — generous for a one-shot tool

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  // Opportunistic sweep so the map does not grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Derive a client key from request headers. Returns a salted hash, never the
 * raw IP, so nothing identifiable is stored or logged.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for') ?? '';
  const realIp = headers.get('x-real-ip') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || realIp || 'unknown';
  return hashIp(ip);
}

// Public fallback used only outside production so local dev / preview do not
// require the secret. In production a missing salt is a misconfiguration: the
// salt is what makes hashed IPs non-reversible, so we refuse to silently fall
// back to a value that is committed to the repo.
const DEFAULT_AUDIT_IP_SALT = 'verdact-audit-default-salt';
let warnedMissingSalt = false;

function resolveAuditIpSalt(): string {
  const salt = process.env.AUDIT_IP_SALT;
  if (salt) return salt;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUDIT_IP_SALT is required in production to hash client IPs.');
  }

  if (!warnedMissingSalt) {
    console.warn('[audit] AUDIT_IP_SALT is not set — using the public default salt (non-production only).');
    warnedMissingSalt = true;
  }
  return DEFAULT_AUDIT_IP_SALT;
}

export function hashIp(ip: string): string {
  const salt = resolveAuditIpSalt();
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
