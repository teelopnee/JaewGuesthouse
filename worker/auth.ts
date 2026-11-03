/**
 * auth.ts
 * Admin PIN login. The PIN is saved as a keyed hash (HMAC-SHA256 with PIN_PEPPER, a Cloudflare
 * secret), so the saved hash is useless to anyone who doesn't also have the secret.
 * PINs saved by the old Railway version (scrypt) keep working and are upgraded on the first login.
 * A successful login returns a token signed with TOKEN_SECRET (also a Cloudflare secret) that every
 * admin request must send as "Authorization: Bearer <token>". Changing the PIN invalidates every token.
 */

import { Buffer } from 'node:buffer';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { Env, HttpError } from './http';
import { DEFAULT_PIN, Settings } from './store';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // stay signed in for 30 days

function requireSecret(env: Env, name: 'TOKEN_SECRET' | 'PIN_PEPPER'): string {
  const value = env[name];
  if (typeof value !== 'string' || value.length < 32) {
    console.error(`[auth] Cloudflare secret ${name} is missing or too short`);
    throw new HttpError(500, 'ระบบยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลเว็บ');
  }
  return value;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function hashPin(env: Env, pin: string, salt: string): string {
  return `v2:${createHmac('sha256', requireSecret(env, 'PIN_PEPPER')).update(`${salt}:${pin}`).digest('hex')}`;
}

/** The Railway version saved scrypt hashes: 64 hex characters. */
function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

export function checkPin(env: Env, s: Settings, pin: string): boolean {
  if (!s.pinHash) return safeEqual(pin, DEFAULT_PIN);
  const given = isLegacyHash(s.pinHash) ? scryptSync(pin, s.pinSalt, 32).toString('hex') : hashPin(env, pin, s.pinSalt);
  return safeEqual(given, s.pinHash);
}

/** True when the saved PIN should be re-saved in the current format after a correct login. */
export function pinNeedsUpgrade(s: Settings): boolean {
  return !s.pinHash || isLegacyHash(s.pinHash);
}

function sign(env: Env, payload: string, pinHash: string): string {
  return createHmac('sha256', requireSecret(env, 'TOKEN_SECRET')).update(`${payload}.${pinHash}`).digest('base64url');
}

export function issueToken(env: Env, s: Settings): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(env, payload, s.pinHash)}`, expiresAt };
}

export function isValidToken(env: Env, s: Settings, token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(sign(env, payload, s.pinHash), sig);
}

export function getRequestToken(req: Request): string | undefined {
  const header = req.headers.get('authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

export function isAdminRequest(env: Env, s: Settings, req: Request): boolean {
  return isValidToken(env, s, getRequestToken(req));
}

// ---------------------------------------------------------------------------
// Brute-force protection: 8 wrong PINs within 10 minutes locks that IP for 10 minutes.
// ---------------------------------------------------------------------------

const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function loginLockRemainingMs(db: D1Database, ip: string): Promise<number> {
  const row = await db.prepare('SELECT locked_until FROM login_failures WHERE ip = ?').bind(ip).first<{ locked_until: number }>();
  return row ? Math.max(0, row.locked_until - Date.now()) : 0;
}

export async function recordLoginFailure(db: D1Database, ip: string) {
  // In an UPDATE every column name means the value before this update.
  await db
    .prepare(
      `INSERT INTO login_failures (ip, count, first_at, locked_until) VALUES (?1, 1, ?2, 0)
       ON CONFLICT (ip) DO UPDATE SET
         count = CASE WHEN ?2 - first_at > ?3 THEN 1 ELSE count + 1 END,
         first_at = CASE WHEN ?2 - first_at > ?3 THEN ?2 ELSE first_at END,
         locked_until = CASE WHEN ?2 - first_at > ?3 THEN 0 WHEN count + 1 >= ?4 THEN ?2 + ?3 ELSE locked_until END`
    )
    .bind(ip, Date.now(), WINDOW_MS, MAX_FAILURES)
    .run();
}

export async function clearLoginFailures(db: D1Database, ip: string) {
  await db.prepare('DELETE FROM login_failures WHERE ip = ?').bind(ip).run();
}

export async function cleanupLoginFailures(db: D1Database) {
  const now = Date.now();
  await db.prepare('DELETE FROM login_failures WHERE first_at < ? AND locked_until < ?').bind(now - WINDOW_MS, now).run();
}
