/**
 * Jaew Guesthouse server
 *  - Serves the website (Vite dev middleware in development, built files in production)
 *  - Public API: GET /api/state (rooms config, photos, availability)
 *  - Admin API (PIN login + Bearer token): settings, room edits, photos, booking ledger
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import {
  initStore,
  getSettings,
  updateSettings,
  getBookingsData,
  updateBookings,
  getRevision,
  saveDataUrlImage,
  cleanupUnusedUploads,
  runDailyBackup,
  hashPin,
  DEFAULT_PIN,
  UPLOADS_DIR,
  PricingMode,
} from './store';
import {
  issueToken,
  isAdminRequest,
  requireAdmin,
  checkPin,
  loginLockRemainingMs,
  recordLoginFailure,
  clearLoginFailures,
} from './auth';
import {
  startLogbookSync,
  getSyncStatus,
  getMergedBookings,
  getRemoteBooking,
  getRemoteBookingIds,
  toPublicBooking,
  buildBooking,
} from './bookings';
import { renderIndexHtml, robotsTxt, sitemapXml } from './seo';

const IS_PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.resolve('dist');

initStore();
startLogbookSync();
runDailyBackup();
cleanupUnusedUploads();
setInterval(() => {
  runDailyBackup();
  cleanupUnusedUploads();
}, 60 * 60 * 1000).unref();

const app = express();
// Which proxy may tell us the visitor's real IP / https (used for the PIN lock-out and links):
//  - on Railway the app is only reachable through Railway's edge proxy -> trust exactly 1 hop
//  - elsewhere only trust proxies on private networks (Docker, a local Caddy/Nginx), so nobody
//    on the internet can fake their IP to dodge the PIN lock-out.
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const trustProxy = process.env.TRUST_PROXY ?? (onRailway ? '1' : 'loopback, linklocal, uniquelocal');
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy);
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Uploaded room photos (file names are content hashes, so they can be cached forever)
app.use('/uploads', express.static(UPLOADS_DIR, { immutable: true, maxAge: '365d', fallthrough: false }));

// API responses must always be revalidated (ETag makes unchanged polls cheap)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Vary', 'Authorization');
  next();
});

type AsyncHandler = (req: Request, res: Response) => unknown | Promise<unknown>;
const route = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// State snapshot shared by the public page and the admin panel
// ---------------------------------------------------------------------------

function buildState(req: Request) {
  const admin = isAdminRequest(req);
  const s = getSettings();
  const merged = getMergedBookings();
  const sync = getSyncStatus();
  return {
    rev: String(getRevision()),
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

app.get(
  '/api/state',
  route((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(buildState(req));
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Search engines
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(robotsTxt(req));
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
  res.send(sitemapXml(req));
});

// Kept for compatibility with the old app / other tools: public, without personal data.
app.get(['/api/bookings', '/api/jaew-bookings'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const merged = getMergedBookings();
  res.json(isAdminRequest(req) ? merged : merged.map(toPublicBooking));
});

app.get('/api/sync-status', (_req, res) => res.json(getSyncStatus()));

app.get(
  '/api/logbook-rooms',
  route(async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const r = await fetch('https://jaewlogbook.ai.studio/api/rooms', { signal: controller.signal });
      res.json(r.ok ? await r.json() : []);
    } catch {
      res.json([]);
    } finally {
      clearTimeout(timer);
    }
  })
);

// ---------------------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------------------

app.post(
  '/api/admin/login',
  route((req, res) => {
    const ip = req.ip || 'unknown';
    const lockedMs = loginLockRemainingMs(ip);
    if (lockedMs > 0) {
      const minutes = Math.ceil(lockedMs / 60000);
      throw new HttpError(429, `ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ ${minutes} นาทีแล้วลองใหม่`);
    }
    const pin = cleanString(req.body?.pin, 12);
    if (!pin || !checkPin(pin)) {
      recordLoginFailure(ip);
      throw new HttpError(401, 'รหัส PIN ไม่ถูกต้อง');
    }
    clearLoginFailures(ip);
    res.json({ ...issueToken(), isDefaultPin: getSettings().isDefaultPin });
  })
);

app.get('/api/admin/session', (req, res) => res.json({ valid: isAdminRequest(req) }));

app.use('/api/admin', requireAdmin);

app.post(
  '/api/admin/change-pin',
  route((req, res) => {
    const currentPin = cleanString(req.body?.currentPin, 12);
    const newPin = cleanString(req.body?.newPin, 12);
    if (!checkPin(currentPin)) throw new HttpError(400, 'รหัส PIN ปัจจุบันไม่ถูกต้อง');
    if (!/^\d{4,8}$/.test(newPin)) throw new HttpError(400, 'รหัส PIN ใหม่ต้องเป็นตัวเลข 4-8 หลัก');
    updateSettings((s) => {
      s.pinHash = hashPin(newPin, s.pinSalt);
      s.isDefaultPin = newPin === DEFAULT_PIN;
    });
    // The old token is now invalid (it was signed with the old PIN hash) - hand out a new one.
    res.json({ ...issueToken(), state: buildState(req) });
  })
);

// ---------------------------------------------------------------------------
// Settings: pricing mode, guesthouse info, page text (creative mode)
// ---------------------------------------------------------------------------

app.put(
  '/api/admin/pricing-mode',
  route((req, res) => {
    const mode = req.body?.mode as PricingMode;
    if (mode !== 'full' && mode !== 'weekday_only') throw new HttpError(400, 'โหมดราคาไม่ถูกต้อง');
    updateSettings((s) => {
      s.pricingMode = mode;
    });
    res.json(buildState(req));
  })
);

const GUESTHOUSE_KEYS = [
  'name', 'nameEn', 'slogan', 'subSlogan', 'locationTitle', 'address', 'googleMapsUrl', 'lineId', 'lineOaUrl',
  'phonePrimary', 'phoneSecondary', 'phonePrimaryDisplay', 'phoneSecondaryDisplay', 'checkInTime', 'checkOutTime',
  'scooterPrice', 'electricScooterPrice', 'motorcyclePrice', 'parkingInfo',
];
/** Show / hide switches; anything other than "on" / "off" is ignored. */
const GUESTHOUSE_SWITCH_KEYS = ['electricScooterEnabled', 'motorcycleEnabled'];

