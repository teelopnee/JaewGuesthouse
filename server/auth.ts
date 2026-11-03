/**
 * auth.ts
 * Admin PIN login. The PIN is stored hashed (scrypt). A successful login returns a
 * signed token that every admin request must send as "Authorization: Bearer <token>".
 * Changing the PIN invalidates every existing token.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getSettings, hashPin } from './store';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // stay signed in for 30 days

function sign(payload: string): string {
  const s = getSettings();
  return crypto.createHmac('sha256', s.tokenSecret).update(`${payload}.${s.pinHash}`).digest('base64url');
}

export function issueToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function getRequestToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

export function isAdminRequest(req: Request): boolean {
  return isValidToken(getRequestToken(req));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminRequest(req)) {
    return res.status(401).json({ error: 'เซสชันแอดมินหมดอายุ กรุณาใส่รหัส PIN ใหม่อีกครั้ง', code: 'UNAUTHORIZED' });
  }
  next();
}

export function checkPin(pin: string): boolean {
  const s = getSettings();
  const expected = Buffer.from(s.pinHash, 'hex');
  const given = Buffer.from(hashPin(pin, s.pinSalt), 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// ---------------------------------------------------------------------------
// Brute-force protection: 8 wrong PINs within 10 minutes locks that IP for 10 minutes.
// ---------------------------------------------------------------------------

const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

export function loginLockRemainingMs(ip: string): number {
  const f = failures.get(ip);
  if (!f) return 0;
  return Math.max(0, f.lockedUntil - Date.now());
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  const f = failures.get(ip);
  if (!f || now - f.firstAt > WINDOW_MS) {
    failures.set(ip, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  f.count += 1;
  if (f.count >= MAX_FAILURES) f.lockedUntil = now + WINDOW_MS;
}

export function clearLoginFailures(ip: string) {
  failures.delete(ip);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, f] of failures) {
    if (now - f.firstAt > WINDOW_MS && f.lockedUntil < now) failures.delete(ip);
  }
}, WINDOW_MS).unref();
