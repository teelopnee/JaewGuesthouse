/**
 * store.ts
 * Single source of truth for everything the site saves, kept in Cloudflare D1 (see migrations/).
 *  - settings, the booking ledger and the copy of the Jaew Logbook bookings: one JSON document each
 *  - uploaded room photos, daily backups
 * Every save is a compare-and-swap on updated_at: when two saves happen at the same moment, the
 * later one re-reads the newest data and applies its change again, so no change is ever lost.
 */

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export type PricingMode = 'full' | 'weekday_only';

export interface Settings {
  /** '' = no PIN saved yet, the default PIN works (see auth.ts). */
  pinHash: string;
  pinSalt: string;
  isDefaultPin: boolean;
  roomOverrides: Record<string, Record<string, unknown>>;
  guesthouseConfig: Record<string, unknown>;
  pricingMode: PricingMode;
  creativeOverrides: Record<string, Record<string, unknown>>;
  roomImages: Record<string, string[]>;
  updatedAt: string;
}

export interface BookingRecord {
  booking_id: string;
  room_id: string;
  checkin_date: string;
  checkout_date: string;
  [key: string]: unknown;
}

export interface BookingsData {
  bookings: BookingRecord[];
  // IDs of bookings pulled from the external logbook that the admin deleted here.
  deletedIds: string[];
  updatedAt: string;
}

/** Everything a request needs, read in one query. */
export interface Snapshot {
  settings: Settings;
  bookings: BookingsData;
  logbook: unknown;
}

export const DEFAULT_PIN = '1234';

/** Used for documents that were never saved, so the revision stays stable until the first save. */
const NEVER = new Date(0).toISOString();

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function randomHex(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('hex');
}

export function normaliseSettings(raw: unknown): Settings {
  const r = isPlainObject(raw) ? raw : {};
  const s: Settings = {
    pinHash: typeof r.pinHash === 'string' ? r.pinHash : '',
    pinSalt: typeof r.pinSalt === 'string' && r.pinSalt ? r.pinSalt : randomHex(16),
    isDefaultPin: typeof r.isDefaultPin === 'boolean' ? r.isDefaultPin : true,
    roomOverrides: isPlainObject(r.roomOverrides) ? r.roomOverrides : {},
    guesthouseConfig: isPlainObject(r.guesthouseConfig) ? r.guesthouseConfig : {},
    pricingMode: r.pricingMode === 'weekday_only' ? 'weekday_only' : 'full',
    creativeOverrides: isPlainObject(r.creativeOverrides) ? r.creativeOverrides : {},
    roomImages: {},
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : NEVER,
  };
  if (isPlainObject(r.roomImages)) {
    for (const [roomId, imgs] of Object.entries(r.roomImages)) {
      if (Array.isArray(imgs)) {
        const clean = imgs.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
        if (clean.length) s.roomImages[roomId] = clean;
      }
    }
  }
  return s;
}

export function normaliseBookings(raw: unknown): BookingsData {
  const out: BookingsData = { bookings: [], deletedIds: [], updatedAt: NEVER };
  if (Array.isArray(raw)) {
    out.bookings = raw.filter(isValidStoredBooking);
  } else if (isPlainObject(raw)) {
    if (Array.isArray(raw.bookings)) out.bookings = raw.bookings.filter(isValidStoredBooking);
    if (Array.isArray(raw.deletedIds)) out.deletedIds = raw.deletedIds.filter((i: unknown) => typeof i === 'string');
    if (typeof raw.updatedAt === 'string') out.updatedAt = raw.updatedAt;
  }
  return out;
}

function isValidStoredBooking(b: unknown): b is BookingRecord {
  return (
    isPlainObject(b) &&
    typeof b.booking_id === 'string' &&
    typeof b.room_id === 'string' &&
    typeof b.checkin_date === 'string' &&
    typeof b.checkout_date === 'string'
  );
}

