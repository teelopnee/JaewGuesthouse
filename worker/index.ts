/**
 * Jaew Guesthouse - Cloudflare Worker
 *  - Serves the website: built files in dist/ are served by Cloudflare directly (static assets),
 *    index.html is filled in here (seo.ts)
 *  - Public API: GET /api/state (rooms config, photos, availability)
 *  - Admin API (PIN login + Bearer token): settings, room edits, photos, booking ledger
 *  - Every night (cron, 03:00 Thai time): daily backup + clean-up
 */

import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import {
  loadSnapshot,
  updateSettings,
  updateBookings,
  putDoc,
  normaliseSettings,
  normaliseBookings,
  saveDataUrlImage,
  getPhoto,
  putPhoto,
  photoName,
  runDailyBackup,
  cleanupUnusedUploads,
  DEFAULT_PIN,
  PHOTO_NAME,
  PricingMode,
  Snapshot,
  BookingRecord,
} from './store';
import {
  issueToken,
  isAdminRequest,
  checkPin,
  hashPin,
  pinNeedsUpgrade,
  getRequestToken,
  loginLockRemainingMs,
  recordLoginFailure,
  clearLoginFailures,
  cleanupLoginFailures,
} from './auth';
import {
  normaliseLogbook,
  syncFromLogbook,
  logbookUrl,
  getSyncStatus,
  getMergedBookings,
  getRemoteBooking,
  getRemoteBookingIds,
  toPublicBooking,
  buildBooking,
  LogbookCache,
  MAX_STALE_MS,
} from './bookings';
import { renderIndexHtml, robotsTxt, sitemapXml, siteBase } from './seo';
import { Env, HttpError } from './http';

type AppEnv = { Bindings: Env; Variables: { snapshot: Snapshot } };
type Ctx = Context<AppEnv>;

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// API responses must always be revalidated (an ETag makes unchanged polls cheap)
app.use('/api/*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'no-cache');
  c.res.headers.set('Vary', 'Authorization');
  if (c.req.method !== 'GET' || c.res.status !== 200) return;
  const digest = await crypto.subtle.digest('SHA-1', await c.res.clone().arrayBuffer());
  const etag = `W/"${Buffer.from(digest).toString('hex')}"`;
  if (c.req.header('if-none-match') === etag) {
    c.res = new Response(null, { status: 304, headers: c.res.headers });
  }
  c.res.headers.set('ETag', etag);
});

app.use(
  '/api/*',
  bodyLimit({ maxSize: 15 * 1024 * 1024, onError: (c) => c.json({ error: 'ไฟล์ใหญ่เกินไป' }, 413) })
);

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** The request's JSON body ({} when there is none). */
async function readBody(c: Ctx): Promise<any> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
  }
}

