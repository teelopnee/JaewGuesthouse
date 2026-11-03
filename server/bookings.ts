/**
 * bookings.ts
 * Booking records = bookings saved by the admin here + bookings pulled from the
 * external Jaew Logbook app (if reachable). Local edits always win.
 */

import { BookingRecord, getBookingsData, bumpRevision } from './store';

const LOGBOOK_URL =
  process.env.LOGBOOK_URL !== undefined ? process.env.LOGBOOK_URL : 'https://jaewlogbook.ai.studio/api/bookings';
const SYNC_INTERVAL_MS = 15_000;

let remoteBookings: BookingRecord[] = [];
let lastSyncAt = 0;
let lastSyncOk = false;
let remoteSignature = '';

export async function syncFromLogbook(): Promise<void> {
  if (!LOGBOOK_URL) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(LOGBOOK_URL, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Logbook did not return a list');
    const clean = data
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
    const signature = JSON.stringify(clean);
    if (signature !== remoteSignature) {
      remoteSignature = signature;
      remoteBookings = clean;
      bumpRevision();
    }
    lastSyncAt = Date.now();
    if (!lastSyncOk) bumpRevision();
    lastSyncOk = true;
  } catch {
    // Keep the last good copy; the logbook is optional.
    if (lastSyncOk) bumpRevision();
    lastSyncOk = false;
  } finally {
    clearTimeout(timer);
  }
}

export function startLogbookSync() {
  if (!LOGBOOK_URL) {
    console.log('[bookings] External logbook sync disabled');
    return;
  }
  syncFromLogbook();
  setInterval(syncFromLogbook, SYNC_INTERVAL_MS).unref();
}

export function getSyncStatus() {
  return {
    enabled: Boolean(LOGBOOK_URL),
    ok: lastSyncOk,
    lastSyncTime: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
    bookingCount: remoteBookings.length,
  };
}

export function getRemoteBooking(id: string): BookingRecord | undefined {
  return remoteBookings.find((b) => b.booking_id === id);
}

export function getRemoteBookingIds(): string[] {
  return remoteBookings.map((b) => b.booking_id);
}

/** Local bookings first, then logbook bookings that were not edited or deleted here. */
export function getMergedBookings(): BookingRecord[] {
  const { bookings, deletedIds } = getBookingsData();
  const localIds = new Set(bookings.map((b) => b.booking_id));
  const deleted = new Set(deletedIds);
  const remote = remoteBookings.filter((b) => !localIds.has(b.booking_id) && !deleted.has(b.booking_id));
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