function parseDoc(key: string, value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    // Never overwrite a document we could not read - that would lose it.
    throw new Error(`[store] Document "${key}" is damaged and was left untouched`);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function loadSnapshot(db: D1Database): Promise<Snapshot> {
  const { results } = await db
    .prepare("SELECT key, value FROM docs WHERE key IN ('settings', 'bookings', 'logbook')")
    .all<{ key: string; value: string }>();
  const raw: Record<string, unknown> = {};
  for (const row of results) raw[row.key] = parseDoc(row.key, row.value);
  return {
    settings: normaliseSettings(raw.settings),
    bookings: normaliseBookings(raw.bookings),
    logbook: raw.logbook,
  };
}

/** A save time that is always later than the previous one, so the revision always moves forward. */
function nextTimestamp(previous: string | undefined): string {
  const prev = previous ? Date.parse(previous) || 0 : 0;
  return new Date(Math.max(Date.now(), prev + 1)).toISOString();
}

/**
 * Reads a document, lets `mutator` change it and saves it. If someone else saved in between,
 * starts over with their version. Returns the saved document.
 */
export async function updateDoc<T extends { updatedAt: string }>(
  db: D1Database,
  key: string,
  normalise: (raw: unknown) => T,
  mutator: (draft: T) => void
): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await db
      .prepare('SELECT value, updated_at FROM docs WHERE key = ?')
      .bind(key)
      .first<{ value: string; updated_at: string }>();
    const draft = normalise(row ? parseDoc(key, row.value) : undefined);
    mutator(draft);
    draft.updatedAt = nextTimestamp(row?.updated_at);
    const value = JSON.stringify(draft);
    const result = row
      ? await db
          .prepare('UPDATE docs SET value = ?, updated_at = ? WHERE key = ? AND updated_at = ?')
          .bind(value, draft.updatedAt, key, row.updated_at)
          .run()
      : await db
          .prepare('INSERT OR IGNORE INTO docs (key, value, updated_at) VALUES (?, ?, ?)')
          .bind(key, value, draft.updatedAt)
          .run();
    if (result.meta.changes === 1) return draft;
  }
  throw new Error(`[store] Could not save "${key}": too many saves at the same time`);
}

