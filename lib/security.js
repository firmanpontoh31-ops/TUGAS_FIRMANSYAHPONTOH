import crypto from 'node:crypto';

/** Hash kata sandi dengan scrypt + salt acak. Format: salt:hash */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Verifikasi kata sandi terhadap hash tersimpan (timing-safe). */
export function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const calc = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (calc.length !== expected.length) return false;
  return crypto.timingSafeEqual(calc, expected);
}

/** Token acak untuk sesi admin. */
export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Pembatas percobaan login (rate limiting sederhana di memori).
 * Melindungi endpoint login dari percobaan berulang yang tidak wajar.
 */
export class LoginRateLimiter {
  constructor({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  #get(key, now) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (now - entry.firstAt > this.windowMs) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  /** @returns {null | {retryAfterSec:number}} null bila masih diperbolehkan. */
  check(key) {
    const now = Date.now();
    const entry = this.#get(key, now);
    if (!entry || entry.count < this.maxAttempts) return null;
    const retryAfterMs = this.windowMs - (now - entry.firstAt);
    return { retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recordFailure(key) {
    const now = Date.now();
    const entry = this.#get(key, now);
    if (entry) entry.count += 1;
    else this.entries.set(key, { count: 1, firstAt: now });
  }

  reset(key) {
    this.entries.delete(key);
  }

  /** Bersihkan entri kedaluwarsa secara berkala. */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.firstAt > this.windowMs) this.entries.delete(key);
    }
  }
}
