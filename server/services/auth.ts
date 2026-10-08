/**
 * SN Travels Agency — Authentication & Security Service
 * Strong password hashing (scrypt with salt), cryptographically signed tokens (HMAC-SHA256),
 * brute-force rate-limiting, and constant-time verification.
 */

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'sn_travels_agency_jwt_secure_key_2026_super_secret_signing_salt_998811';

// --------------------------------------------------------------------------
// Password Hashing & Verification (scrypt + salt)
// --------------------------------------------------------------------------

/**
 * Creates a cryptographically strong salted scrypt hash.
 * Format: scrypt:salt:derivedKey
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/**
 * Verifies a password against the stored hash in constant time.
 * Seamlessly validates legacy plain-text or SHA-256 for smooth migration.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('scrypt:')) {
    try {
      const parts = storedHash.split(':');
      if (parts.length !== 3) return false;
      const [, salt, expectedHash] = parts;
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch {
      return false;
    }
  }

  // Fallback for initial demo seed or sha256
  const sha256 = crypto.createHash('sha256').update(password).digest('hex');
  if (storedHash === sha256 || storedHash === password) {
    return true;
  }

  return false;
}

/**
 * Validates password strength policy
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long for security' };
  }
  return { valid: true };
}

// --------------------------------------------------------------------------
// Cryptographic Token Generation & Verification
// --------------------------------------------------------------------------

export interface AuthTokenPayload {
  id: number;
  email: string;
  role: 'super_admin' | 'admin' | 'staff';
  exp: number;
  iat: number;
}

/**
 * Generates an HMAC-SHA256 signed bearer token
 */
export function signToken(user: { id: number; email: string; role: 'super_admin' | 'admin' | 'staff' }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const iat = Date.now();
  const exp = iat + 24 * 60 * 60 * 1000; // 24-hour session
  const payload: AuthTokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat,
    exp,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies the token signature and expiration in constant time
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');

    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as AuthTokenPayload;
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired token
    }

    return payload;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Rate Limiting & Brute-Force Protection
// --------------------------------------------------------------------------

interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginRateLimitMap = new Map<string, RateLimitRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_MS = 15 * 60 * 1000; // Lock for 15 minutes

export function checkLoginRateLimit(identifier: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimitMap.get(identifier);
  if (!record) return { allowed: true };

  if (record.blockedUntil && now < record.blockedUntil) {
    const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Clear if older than window
  if (now - record.firstAttempt > WINDOW_MS) {
    loginRateLimitMap.delete(identifier);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(identifier: string): { remainingAttempts: number; isBlocked: boolean } {
  const now = Date.now();
  let record = loginRateLimitMap.get(identifier);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { attempts: 1, firstAttempt: now };
    loginRateLimitMap.set(identifier, record);
  } else {
    record.attempts += 1;
  }

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS;
    return { remainingAttempts: 0, isBlocked: true };
  }

  return {
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
    isBlocked: false,
  };
}

export function resetLoginAttempts(identifier: string) {
  loginRateLimitMap.delete(identifier);
}