/** Errors from saving (bad photo etc.) carry a Thai message for the admin. */
async function orBadRequest<T>(work: () => T | Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// State snapshot shared by the public page and the admin panel
// ---------------------------------------------------------------------------

/** The logbook copy; refreshed in the background, or right away when it is too old. */
async function currentLogbook(c: Ctx, snap: Snapshot): Promise<LogbookCache> {
  const cache = normaliseLogbook(snap.logbook);
  if (!logbookUrl(c.env)) return cache;
  const refresh = () =>
    syncFromLogbook(c.env, cache).catch((err) => {
      console.warn('[bookings] Logbook refresh failed:', (err as Error).message);
      return null;
    });
  if (Date.now() - cache.lastAttemptAt > MAX_STALE_MS) return (await refresh()) || cache;
  c.executionCtx.waitUntil(refresh());
  return cache;
}

function revision(snap: Snapshot, logbook: LogbookCache): string {
  return String(
    Math.max(Date.parse(snap.settings.updatedAt) || 0, Date.parse(snap.bookings.updatedAt) || 0, logbook.changedAt, 1)
  );
}

function buildState(c: Ctx, snap: Snapshot, admin = isAdminRequest(c.env, snap.settings, c.req.raw)) {
  const s = snap.settings;
  const logbook = normaliseLogbook(snap.logbook);
  const merged = getMergedBookings(snap.bookings, logbook);
  const sync = getSyncStatus(c.env, logbook);
  return {
    rev: revision(snap, logbook),
    isAdmin: admin,
    config: {
      roomOverrides: s.roomOverrides,
      guesthouseConfig: s.guesthouseConfig,
      pricingMode: s.pricingMode,
      creativeOverrides: s.creativeOverrides,
      roomImages: s.roomImages,
      isDefaultPin: s.isDefaultPin,
    },
    bookings: admin ? merged : merged.map(toPublicBooking),
    sync: { enabled: sync.enabled, ok: sync.ok },
  };
}

app.get('/api/state', async (c) => {
  const snap = await loadSnapshot(c.env.DB);
  const logbook = await currentLogbook(c, snap);
  c.header('Access-Control-Allow-Origin', '*');
  return c.json(buildState(c, { ...snap, logbook }));
});

app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// Search engines
app.get('/robots.txt', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.text(robotsTxt(siteBase(c.req.raw)));
});
app.get('/sitemap.xml', async (c) => {
  const { settings } = await loadSnapshot(c.env.DB);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(sitemapXml(siteBase(c.req.raw), settings), 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

// Kept for compatibility with the old app / other tools: public, without personal data.
for (const path of ['/api/bookings', '/api/jaew-bookings']) {
  app.get(path, async (c) => {
    const snap = await loadSnapshot(c.env.DB);
    const logbook = await currentLogbook(c, snap);
    c.header('Access-Control-Allow-Origin', '*');
    const merged = getMergedBookings(snap.bookings, logbook);
    return c.json(isAdminRequest(c.env, snap.settings, c.req.raw) ? merged : merged.map(toPublicBooking));
  });
}

app.get('/api/sync-status', async (c) => {
  const snap = await loadSnapshot(c.env.DB);
  return c.json(getSyncStatus(c.env, normaliseLogbook(snap.logbook)));
});

app.get('/api/logbook-rooms', async (c) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const r = await fetch('https://jaewlogbook.ai.studio/api/rooms', { signal: controller.signal });
    return c.json(r.ok ? await r.json() : []);
  } catch {
    return c.json([]);
  } finally {
    clearTimeout(timer);
  }
});

// ---------------------------------------------------------------------------
// One-time data import from the Railway volume (scripts/import-railway-backup.mjs).
// Only exists while the IMPORT_TOKEN secret is set; delete that secret afterwards.
// ---------------------------------------------------------------------------

app.use('/api/import/*', async (c, next) => {
  const expected = c.env.IMPORT_TOKEN;
  if (!expected || expected.length < 32) return c.json({ error: 'ไม่พบ API นี้' }, 404);
  const given = Buffer.from(getRequestToken(c.req.raw) || '');
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});

app.post('/api/import/settings', async (c) => {
  // Only the known fields are kept (the old tokenSecret is dropped: it is a Cloudflare secret now).
  const settings = normaliseSettings(await readBody(c));
  await putDoc(c.env.DB, 'settings', settings);
  return c.json({ ok: true, updatedAt: settings.updatedAt });
});

app.post('/api/import/bookings', async (c) => {
  const bookings = normaliseBookings(await readBody(c));
  await putDoc(c.env.DB, 'bookings', bookings);
  return c.json({ ok: true, count: bookings.bookings.length });
});

app.post('/api/import/backup', async (c) => {
  const body = await readBody(c);
  const day = cleanString(body?.day, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new HttpError(400, 'bad day');
  await c.env.DB.prepare('INSERT OR REPLACE INTO backups (day, settings, bookings, created_at) VALUES (?, ?, ?, ?)')
    .bind(
      day,
      JSON.stringify(normaliseSettings(body.settings)),
      JSON.stringify(normaliseBookings(body.bookings)),
      new Date().toISOString()
    )
    .run();
  return c.json({ ok: true, day });
});

app.post('/api/import/photo', async (c) => {
  const body = await readBody(c);
  const name = cleanString(body?.name, 60);
  if (!PHOTO_NAME.test(name) || typeof body.base64 !== 'string') throw new HttpError(400, 'bad photo');
  const bytes = Buffer.from(body.base64, 'base64');
  if (photoName(bytes, name.split('.').pop()!) !== name) throw new HttpError(400, 'photo content does not match its name');
  await putPhoto(c.env.DB, name, bytes.toString('base64'), true);
  return c.json({ ok: true, name, bytes: bytes.length });
});

app.get('/api/import/status', async (c) => {
  const db = c.env.DB;
  const [docs, photos, backups] = await db.batch([
    db.prepare('SELECT key, updated_at, length(value) AS length FROM docs ORDER BY key'),
    db.prepare('SELECT name, SUM(length(data)) AS base64_length FROM photos GROUP BY name ORDER BY name'),
    db.prepare('SELECT day FROM backups ORDER BY day'),
  ]);
  return c.json({ docs: docs.results, photos: photos.results, backups: backups.results.map((b: any) => b.day) });
});

// ---------------------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------------------

app.post('/api/admin/login', async (c) => {
  const db = c.env.DB;
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const lockedMs = await loginLockRemainingMs(db, ip);
  if (lockedMs > 0) {
    const minutes = Math.ceil(lockedMs / 60000);
    throw new HttpError(429, `ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ ${minutes} นาทีแล้วลองใหม่`);
  }
  const body = await readBody(c);
  const pin = cleanString(body?.pin, 12);
  let { settings } = await loadSnapshot(db);
  if (!pin || !checkPin(c.env, settings, pin)) {
    await recordLoginFailure(db, ip);
    throw new HttpError(401, 'รหัส PIN ไม่ถูกต้อง');
  }
  await clearLoginFailures(db, ip);
  if (pinNeedsUpgrade(settings)) {
    const checkedHash = settings.pinHash;
    settings = await updateSettings(db, (s) => {
      if (s.pinHash === checkedHash) s.pinHash = hashPin(c.env, pin, s.pinSalt);
    });
  }
  return c.json({ ...issueToken(c.env, settings), isDefaultPin: settings.isDefaultPin });
});

app.get('/api/admin/session', async (c) => {
  const { settings } = await loadSnapshot(c.env.DB);
  return c.json({ valid: isAdminRequest(c.env, settings, c.req.raw) });
});

app.use('/api/admin/*', async (c, next) => {
  const snap = await loadSnapshot(c.env.DB);
  if (!isAdminRequest(c.env, snap.settings, c.req.raw)) {
    return c.json({ error: 'เซสชันแอดมินหมดอายุ กรุณาใส่รหัส PIN ใหม่อีกครั้ง', code: 'UNAUTHORIZED' }, 401);
  }
  c.set('snapshot', snap);
  await next();
});

/** Saves a settings change and answers with the new state. */
async function saveSettings(c: Ctx, mutator: Parameters<typeof updateSettings>[1]) {
  const settings = await updateSettings(c.env.DB, mutator);
  return c.json(buildState(c, { ...c.get('snapshot'), settings }, true));
}

app.post('/api/admin/change-pin', async (c) => {
  const body = await readBody(c);
  const currentPin = cleanString(body?.currentPin, 12);
  const newPin = cleanString(body?.newPin, 12);
  if (!checkPin(c.env, c.get('snapshot').settings, currentPin)) throw new HttpError(400, 'รหัส PIN ปัจจุบันไม่ถูกต้อง');
  if (!/^\d{4,8}$/.test(newPin)) throw new HttpError(400, 'รหัส PIN ใหม่ต้องเป็นตัวเลข 4-8 หลัก');
  const settings = await updateSettings(c.env.DB, (s) => {
    s.pinHash = hashPin(c.env, newPin, s.pinSalt);
    s.isDefaultPin = newPin === DEFAULT_PIN;
  });
  // The old token is now invalid (it was signed with the old PIN hash) - hand out a new one.
  return c.json({ ...issueToken(c.env, settings), state: buildState(c, { ...c.get('snapshot'), settings }, true) });
});

// ---------------------------------------------------------------------------
// Settings: pricing mode, guesthouse info, page text (creative mode)
// ---------------------------------------------------------------------------

app.put('/api/admin/pricing-mode', async (c) => {
  const mode = (await readBody(c))?.mode as PricingMode;
  if (mode !== 'full' && mode !== 'weekday_only') throw new HttpError(400, 'โหมดราคาไม่ถูกต้อง');
  return saveSettings(c, (s) => {
    s.pricingMode = mode;
  });
});

const GUESTHOUSE_KEYS = [
  'name', 'nameEn', 'slogan', 'subSlogan', 'locationTitle', 'address', 'googleMapsUrl', 'lineId', 'lineOaUrl',
  'phonePrimary', 'phoneSecondary', 'phonePrimaryDisplay', 'phoneSecondaryDisplay', 'checkInTime', 'checkOutTime',
  'scooterPrice', 'electricScooterPrice', 'motorcyclePrice', 'parkingInfo',
];
/** Show / hide switches; anything other than "on" / "off" is ignored. */
const GUESTHOUSE_SWITCH_KEYS = ['electricScooterEnabled', 'motorcycleEnabled'];

app.put('/api/admin/guesthouse', async (c) => {
  const input = (await readBody(c))?.config;
  if (!isPlainObject(input)) throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
  const clean: Record<string, string> = {};
  for (const key of GUESTHOUSE_KEYS) {
    if (input[key] !== undefined) clean[key] = cleanString(input[key], 500);
  }
  for (const key of GUESTHOUSE_SWITCH_KEYS) {
    if (input[key] === 'on' || input[key] === 'off') clean[key] = input[key];
  }
  return saveSettings(c, (s) => {
    s.guesthouseConfig = { ...s.guesthouseConfig, ...clean };
  });
});

const CREATIVE_KEYS = ['customText', 'fontSize', 'textColor', 'bgColor', 'padding', 'borderRadius'];

app.put('/api/admin/creative', async (c) => {
  const input = (await readBody(c))?.overrides;
  if (!isPlainObject(input)) throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
  const clean: Record<string, Record<string, unknown>> = {};
  for (const [id, o] of Object.entries(input).slice(0, 200)) {
    if (!isPlainObject(o) || !/^[\w-]{1,60}$/.test(id)) continue;
    const item: Record<string, unknown> = { id };
    for (const k of CREATIVE_KEYS) if (typeof o[k] === 'string') item[k] = cleanString(o[k], 2000);
    if (typeof o.isHidden === 'boolean') item.isHidden = o.isHidden;
    if (typeof o.scale === 'number' && o.scale > 0 && o.scale < 5) item.scale = o.scale;
    clean[id] = item;
  }
  return saveSettings(c, (s) => {
    s.creativeOverrides = clean;
  });
});

app.post('/api/admin/reset-all', (c) =>
  saveSettings(c, (s) => {
    s.roomOverrides = {};
    s.guesthouseConfig = {};
  })
);

// ---------------------------------------------------------------------------
// Rooms: open/close, details, prices
// ---------------------------------------------------------------------------

function cleanPrices(v: unknown) {
  if (!isPlainObject(v)) return undefined;
  return {
    weekday: cleanString(v.weekday, 40),
    saturday: cleanString(v.saturday, 40),
    specialSaturday: cleanString(v.specialSaturday, 40),
    festival: cleanString(v.festival, 40),
  };
}

function cleanStringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => cleanString(x, 120)).filter(Boolean).slice(0, 40);
}

