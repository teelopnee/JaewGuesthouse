/**
 * bookings.ts
 * Booking records = bookings saved by the admin here + bookings pulled from the
 * external Jaew Logbook app (if reachable). Local edits always win.
 * The pulled copy is kept in D1 and refreshed at most every 15 seconds while people use the site.
 */

import { Env } from './http';
import { BookingRecord, BookingsData } from './store';

const DEFAULT_LOGBOOK_URL = 'https://jaewlogbook.ai.studio/api/bookings';
const SYNC_INTERVAL_MS = 15_000;
/** A copy older than this is refreshed before answering, so customers never see old availability. */
export const MAX_STALE_MS = 2 * 60_000;

export interface LogbookCache {
  bookings: BookingRecord[];
  ok: boolean;
  /** Last time a refresh was started (ms). */
  lastAttemptAt: number;
  /** Last time a refresh succeeded and was saved (ms). */
  lastSyncAt: number;
  /** Last time the bookings or the ok status changed (ms) - part of the page revision. */
  changedAt: number;
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const num0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function normaliseLogbook(raw: unknown): LogbookCache {
  const r = isPlainObject(raw) ? raw : {};
  return {
    bookings: Array.isArray(r.bookings) ? r.bookings : [],
    ok: r.ok === true,
    lastAttemptAt: num0(r.lastAttemptAt),
    lastSyncAt: num0(r.lastSyncAt),
    changedAt: num0(r.changedAt),
  };
}

export function logbookUrl(env: Env): string {
  return env.LOGBOOK_URL !== undefined ? env.LOGBOOK_URL : DEFAULT_LOGBOOK_URL;
}

async function fetchLogbook(url: string): Promise<BookingRecord[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Logbook did not return a list');
    return data
      .filter(
        (b: any) =>
          b &&
          typeof b === 'object' &&
          b.booking_id !== undefined &&
          b.room_id !== undefined &&
          isIsoDate(b.checkin_date) &&
          isIsoDate(b.checkout_date)
      )
      .map((b: any) => ({ ...b, booking_id: String(b.booking_id), room_id: String(b.room_id) }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refreshes the logbook copy if it is older than 15 seconds and returns the new copy, or null
 * when there was nothing to do. Only one request refreshes at a time: it first claims the refresh
 * by moving lastAttemptAt forward, and only saves its result while it still holds that claim.
 */
export async function syncFromLogbook(env: Env, cache: LogbookCache): Promise<LogbookCache | null> {
  const url = logbookUrl(env);
  const now = Date.now();
  if (!url || now - cache.lastAttemptAt < SYNC_INTERVAL_MS) return null;

  const db = env.DB;
  const stamp = new Date(now).toISOString();
  const claimed: LogbookCache = { ...cache, lastAttemptAt: now };
  const claim = await db
    .prepare(
      `INSERT INTO docs (key, value, updated_at) VALUES ('logbook', ?1, ?2)
       ON CONFLICT (key) DO UPDATE SET value = ?1, updated_at = ?2
       WHERE COALESCE(json_extract(docs.value, '$.lastAttemptAt'), 0) = ?3`
    )
    .bind(JSON.stringify(claimed), stamp, cache.lastAttemptAt)
    .run();
  if (claim.meta.changes !== 1) return null; // another request is already refreshing

  let next: LogbookCache | null = null;
  try {
    const bookings = await fetchLogbook(url);
    if (!cache.ok || JSON.stringify(bookings) !== JSON.stringify(cache.bookings)) {
      next = { bookings, ok: true, lastAttemptAt: now, lastSyncAt: now, changedAt: now };
    }
  } catch {
    // Keep the last good copy; the logbook is optional.
    if (cache.ok) next = { ...cache, ok: false, lastAttemptAt: now, lastSyncAt: cache.lastAttemptAt, changedAt: now };
  }
  if (!next) return claimed;
  await db
    .prepare(
      `UPDATE docs SET value = ?, updated_at = ? WHERE key = 'logbook' AND json_extract(value, '$.lastAttemptAt') = ?`
    )
    .bind(JSON.stringify(next), new Date().toISOString(), now)
    .run();
  return next;
}

export function getSyncStatus(env: Env, cache: LogbookCache) {
  const last = cache.ok ? cache.lastAttemptAt : cache.lastSyncAt;
  return {
    enabled: Boolean(logbookUrl(env)),
    ok: cache.ok,
    lastSyncTime: last ? new Date(last).toISOString() : null,
    bookingCount: cache.bookings.length,
  };
}

export function getRemoteBooking(cache: LogbookCache, id: string): BookingRecord | undefined {
  return cache.bookings.find((b) => b.booking_id === id);
}

export function getRemoteBookingIds(cache: LogbookCache): string[] {
  return cache.bookings.map((b) => b.booking_id);
}

/** Local bookings first, then logbook bookings that were not edited or deleted here. */
export function getMergedBookings(data: BookingsData, cache: LogbookCache): BookingRecord[] {
  const { bookings, deletedIds } = data;
  const localIds = new Set(bookings.map((b) => b.booking_id));
  const deleted = new Set(deletedIds);
  const remote = cache.bookings.filter((b) => !localIds.has(b.booking_id) && !deleted.has(b.booking_id));
  return [...bookings, ...remote];
}

const PUBLIC_FIELDS = ['booking_id', 'room_id', 'room_number', 'checkin_date', 'checkout_date', 'stay_status'] as const;

/** Customers only need to know which rooms are taken - never names, phones or plates. */
export function toPublicBooking(b: BookingRecord) {
  const out: Record<string, unknown> = {};
  for (const f of PUBLIC_FIELDS) if (b[f] !== undefined) out[f] = b[f];
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function nightsBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : v === undefined || v === null ? '' : String(v).trim().slice(0, max);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

const PAYMENT_STATUSES = new Set(['pending', 'deposit_paid', 'fully_paid', 'cancelled']);
const STAY_STATUSES = new Set(['จองล่วงหน้า', 'กำลังพัก', 'เช็คเอาท์แล้ว', 'ยกเลิก']);

/**
 * Validates and normalises booking fields. `base` is the existing record for updates.
 * Throws an Error with a Thai message when the input is unusable.
 */
export function buildBooking(input: Record<string, unknown>, base?: BookingRecord): BookingRecord {
  const merged: Record<string, unknown> = { ...(base || {}), ...input };

  const room_id = str(merged.room_id, 100);
  const checkin_date = str(merged.checkin_date, 10);
  const checkout_date = str(merged.checkout_date, 10);
  if (!room_id) throw new Error('กรุณาเลือกห้องพัก');
  if (!isIsoDate(checkin_date) || !isIsoDate(checkout_date)) throw new Error('วันที่เช็คอิน/เช็คเอาท์ไม่ถูกต้อง');
  const nights = nightsBetween(checkin_date, checkout_date);
  if (nights < 1) throw new Error('วันเช็คเอาท์ต้องอยู่หลังวันเช็คอินอย่างน้อย 1 คืน');
  if (nights > 365) throw new Error('ระยะเวลาเข้าพักยาวเกินไป (สูงสุด 365 คืน)');

  const actual_price = num(merged.actual_price);
  const deposit_amount = num(merged.deposit_amount);
  const payment_status = PAYMENT_STATUSES.has(String(merged.payment_status)) ? String(merged.payment_status) : 'deposit_paid';
  const stay_status = STAY_STATUSES.has(String(merged.stay_status)) ? String(merged.stay_status) : 'จองล่วงหน้า';
  const now = new Date().toISOString();

  return {
    ...(base || {}),
    booking_id: base?.booking_id || `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    room_id,
    room_number: str(merged.room_number, 100) || room_id,
    guest_name: str(merged.guest_name, 120) || 'ลูกค้าทั่วไป',
    phone: str(merged.phone, 40),
    license_plate: str(merged.license_plate, 60),
    guest_count: Math.max(1, Math.min(50, num(merged.guest_count, 2) || 2)),
    booking_channel: str(merged.booking_channel, 40) || 'LINE OA',
    checkin_date,
    checkin_time: str(merged.checkin_time, 10) || '14:00',
    checkout_date,
    checkout_time: str(merged.checkout_time, 10) || '12:00',
    nights,
    actual_price,
    deposit_amount,
    remaining_amount: payment_status === 'fully_paid' ? 0 : Math.max(0, actual_price - deposit_amount),
    payment_status,
    notes: str(merged.notes, 1000),
    stay_status,
    created_at: typeof base?.created_at === 'string' ? base.created_at : now,
    updated_at: now,
  };
}
