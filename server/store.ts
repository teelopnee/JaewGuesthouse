/**
 * store.ts
 * Single source of truth for everything the server persists.
 * Data lives in DATA_DIR (default ./data) as plain JSON files that are written
 * atomically (write temp file -> rename) with a .bak copy of the previous version,
 * so a crash or power cut mid-write can never leave a half-written file.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

export type PricingMode = 'full' | 'weekday_only';

export interface Settings {
  pinHash: string;
  pinSalt: string;
  isDefaultPin: boolean;
  tokenSecret: string;
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

export const DEFAULT_PIN = '1234';

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

function newSettings(): Settings {
  const pinSalt = crypto.randomBytes(16).toString('hex');
  return {
    pinHash: hashPin(DEFAULT_PIN, pinSalt),
    pinSalt,
    isDefaultPin: true,
    tokenSecret: crypto.randomBytes(32).toString('hex'),
    roomOverrides: {},
    guesthouseConfig: {},
    pricingMode: 'full',
    creativeOverrides: {},
    roomImages: {},
    updatedAt: new Date().toISOString(),
  };
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readJson(file: string): unknown {
  for (const candidate of [file, `${file}.bak`]) {
    try {
      if (fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      }
    } catch (err) {
      console.warn(`[store] Could not read ${path.basename(candidate)}:`, (err as Error).message);
      // Keep the damaged file aside so nothing is ever silently lost.
      try {
        const aside = `${candidate}.damaged-${Date.now()}`;
        fs.renameSync(candidate, aside);
        console.warn(`[store] Damaged file moved to ${path.basename(aside)}`);
      } catch {}
    }
  }
  return undefined;
}

function isReadableJson(file: string): boolean {
  try {
    JSON.parse(fs.readFileSync(file, 'utf-8'));
    return true;
  } catch {
    return false;
  }
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Atomic write. Retries the rename because OneDrive/antivirus can briefly lock files on Windows. */
function writeJson(file: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, json, 'utf-8');
  if (fs.existsSync(file) && isReadableJson(file)) {
    try {
      fs.copyFileSync(file, `${file}.bak`);
    } catch {
      // backup is best effort
    }
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (attempt === 5) {
        // Last resort: write in place so the change is never lost.
        fs.writeFileSync(file, json, 'utf-8');
        try {
          fs.unlinkSync(tmp);
        } catch {}
        return;
      }
      sleepSync(40 * (attempt + 1));
    }
  }
}