function cleanRoomOverride(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) throw new HttpError(400, 'ข้อมูลห้องไม่ถูกต้อง');
  const out: Record<string, unknown> = {};
  if (typeof input.isHiddenFromRental === 'boolean') out.isHiddenFromRental = input.isHiddenFromRental;
  for (const k of ['roomNumber', 'displayName', 'capacityLabel', 'bedType']) {
    if (input[k] !== undefined) {
      const v = cleanString(input[k], 200);
      if (v) out[k] = v;
    }
  }
  if (input.description !== undefined) out.description = cleanString(input.description, 2000);
  if (input.priceStart !== undefined) {
    const n = Math.round(Number(input.priceStart));
    if (Number.isFinite(n) && n > 0) out.priceStart = n;
  }
  if (input.capacity !== undefined) {
    const n = Math.round(Number(input.capacity));
    if (Number.isFinite(n) && n > 0 && n <= 50) out.capacity = n;
  }
  if (input.bedSize === 5 || input.bedSize === 6) out.bedSize = input.bedSize;
  const prices = cleanPrices(input.prices);
  if (prices) out.prices = prices;
  const badges = cleanStringList(input.badges);
  if (badges) out.badges = badges;
  const amenities = cleanStringList(input.amenities);
  if (amenities) out.amenities = amenities;
  return out;
}