app.put(
  '/api/admin/guesthouse',
  route((req, res) => {
    const input = req.body?.config;
    if (!isPlainObject(input)) throw new HttpError(400, 'ข้อมูลไม่ถูกต้อง');
    const clean: Record<string, string> = {};
    for (const key of GUESTHOUSE_KEYS) {
      if (input[key] !== undefined) clean[key] = cleanString(input[key], 500);
    }
    for (const key of GUESTHOUSE_SWITCH_KEYS) {
      if (input[key] === 'on' || input[key] === 'off') clean[key] = input[key];
    }
    updateSettings((s) => {
      s.guesthouseConfig = { ...s.guesthouseConfig, ...clean };
    });
    res.json(buildState(req));
  })
);

const CREATIVE_KEYS = ['customText', 'fontSize', 'textColor', 'bgColor', 'padding', 'borderRadius'];

app.put(
  '/api/admin/creative',
  route((req, res) => {
    const input = req.body?.overrides;
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
    updateSettings((s) => {
      s.creativeOverrides = clean;
    });
    res.json(buildState(req));
  })
);

app.post(
  '/api/admin/reset-all',
  route((req, res) => {
    updateSettings((s) => {
      s.roomOverrides = {};
      s.guesthouseConfig = {};
    });
    res.json(buildState(req));
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

app.put(
  '/api/admin/rooms/:id',
  route((req, res) => {
    const id = cleanRoomId(req.params.id);
    const override = cleanRoomOverride(req.body?.override);
    updateSettings((s) => {
      s.roomOverrides[id] = { ...(s.roomOverrides[id] || {}), ...override };
    });
    res.json(buildState(req));
  })
);

app.post(
  '/api/admin/rooms/bulk',
  route((req, res) => {
    const ids = Array.isArray(req.body?.roomIds) ? req.body.roomIds.map(cleanRoomId) : [];
    if (!ids.length) throw new HttpError(400, 'กรุณาเลือกห้องอย่างน้อย 1 ห้อง');
    const override = cleanRoomOverride(req.body?.override);
    updateSettings((s) => {
      for (const id of ids) s.roomOverrides[id] = { ...(s.roomOverrides[id] || {}), ...override };
    });
    res.json(buildState(req));
  })
);

app.delete(
  '/api/admin/rooms/:id',
  route((req, res) => {
    const id = cleanRoomId(req.params.id);
    updateSettings((s) => {
      delete s.roomOverrides[id];
    });
    res.json(buildState(req));
  })
);

// ---------------------------------------------------------------------------
// Room photos
// ---------------------------------------------------------------------------

app.post(
  '/api/admin/upload',
  route((req, res) => {
    const dataUrl = req.body?.dataUrl;
    if (typeof dataUrl !== 'string') throw new HttpError(400, 'ไม่พบไฟล์รูปภาพ');
    try {
      res.json({ url: saveDataUrlImage(dataUrl) });
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
  })
);

function cleanImageUrl(v: unknown): string {
  const url = cleanString(v, 2000);
  if (/^https?:\/\//i.test(url)) return url;
  if ((url.startsWith('/uploads/') || url.startsWith('/images/')) && !url.includes('..') && !url.includes('\\')) return url;
  return '';
}

app.put(
  '/api/admin/room-images/:id',
  route((req, res) => {
    const id = cleanRoomId(req.params.id);
    const input = Array.isArray(req.body?.images) ? req.body.images : [];
    const images = input
      .map((img: unknown) => (typeof img === 'string' && img.startsWith('data:') ? saveDataUrlImage(img) : cleanImageUrl(img)))
      .filter(Boolean)
      .slice(0, 16);
    updateSettings((s) => {
      if (images.length) s.roomImages[id] = images;
      else delete s.roomImages[id];
    });
    res.json(buildState(req));
  })
);

app.delete(
  '/api/admin/room-images/:id',
  route((req, res) => {
    const id = cleanRoomId(req.params.id);
    updateSettings((s) => {
      delete s.roomImages[id];
    });
    res.json(buildState(req));
  })
);

// ---------------------------------------------------------------------------
// Booking ledger
// ---------------------------------------------------------------------------

function findBooking(id: string) {
  return getBookingsData().bookings.find((b) => b.booking_id === id) || getRemoteBooking(id);
}

app.post(
  '/api/admin/bookings',
  route((req, res) => {
    if (!isPlainObject(req.body)) throw new HttpError(400, 'ข้อมูลการจองไม่ถูกต้อง');
    let booking;
    try {
      booking = buildBooking(req.body);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    updateBookings((d) => {
      d.bookings.unshift(booking);
    });
    res.status(201).json({ booking, state: buildState(req) });
  })
);

app.put(
  '/api/admin/bookings/:id',
  route((req, res) => {
    const id = cleanString(req.params.id, 120);
    const existing = findBooking(id);
    if (!existing) throw new HttpError(404, 'ไม่พบรายการจองนี้ (อาจถูกลบไปแล้ว)');
    let booking;
    try {
      booking = buildBooking(isPlainObject(req.body) ? req.body : {}, existing);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    updateBookings((d) => {
      const idx = d.bookings.findIndex((b) => b.booking_id === id);
      if (idx >= 0) d.bookings[idx] = booking;
      else d.bookings.unshift(booking); // edited logbook booking becomes a local record
    });
    res.json({ booking, state: buildState(req) });
  })
);

function deleteBookings(ids: string[]) {
  const remoteIds = new Set(getRemoteBookingIds());
  const set = new Set(ids);
  updateBookings((d) => {
    d.bookings = d.bookings.filter((b) => !set.has(b.booking_id));
    for (const id of ids) if (remoteIds.has(id) && !d.deletedIds.includes(id)) d.deletedIds.push(id);
  });
}

app.delete(
  '/api/admin/bookings/:id',
  route((req, res) => {
    deleteBookings([cleanString(req.params.id, 120)]);
    res.json(buildState(req));
  })
);

app.post(
  '/api/admin/bookings/delete-many',
  route((req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((i: unknown) => cleanString(i, 120)).filter(Boolean) : [];
    if (!ids.length) throw new HttpError(400, 'ไม่ได้เลือกรายการจอง');
    deleteBookings(ids);
    res.json(buildState(req));
  })
);

app.post(
  '/api/admin/bookings/clear',
  route((req, res) => {
    deleteBookings(getMergedBookings().map((b) => b.booking_id));
    res.json(buildState(req));
  })
);

// ---------------------------------------------------------------------------
// Backup (everything except the PIN hash / secrets)
// ---------------------------------------------------------------------------

app.get('/api/admin/backup', (_req, res) => {
  const { pinHash, pinSalt, tokenSecret, ...settings } = getSettings();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="jaew-backup-${stamp}.json"`);
  res.json({ exportedAt: new Date().toISOString(), settings, bookings: getBookingsData() });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'ไม่พบ API นี้' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'ไฟล์ใหญ่เกินไป' });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
  // e.g. a missing or malformed /uploads/... path from express.static
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return res.status(e.status === 403 ? 404 : e.status).json({ error: 'ไม่พบไฟล์' });
  }
  console.error('[server] Unexpected error:', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง' });
});

process.on('unhandledRejection', (reason) => console.error('[server] Unhandled rejection:', reason));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  const httpServer = http.createServer(app);

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
      console.error('[server] dist/index.html not found - run "npm run build" first.');
      process.exit(1);
    }
    app.use(
      express.static(DIST_DIR, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    const indexTemplate = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(renderIndexHtml(indexTemplate, req));
    });
  }

  // Must come after the frontend handlers so they can't swallow errors from them.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] Error:', err);
    res.status(500).send('Server error');
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${PORT} is already used by another program. Set PORT to another number.`);
    } else {
      console.error('[server] Could not start:', err);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });

  // Hosting platforms send SIGTERM before restarting/redeploying: finish open requests, then exit.
  // (Every save is written to disk immediately, so nothing is pending in memory.)
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received - shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