function normaliseSettings(raw: unknown): Settings {
  const base = newSettings();
  if (!isPlainObject(raw)) return base;
  const s: Settings = {
    pinHash: typeof raw.pinHash === 'string' ? raw.pinHash : base.pinHash,
    pinSalt: typeof raw.pinSalt === 'string' ? raw.pinSalt : base.pinSalt,
    isDefaultPin: typeof raw.isDefaultPin === 'boolean' ? raw.isDefaultPin : base.isDefaultPin,
    tokenSecret: typeof raw.tokenSecret === 'string' && raw.tokenSecret.length >= 32 ? raw.tokenSecret : base.tokenSecret,
    roomOverrides: isPlainObject(raw.roomOverrides) ? raw.roomOverrides : {},
    guesthouseConfig: isPlainObject(raw.guesthouseConfig) ? raw.guesthouseConfig : {},
    pricingMode: raw.pricingMode === 'weekday_only' ? 'weekday_only' : 'full',
    creativeOverrides: isPlainObject(raw.creativeOverrides) ? raw.creativeOverrides : {},
    roomImages: {},
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
  if (isPlainObject(raw.roomImages)) {
    for (const [roomId, imgs] of Object.entries(raw.roomImages)) {
      if (Array.isArray(imgs)) {
        const clean = imgs.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
        if (clean.length) s.roomImages[roomId] = clean;
      }
    }
  }
  return s;
}

function normaliseBookings(raw: unknown): BookingsData {
  const out: BookingsData = { bookings: [], deletedIds: [], updatedAt: new Date().toISOString() };
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

// ---------------------------------------------------------------------------
// In-memory state (loaded once at startup, every change is persisted at once)
// ---------------------------------------------------------------------------

let settings: Settings;
let bookingsData: BookingsData;
let revision = 0;

export function initStore() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const rawSettings = readJson(SETTINGS_FILE);
  settings = normaliseSettings(rawSettings);
  if (rawSettings === undefined) {
    migrateLegacySettings();
  }
  writeJson(SETTINGS_FILE, settings);

  const rawBookings = readJson(BOOKINGS_FILE);
  bookingsData = normaliseBookings(rawBookings);
  if (rawBookings === undefined) {
    migrateLegacyBookings();
  }
  writeJson(BOOKINGS_FILE, bookingsData);

  migrateInlineImages();
  revision = Date.now();
  console.log(`[store] Data folder: ${DATA_DIR}`);
}

/**
 * One-time import from the old AI Studio files (custom_admin_config.json,
 * custom_room_images.json, custom_bookings.json) if they are placed next to package.json.
 */
function migrateLegacySettings() {
  const legacyConfig = readJson(path.resolve('custom_admin_config.json'));
  if (isPlainObject(legacyConfig)) {
    if (typeof legacyConfig.pin === 'string' && legacyConfig.pin.trim().length >= 4) {
      const pin = legacyConfig.pin.trim();
      settings.pinHash = hashPin(pin, settings.pinSalt);
      settings.isDefaultPin = pin === DEFAULT_PIN;
    }
    if (isPlainObject(legacyConfig.roomOverrides)) settings.roomOverrides = legacyConfig.roomOverrides;
    if (isPlainObject(legacyConfig.guesthouseConfig)) settings.guesthouseConfig = legacyConfig.guesthouseConfig;
    if (legacyConfig.pricingMode === 'weekday_only') settings.pricingMode = 'weekday_only';
    console.log('[store] Imported legacy custom_admin_config.json');
  }
  const legacyImages = readJson(path.resolve('custom_room_images.json'));
  if (isPlainObject(legacyImages)) {
    settings.roomImages = normaliseSettings({ roomImages: legacyImages }).roomImages;
    console.log('[store] Imported legacy custom_room_images.json');
  }
}

function migrateLegacyBookings() {
  const legacy = readJson(path.resolve('custom_bookings.json'));
  if (Array.isArray(legacy)) {
    // The bk_seed_* entries were fake demo bookings - never import them.
    bookingsData.bookings = legacy
      .filter(isValidStoredBooking)
      .filter((b) => !String(b.booking_id).startsWith('bk_seed_'));
    console.log(`[store] Imported ${bookingsData.bookings.length} legacy bookings`);
  }
}

/** Old versions stored photos as base64 inside the JSON. Move them to real files. */
function migrateInlineImages() {
  let changed = false;
  for (const [roomId, imgs] of Object.entries(settings.roomImages)) {
    const next = imgs.map((img) => {
      if (img.startsWith('data:')) {
        try {
          changed = true;
          return saveDataUrlImage(img);
        } catch {
          return '';
        }
      }
      return img;
    });
    settings.roomImages[roomId] = next.filter(Boolean);
    if (!settings.roomImages[roomId].length) delete settings.roomImages[roomId];
  }
  if (changed) writeJson(SETTINGS_FILE, settings);
}

// ---------------------------------------------------------------------------
// Accessors / mutators
// ---------------------------------------------------------------------------

export function getSettings(): Readonly<Settings> {
  return settings;
}

export function getRevision(): number {
  return revision;
}

export function bumpRevision() {
  revision = Math.max(revision + 1, Date.now());
}

export function updateSettings(mutator: (s: Settings) => void) {
  const draft: Settings = structuredClone(settings);
  mutator(draft);
  draft.updatedAt = new Date().toISOString();
  writeJson(SETTINGS_FILE, draft);
  settings = draft;
  bumpRevision();
}

export function getBookingsData(): Readonly<BookingsData> {
  return bookingsData;
}

export function updateBookings(mutator: (d: BookingsData) => void) {
  const draft: BookingsData = structuredClone(bookingsData);
  mutator(draft);
  draft.updatedAt = new Date().toISOString();
  // Keep the tombstone list bounded.
  if (draft.deletedIds.length > 5000) draft.deletedIds = draft.deletedIds.slice(-5000);
  writeJson(BOOKINGS_FILE, draft);
  bookingsData = draft;
  bumpRevision();
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

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Saves a data: URL to the uploads folder and returns its public URL. */
export function saveDataUrlImage(dataUrl: string): string {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error('รูปแบบไฟล์รูปภาพไม่ถูกต้อง');
  const ext = MIME_EXT[match[1].toLowerCase()];
  if (!ext) throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new Error('ไฟล์รูปภาพว่างเปล่า');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('ไฟล์รูปภาพใหญ่เกิน 8MB');
  const name = `${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 24)}.${ext}`;
  const file = path.join(UPLOADS_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buffer);
  return `/uploads/${name}`;
}

// ---------------------------------------------------------------------------
// Automatic daily backups: data/backups/YYYY-MM-DD/{settings,bookings}.json, last 30 days kept
// ---------------------------------------------------------------------------

export const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUP_DAYS = 30;

function localDateStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function listBackupDays(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
    .sort();
}

/** Makes today's backup if it doesn't exist yet and removes backups older than 30 days. */
export function runDailyBackup() {
  try {
    const dir = path.join(BACKUP_DIR, localDateStamp());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');
      fs.writeFileSync(path.join(dir, 'bookings.json'), JSON.stringify(bookingsData, null, 2), 'utf-8');
      console.log(`[store] Daily backup saved: backups/${path.basename(dir)}`);
    }
    const days = listBackupDays();
    for (const old of days.slice(0, Math.max(0, days.length - KEEP_BACKUP_DAYS))) {
      fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[store] Daily backup failed:', (err as Error).message);
  }
}

/** Remove uploaded files no room uses any more (only files older than a day, so in-progress edits are safe). */
export function cleanupUnusedUploads() {
  try {
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
    collect(settings.roomImages);
    // Photos still referenced by a daily backup are kept too, so restoring a backup never loses photos.
    for (const day of listBackupDays()) {
      try {
        collect(JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, day, 'settings.json'), 'utf-8')).roomImages);
      } catch {
        // unreadable backup - ignore
      }
    }
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(UPLOADS_DIR)) {
      if (used.has(name)) continue;
      const file = path.join(UPLOADS_DIR, name);
      const stat = fs.statSync(file);
      if (stat.isFile() && stat.mtimeMs < dayAgo) fs.unlinkSync(file);
    }
  } catch (err) {
    console.warn('[store] Upload cleanup skipped:', (err as Error).message);
  }
}