function cleanRoomId(v: unknown): string {
  const id = cleanString(v, 60);
  if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'รหัสห้องไม่ถูกต้อง');
  return id;
}

app.put('/api/admin/rooms/:id', async (c) => {
  const id = cleanRoomId(c.req.param('id'));
  const override = cleanRoomOverride((await readBody(c))?.override);
  return saveSettings(c, (s) => {
    s.roomOverrides[id] = { ...(s.roomOverrides[id] || {}), ...override };
  });
});

app.post('/api/admin/rooms/bulk', async (c) => {
  const body = await readBody(c);
  const ids = Array.isArray(body?.roomIds) ? body.roomIds.map(cleanRoomId) : [];
  if (!ids.length) throw new HttpError(400, 'กรุณาเลือกห้องอย่างน้อย 1 ห้อง');
  const override = cleanRoomOverride(body?.override);
  return saveSettings(c, (s) => {
    for (const id of ids) s.roomOverrides[id] = { ...(s.roomOverrides[id] || {}), ...override };
  });
});

app.delete('/api/admin/rooms/:id', (c) => {
  const id = cleanRoomId(c.req.param('id'));
  return saveSettings(c, (s) => {
    delete s.roomOverrides[id];
  });
});

// ---------------------------------------------------------------------------
// Room photos
// ---------------------------------------------------------------------------