/** Replaces a whole document (data import only). */
export async function putDoc(db: D1Database, key: string, doc: { updatedAt: string }) {
  await db
    .prepare('INSERT OR REPLACE INTO docs (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(key, JSON.stringify(doc), doc.updatedAt)
    .run();
}

export function updateSettings(db: D1Database, mutator: (s: Settings) => void) {
  return updateDoc(db, 'settings', normaliseSettings, mutator);
}

export function updateBookings(db: D1Database, mutator: (d: BookingsData) => void) {
  return updateDoc(db, 'bookings', normaliseBookings, (d) => {
    mutator(d);
    // Keep the tombstone list bounded.
    if (d.deletedIds.length > 5000) d.deletedIds = d.deletedIds.slice(-5000);
  });
}

// ---------------------------------------------------------------------------
// Uploaded images
// ---------------------------------------------------------------------------

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export const PHOTO_NAME = /^[a-f0-9]{24}\.(jpg|png|webp|gif)$/;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** base64 characters per row: D1 rows are limited to 2 MB. */
const PART_CHARS = 1_800_000;

export function photoName(bytes: Uint8Array, ext: string): string {
  return `${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${ext}`;
}

/** Saves a photo. The same name always means the same content, so saving twice is harmless. */
export async function putPhoto(db: D1Database, name: string, base64: string, replace = false) {
  const contentType = EXT_MIME[name.split('.').pop() || ''] || 'application/octet-stream';
  const now = Date.now();
  const verb = replace ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
  const statements: D1PreparedStatement[] = [];
  for (let i = 0, part = 0; i < base64.length; i += PART_CHARS, part++) {
    statements.push(
      db
        .prepare(`${verb} INTO photos (name, part, content_type, data, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(name, part, contentType, base64.slice(i, i + PART_CHARS), now)
    );
  }
  if (replace) statements.push(db.prepare('DELETE FROM photos WHERE name = ? AND part >= ?').bind(name, statements.length));
  await db.batch(statements);
}

export async function getPhoto(db: D1Database, name: string): Promise<{ contentType: string; bytes: Uint8Array } | null> {
  const { results } = await db
    .prepare('SELECT content_type, data FROM photos WHERE name = ? ORDER BY part')
    .bind(name)
    .all<{ content_type: string; data: string }>();
  if (!results.length) return null;
  const base64 = results.length === 1 ? results[0].data : results.map((r) => r.data).join('');
  return { contentType: results[0].content_type, bytes: Buffer.from(base64, 'base64') };
}

/** Saves a data: URL as a photo and returns its public URL. */
export async function saveDataUrlImage(db: D1Database, dataUrl: string): Promise<string> {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error('รูปแบบไฟล์รูปภาพไม่ถูกต้อง');
  const ext = MIME_EXT[match[1].toLowerCase()];
  if (!ext) throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('ไฟล์รูปภาพว่างเปล่า');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('ไฟล์รูปภาพใหญ่เกิน 8MB');
  const name = photoName(buffer, ext);
  await putPhoto(db, name, buffer.toString('base64'));
  return `/uploads/${name}`;
}

// ---------------------------------------------------------------------------
// Automatic daily backups (table backups, last 30 days kept) and photo clean-up
// ---------------------------------------------------------------------------

const KEEP_BACKUP_DAYS = 30;

/** Today's date in Thailand, e.g. "2026-11-03". */
export function thaiDateStamp(d = new Date()): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Makes today's backup if it doesn't exist yet and removes backups older than 30 days. */
export async function runDailyBackup(db: D1Database) {
  const { settings, bookings } = await loadSnapshot(db);
  const day = thaiDateStamp();
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO backups (day, settings, bookings, created_at) VALUES (?, ?, ?, ?)')
      .bind(day, JSON.stringify(settings), JSON.stringify(bookings), new Date().toISOString()),
    db
      .prepare('DELETE FROM backups WHERE day NOT IN (SELECT day FROM backups ORDER BY day DESC LIMIT ?)')
      .bind(KEEP_BACKUP_DAYS),
  ]);
  console.log(`[store] Daily backup checked: ${day}`);
}

/** Remove uploaded photos no room uses any more (only ones older than a day, so in-progress edits are safe). */
export async function cleanupUnusedUploads(db: D1Database) {
  const used = new Set<string>();
  const collect = (roomImages: unknown) => {
    if (!isPlainObject(roomImages)) return;
    Object.values(roomImages).forEach((imgs) => {
      if (!Array.isArray(imgs)) return;
      imgs.forEach((i) => {
        if (typeof i === 'string' && i.startsWith('/uploads/')) used.add(i.slice('/uploads/'.length));
      });
    });
  };
  const { settings } = await loadSnapshot(db);
  collect(settings.roomImages);
  // Photos still referenced by a daily backup are kept too, so restoring a backup never loses photos.
  const { results: backups } = await db.prepare('SELECT settings FROM backups').all<{ settings: string }>();
  for (const b of backups) {
    try {
      collect(JSON.parse(b.settings).roomImages);
    } catch {
      // unreadable backup - ignore
    }
  }
  const { results: photos } = await db
    .prepare('SELECT name, MIN(created_at) AS created_at FROM photos GROUP BY name')
    .all<{ name: string; created_at: number }>();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const unused = photos.filter((p) => !used.has(p.name) && p.created_at < dayAgo).map((p) => p.name);
  for (let i = 0; i < unused.length; i += 90) {
    const names = unused.slice(i, i + 90);
    await db
      .prepare(`DELETE FROM photos WHERE name IN (${names.map(() => '?').join(', ')})`)
      .bind(...names)
      .run();
  }
  if (unused.length) console.log(`[store] Removed ${unused.length} unused photo(s)`);
}