app.post('/api/admin/upload', async (c) => {
  const dataUrl = (await readBody(c))?.dataUrl;
  if (typeof dataUrl !== 'string') throw new HttpError(400, 'ไม่พบไฟล์รูปภาพ');
  return c.json({ url: await orBadRequest(() => saveDataUrlImage(c.env.DB, dataUrl)) });
});

function cleanImageUrl(v: unknown): string {
  const url = cleanString(v, 2000);
  if (/^https?:\/\//i.test(url)) return url;
  if ((url.startsWith('/uploads/') || url.startsWith('/images/')) && !url.includes('..') && !url.includes('\\')) return url;
  return '';
}

app.put('/api/admin/room-images/:id', async (c) => {
  const id = cleanRoomId(c.req.param('id'));
  const body = await readBody(c);
  const input: unknown[] = Array.isArray(body?.images) ? body.images : [];
  const images: string[] = [];
  for (const img of input) {
    if (images.length >= 16) break;
    const url =
      typeof img === 'string' && img.startsWith('data:')
        ? await orBadRequest(() => saveDataUrlImage(c.env.DB, img))
        : cleanImageUrl(img);
    if (url) images.push(url);
  }
  return saveSettings(c, (s) => {
    if (images.length) s.roomImages[id] = images;
    else delete s.roomImages[id];
  });
});

app.delete('/api/admin/room-images/:id', (c) => {
  const id = cleanRoomId(c.req.param('id'));
  return saveSettings(c, (s) => {
    delete s.roomImages[id];
  });
});

// ---------------------------------------------------------------------------
// Booking ledger
// ---------------------------------------------------------------------------

function findBooking(snap: Snapshot, id: string): BookingRecord | undefined {
  return snap.bookings.bookings.find((b) => b.booking_id === id) || getRemoteBooking(normaliseLogbook(snap.logbook), id);
}

async function saveBookings(c: Ctx, mutator: Parameters<typeof updateBookings>[1]): Promise<Snapshot> {
  const bookings = await updateBookings(c.env.DB, mutator);
  return { ...c.get('snapshot'), bookings };
}

app.post('/api/admin/bookings', async (c) => {
  const body = await readBody(c);
  if (!isPlainObject(body)) throw new HttpError(400, 'ข้อมูลการจองไม่ถูกต้อง');
  const booking = await orBadRequest(() => buildBooking(body));
  const snap = await saveBookings(c, (d) => {
    d.bookings.unshift(booking);
  });
  return c.json({ booking, state: buildState(c, snap, true) }, 201);
});

app.put('/api/admin/bookings/:id', async (c) => {
  const id = cleanString(c.req.param('id'), 120);
  const body = await readBody(c);
  const existing = findBooking(c.get('snapshot'), id);
  if (!existing) throw new HttpError(404, 'ไม่พบรายการจองนี้ (อาจถูกลบไปแล้ว)');
  const booking = await orBadRequest(() => buildBooking(isPlainObject(body) ? body : {}, existing));
  const snap = await saveBookings(c, (d) => {
    const idx = d.bookings.findIndex((b) => b.booking_id === id);
    if (idx >= 0) d.bookings[idx] = booking;
    else d.bookings.unshift(booking); // edited logbook booking becomes a local record
  });
  return c.json({ booking, state: buildState(c, snap, true) });
});

async function deleteBookings(c: Ctx, ids: string[]) {
  const remoteIds = new Set(getRemoteBookingIds(normaliseLogbook(c.get('snapshot').logbook)));
  const set = new Set(ids);
  const snap = await saveBookings(c, (d) => {
    d.bookings = d.bookings.filter((b) => !set.has(b.booking_id));
    for (const id of ids) if (remoteIds.has(id) && !d.deletedIds.includes(id)) d.deletedIds.push(id);
  });
  return c.json(buildState(c, snap, true));
}

app.delete('/api/admin/bookings/:id', (c) => deleteBookings(c, [cleanString(c.req.param('id'), 120)]));

app.post('/api/admin/bookings/delete-many', async (c) => {
  const body = await readBody(c);
  const ids = Array.isArray(body?.ids) ? body.ids.map((i: unknown) => cleanString(i, 120)).filter(Boolean) : [];
  if (!ids.length) throw new HttpError(400, 'ไม่ได้เลือกรายการจอง');
  return deleteBookings(c, ids);
});

app.post('/api/admin/bookings/clear', (c) => {
  const snap = c.get('snapshot');
  return deleteBookings(
    c,
    getMergedBookings(snap.bookings, normaliseLogbook(snap.logbook)).map((b) => b.booking_id)
  );
});

// ---------------------------------------------------------------------------
// Backup (everything except the PIN hash)
// ---------------------------------------------------------------------------

app.get('/api/admin/backup', (c) => {
  const { pinHash, pinSalt, ...settings } = c.get('snapshot').settings;
  const stamp = new Date().toISOString().slice(0, 10);
  c.header('Content-Disposition', `attachment; filename="jaew-backup-${stamp}.json"`);
  return c.json({ exportedAt: new Date().toISOString(), settings, bookings: c.get('snapshot').bookings });
});

app.all('/api/*', (c) => c.json({ error: 'ไม่พบ API นี้' }, 404));

// ---------------------------------------------------------------------------
// Uploaded room photos (file names are content hashes, so they can be cached forever)
// ---------------------------------------------------------------------------

app.get('/uploads/:name', async (c) => {
  const name = c.req.param('name');
  const photo = PHOTO_NAME.test(name) ? await getPhoto(c.env.DB, name) : null;
  if (!photo) return c.json({ error: 'ไม่พบไฟล์' }, 404);
  return new Response(photo.bytes, {
    headers: {
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${name}"`,
    },
  });
});

app.all('/uploads/*', (c) => c.json({ error: 'ไม่พบไฟล์' }, 404));

// ---------------------------------------------------------------------------
// The website: every other page gets index.html, filled in with the saved guesthouse info
// ---------------------------------------------------------------------------

let indexTemplate: string | undefined;

app.get('*', async (c) => {
  if (!indexTemplate) {
    const res = await c.env.ASSETS.fetch(new URL('/', c.req.url));
    if (!res.ok) throw new Error('dist/index.html not found - run "npm run build" first');
    indexTemplate = await res.text();
  }
  const { settings } = await loadSnapshot(c.env.DB);
  c.header('Cache-Control', 'no-cache');
  return c.html(renderIndexHtml(indexTemplate, siteBase(c.req.raw), settings));
});

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  console.error('[worker] Unexpected error:', err);
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง' }, 500);
  }
  return c.text('Server error', 500);
});

// ---------------------------------------------------------------------------
// Nightly jobs
// ---------------------------------------------------------------------------

async function nightly(env: Env) {
  for (const [name, job] of [
    ['daily backup', runDailyBackup],
    ['photo clean-up', cleanupUnusedUploads],
    ['login lock clean-up', cleanupLoginFailures],
  ] as const) {
    try {
      await job(env.DB);
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err);
    }
  }
}

export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(nightly(env));
  },
} satisfies ExportedHandler<Env>;
