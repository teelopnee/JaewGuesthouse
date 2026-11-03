/**
 * End-to-end tests: starts the real Worker locally (wrangler dev) with an empty database and a
 * fake Jaew Logbook, then goes through every public page and every admin action.
 *
 * Run with: npm test   (builds the website first)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = '.wrangler/test-state';
const IMPORT_TOKEN = crypto.randomBytes(32).toString('hex');
const secrets = {
  TOKEN_SECRET: crypto.randomBytes(32).toString('hex'),
  PIN_PEPPER: crypto.randomBytes(32).toString('hex'),
  IMPORT_TOKEN,
};

// ---------------------------------------------------------------------------
// Fake Jaew Logbook
// ---------------------------------------------------------------------------

let logbookBookings = [
  {
    booking_id: 'LB-1',
    room_id: 'sea-1',
    room_number: '1',
    guest_name: 'Logbook Guest',
    phone: '0800000000',
    checkin_date: '2030-01-10',
    checkout_date: '2030-01-12',
    stay_status: 'จองล่วงหน้า',
  },
  { booking_id: 'LB-2', room_id: 'sea-2', guest_name: 'Second', checkin_date: '2030-02-01', checkout_date: '2030-02-03' },
  { booking_id: 'LB-bad', room_id: 'sea-3', checkin_date: 'not a date', checkout_date: '2030-02-03' },
];
const logbook = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(logbookBookings));
});

let worker;

function wrangler(args) {
  return spawn('npx', ['wrangler', ...args], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

before(async () => {
  await new Promise((r) => logbook.listen(0, '127.0.0.1', r));
  const logbookUrl = `http://127.0.0.1:${logbook.address().port}/api/bookings`;
  fs.rmSync(STATE_DIR, { recursive: true, force: true });
  const migrate = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', STATE_DIR], {
    shell: true,
    encoding: 'utf-8',
  });
  assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  // Test secrets go in their own file so the developer's .dev.vars is never used or touched.
  const envFile = `${STATE_DIR}/test.env`;
  fs.writeFileSync(envFile, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n'));
  worker = wrangler([
    'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', STATE_DIR, '--test-scheduled',
    '--env-file', envFile, '--var', `LOGBOOK_URL:${logbookUrl}`,
  ]);
  let log = '';
  worker.stdout.on('data', (d) => (log += d));
  worker.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`wrangler dev did not start:\n${log}`);
});

after(() => {
  logbook.close();
  if (worker?.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(worker.pid), '/T', '/F']);
    else worker.kill();
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let token = '';

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const pngName = `${crypto.createHash('sha256').update(PNG).digest('hex').slice(0, 24)}.png`;

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------

test('health check', async () => {
  const r = await api('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('home page is filled in with SEO tags and the instant first screen', async () => {
  for (const path of ['/', '/index.html', '/some/old/link']) {
    const res = await fetch(BASE + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}/" />`), `canonical on ${path}`);
    assert.ok(html.includes('"@type":"LodgingBusiness"'));
    assert.ok(html.includes('ทัก LINE จองที่พัก'));
    assert.ok(html.includes('แจ๋วเกสต์เฮ้าส์ แหลมแท่น'));
    assert.ok(!html.includes('<!-- seo:'), 'template comment replaced');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  }
});

test('robots.txt and sitemap.xml', async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes(`Sitemap: ${BASE}/sitemap.xml`));
  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  assert.match(sitemap.headers.get('content-type'), /xml/);
  assert.ok((await sitemap.text()).includes(`<loc>${BASE}/</loc>`));
});

test('built files and default room photos are served', async () => {
  const img = await fetch(`${BASE}/images/room_33_interior_1791728201467.jpg`);
  assert.equal(img.status, 200);
  assert.ok((await img.arrayBuffer()).byteLength > 1000);
  const html = await (await fetch(BASE + '/')).text();
  const js = /\/assets\/index-[\w-]+\.js/.exec(html)[0];
  const asset = await fetch(BASE + js);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /immutable/);
});

test('public state hides guests\' personal data and merges the logbook', async () => {
  const r = await api('/api/state', { auth: false });
  assert.equal(r.status, 200);
  assert.equal(r.data.isAdmin, false);
  assert.equal(r.data.config.isDefaultPin, true);
  assert.deepEqual(r.data.sync, { enabled: true, ok: true });
  const ids = r.data.bookings.map((b) => b.booking_id).sort();
  assert.deepEqual(ids, ['LB-1', 'LB-2'], 'invalid logbook rows are dropped');
  for (const b of r.data.bookings) {
    assert.equal(b.guest_name, undefined);
    assert.equal(b.phone, undefined);
  }
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  const legacy = await api('/api/bookings', { auth: false });
  assert.equal(legacy.data.length, 2);
  assert.equal(legacy.data[0].phone, undefined);
});

test('unchanged state answers 304 to a repeated poll', async () => {
  const first = await fetch(`${BASE}/api/state`);
  const etag = first.headers.get('etag');
  assert.ok(etag);
  const second = await fetch(`${BASE}/api/state`, { headers: { 'If-None-Match': etag } });
  assert.equal(second.status, 304);
});

test('unknown API, missing photos and admin calls without login', async () => {
  assert.equal((await api('/api/nope')).status, 404);
  assert.equal((await api('/api/nope')).data.error, 'ไม่พบ API นี้');
  assert.equal((await api('/uploads/abc.jpg')).status, 404);
  assert.equal((await api('/uploads/a/b/c')).status, 404);
  const r = await api('/api/admin/backup', { auth: false });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, 'UNAUTHORIZED');
  assert.equal((await api('/api/admin/session', { auth: false })).data.valid, false);
  assert.equal((await api('/api/import/status', { auth: false })).status, 401);
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

test('login with the default PIN 1234', async () => {
  assert.equal((await api('/api/admin/login', { method: 'POST', body: { pin: '9999' }, auth: false })).status, 401);
  assert.equal((await api('/api/admin/login', { method: 'POST', body: '{not json', auth: false })).status, 400);
  const r = await api('/api/admin/login', { method: 'POST', body: { pin: '1234' }, auth: false });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.isDefaultPin, true);
  assert.ok(r.data.expiresAt > Date.now() + 29 * 24 * 3600 * 1000);
  token = r.data.token;
  assert.equal((await api('/api/admin/session')).data.valid, true);
  const state = await api('/api/state');
  assert.equal(state.data.isAdmin, true);
  assert.equal(state.data.bookings.find((b) => b.booking_id === 'LB-1').phone, '0800000000');
});

test('change PIN logs out every other device', async () => {
  assert.equal((await api('/api/admin/change-pin', { method: 'POST', body: { currentPin: '0000', newPin: '5678' } })).status, 400);
  assert.equal((await api('/api/admin/change-pin', { method: 'POST', body: { currentPin: '1234', newPin: '12' } })).status, 400);
  const oldToken = token;
  const r = await api('/api/admin/change-pin', { method: 'POST', body: { currentPin: '1234', newPin: '5678' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.state.isAdmin, true);
  assert.equal(r.data.state.config.isDefaultPin, false);
  token = r.data.token;
  assert.equal((await api('/api/admin/session')).data.valid, true);
  assert.equal((await api('/api/admin/backup', { headers: { Authorization: `Bearer ${oldToken}` }, auth: false })).status, 401);
  assert.equal((await api('/api/admin/login', { method: 'POST', body: { pin: '1234' }, auth: false })).status, 401);
  assert.equal((await api('/api/admin/login', { method: 'POST', body: { pin: '5678' }, auth: false })).status, 200);
});

test('pricing mode, guesthouse info, page text', async () => {
  assert.equal((await api('/api/admin/pricing-mode', { method: 'PUT', body: { mode: 'x' } })).status, 400);
  let r = await api('/api/admin/pricing-mode', { method: 'PUT', body: { mode: 'weekday_only' } });
  assert.equal(r.data.config.pricingMode, 'weekday_only');

  r = await api('/api/admin/guesthouse', {
    method: 'PUT',
    body: { config: { name: '  ชื่อทดสอบ  ', motorcyclePrice: '400 บาท / วัน', motorcycleEnabled: 'off', electricScooterEnabled: 'maybe', hacker: 'x' } },
  });
  assert.equal(r.data.config.guesthouseConfig.name, 'ชื่อทดสอบ');
  assert.equal(r.data.config.guesthouseConfig.motorcycleEnabled, 'off');
  assert.equal(r.data.config.guesthouseConfig.electricScooterEnabled, undefined);
  assert.equal(r.data.config.guesthouseConfig.hacker, undefined);
  const html = await (await fetch(BASE + '/')).text();
  assert.ok(html.includes('ชื่อทดสอบ'), 'saved name used on the page');
  assert.ok(!html.includes('มอเตอร์ไซค์ให้เช่า'), 'switched-off rental hidden from Google info');

  r = await api('/api/admin/creative', {
    method: 'PUT',
    body: { overrides: { 'hero-title': { customText: 'สวัสดี', scale: 2, isHidden: false, evil: 1 }, 'bad id!': {} } },
  });
  assert.deepEqual(r.data.config.creativeOverrides, { 'hero-title': { id: 'hero-title', customText: 'สวัสดี', isHidden: false, scale: 2 } });
});

test('room edits: one room, many rooms, reset', async () => {
  let r = await api('/api/admin/rooms/sea-1', {
    method: 'PUT',
    body: { override: { isHiddenFromRental: true, priceStart: '650', prices: { weekday: '650' }, badges: ['วิวทะเล', ''], capacity: 99 } },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.config.roomOverrides['sea-1'], {
    isHiddenFromRental: true,
    priceStart: 650,
    prices: { weekday: '650', saturday: '', specialSaturday: '', festival: '' },
    badges: ['วิวทะเล'],
  });
  r = await api('/api/admin/rooms/bulk', { method: 'POST', body: { roomIds: ['sea-2', 'sea-3'], override: { isHiddenFromRental: true } } });
  assert.equal(r.data.config.roomOverrides['sea-3'].isHiddenFromRental, true);
  assert.equal((await api('/api/admin/rooms/bulk', { method: 'POST', body: { roomIds: [], override: {} } })).status, 400);
  assert.equal((await api('/api/admin/rooms/bad%20id', { method: 'PUT', body: { override: {} } })).status, 400);
  r = await api('/api/admin/rooms/sea-2', { method: 'DELETE' });
  assert.equal(r.data.config.roomOverrides['sea-2'], undefined);
});

test('saves from many devices at the same moment are all kept', async () => {
  const ids = Array.from({ length: 8 }, (_, i) => `room-${i}`);
  const results = await Promise.all(ids.map((id) => api(`/api/admin/rooms/${id}`, { method: 'PUT', body: { override: { capacity: 3 } } })));
  for (const r of results) assert.equal(r.status, 200);
  const state = await api('/api/state');
  for (const id of ids) assert.equal(state.data.config.roomOverrides[id]?.capacity, 3, id);
});

test('photo upload, room photos and serving photos', async () => {
  assert.equal((await api('/api/admin/upload', { method: 'POST', body: { dataUrl: 'hello' } })).status, 400);
  assert.equal((await api('/api/admin/upload', { method: 'POST', body: { dataUrl: 'data:image/bmp;base64,AAAA' } })).status, 400);
  const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl: `data:image/png;base64,${PNG.toString('base64')}` } });
  assert.equal(r.status, 200);
  assert.equal(r.data.url, `/uploads/${pngName}`, 'same file name as the Railway version');

  const photo = await fetch(BASE + r.data.url);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.match(photo.headers.get('cache-control'), /immutable/);
  assert.ok(Buffer.from(await photo.arrayBuffer()).equals(PNG));

  const saved = await api('/api/admin/room-images/sea-1', {
    method: 'PUT',
    body: {
      images: [
        r.data.url,
        'https://example.com/a.jpg',
        '/images/room_33_interior_1791728201467.jpg',
        `data:image/png;base64,${PNG.toString('base64')}`,
        '/uploads/../secret',
        'javascript:alert(1)',
      ],
    },
  });
  assert.deepEqual(saved.data.config.roomImages['sea-1'], [
    r.data.url,
    'https://example.com/a.jpg',
    '/images/room_33_interior_1791728201467.jpg',
    r.data.url,
  ]);
  const cleared = await api('/api/admin/room-images/sea-1', { method: 'DELETE' });
  assert.equal(cleared.data.config.roomImages['sea-1'], undefined);
});

test('a large photo (several database rows) comes back byte for byte', async () => {
  const big = crypto.randomBytes(2_500_000); // more than one 2 MB D1 row once base64 encoded
  const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl: `data:image/jpeg;base64,${big.toString('base64')}` } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const back = Buffer.from(await (await fetch(BASE + r.data.url)).arrayBuffer());
  assert.ok(back.equals(big));
  const tooBig = Buffer.alloc(8 * 1024 * 1024 + 1);
  const r2 = await api('/api/admin/upload', { method: 'POST', body: { dataUrl: `data:image/jpeg;base64,${tooBig.toString('base64')}` } });
  assert.equal(r2.status, 400);
  assert.equal(r2.data.error, 'ไฟล์รูปภาพใหญ่เกิน 8MB');
});

test('request over 15 MB is refused', async () => {
  const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl: 'x'.repeat(16 * 1024 * 1024) } });
  assert.equal(r.status, 413);
});

test('booking ledger: add, edit, logbook bookings, delete', async () => {
  let r = await api('/api/admin/bookings', { method: 'POST', body: { room_id: 'sea-1', checkin_date: '2030-03-02', checkout_date: '2030-03-01' } });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'วันเช็คเอาท์ต้องอยู่หลังวันเช็คอินอย่างน้อย 1 คืน');

  r = await api('/api/admin/bookings', {
    method: 'POST',
    body: { room_id: 'sea-1', checkin_date: '2030-03-01', checkout_date: '2030-03-04', guest_name: 'คุณเอ', actual_price: 3000, deposit_amount: 1000 },
  });
  assert.equal(r.status, 201);
  const id = r.data.booking.booking_id;
  assert.equal(r.data.booking.nights, 3);
  assert.equal(r.data.booking.remaining_amount, 2000);
  assert.equal(r.data.state.bookings[0].booking_id, id, 'new booking first');

  r = await api(`/api/admin/bookings/${id}`, { method: 'PUT', body: { payment_status: 'fully_paid' } });
  assert.equal(r.data.booking.remaining_amount, 0);
  assert.equal(r.data.booking.guest_name, 'คุณเอ');
  assert.equal((await api('/api/admin/bookings/nope', { method: 'PUT', body: {} })).status, 404);

  // Editing a logbook booking turns it into a local record that wins over the logbook copy
  r = await api('/api/admin/bookings/LB-1', { method: 'PUT', body: { notes: 'แก้แล้ว' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.state.bookings.filter((b) => b.booking_id === 'LB-1').length, 1);
  assert.equal(r.data.state.bookings.find((b) => b.booking_id === 'LB-1').notes, 'แก้แล้ว');

  // Deleting a logbook booking hides it even though the logbook still has it
  r = await api('/api/admin/bookings/LB-2', { method: 'DELETE' });
  assert.ok(!r.data.bookings.some((b) => b.booking_id === 'LB-2'));
  assert.ok(!(await api('/api/state', { auth: false })).data.bookings.some((b) => b.booking_id === 'LB-2'));

  assert.equal((await api('/api/admin/bookings/delete-many', { method: 'POST', body: { ids: [] } })).status, 400);
  r = await api('/api/admin/bookings/delete-many', { method: 'POST', body: { ids: [id] } });
  assert.ok(!r.data.bookings.some((b) => b.booking_id === id));

  r = await api('/api/admin/bookings/clear', { method: 'POST' });
  assert.deepEqual(r.data.bookings, []);
});

test('backup download has everything except the PIN', async () => {
  const r = await api('/api/admin/backup');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="jaew-backup-\d{4}-\d{2}-\d{2}\.json"/);
  assert.equal(r.data.settings.pinHash, undefined);
  assert.equal(r.data.settings.pinSalt, undefined);
  assert.equal(r.data.settings.pricingMode, 'weekday_only');
  assert.ok(Array.isArray(r.data.bookings.deletedIds));
});

test('reset all settings', async () => {
  const r = await api('/api/admin/reset-all', { method: 'POST' });
  assert.deepEqual(r.data.config.roomOverrides, {});
  assert.deepEqual(r.data.config.guesthouseConfig, {});
});

test('nightly job makes today\'s backup', async () => {
  const res = await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('0 20 * * *')}`);
  assert.equal(res.status, 200);
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  let status;
  for (let i = 0; i < 20; i++) {
    status = await api('/api/import/status', { headers: { Authorization: `Bearer ${IMPORT_TOKEN}` }, auth: false });
    if (status.data.backups.includes(today)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(status.data.backups.includes(today), JSON.stringify(status.data.backups));
});

test('data import keeps the PIN from the Railway version working', async () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const railwaySettings = {
    pinHash: crypto.scryptSync('4321', salt, 32).toString('hex'),
    pinSalt: salt,
    isDefaultPin: false,
    tokenSecret: 'x'.repeat(64),
    roomOverrides: { 'sea-9': { isHiddenFromRental: true } },
    guesthouseConfig: {},
    pricingMode: 'full',
    creativeOverrides: {},
    roomImages: { 'sea-9': [`/uploads/${pngName}`] },
    updatedAt: '2026-11-03T05:58:14.075Z',
  };
  const auth = { Authorization: `Bearer ${IMPORT_TOKEN}` };
  let r = await api('/api/import/settings', { method: 'POST', body: railwaySettings, headers: auth, auth: false });
  assert.equal(r.status, 200);
  r = await api('/api/import/photo', { method: 'POST', body: { name: pngName, base64: PNG.toString('base64') }, headers: auth, auth: false });
  assert.equal(r.status, 200);
  r = await api('/api/import/photo', { method: 'POST', body: { name: pngName, base64: 'AAAA' }, headers: auth, auth: false });
  assert.equal(r.status, 400, 'content must match the name');

  const state = await api('/api/state', { auth: false });
  assert.deepEqual(state.data.config.roomImages, railwaySettings.roomImages);
  assert.equal(state.data.config.isDefaultPin, false);

  assert.equal((await api('/api/admin/login', { method: 'POST', body: { pin: '5678' }, auth: false })).status, 401);
  r = await api('/api/admin/login', { method: 'POST', body: { pin: '4321' }, auth: false });
  assert.equal(r.status, 200, 'old Railway PIN works');
  token = r.data.token;
  assert.equal((await api('/api/admin/session')).data.valid, true);
  // Second login uses the upgraded (fast) hash
  r = await api('/api/admin/login', { method: 'POST', body: { pin: '4321' }, auth: false });
  assert.equal(r.status, 200);
  const backup = await api('/api/admin/backup', { headers: { Authorization: `Bearer ${r.data.token}` }, auth: false });
  assert.equal(backup.data.settings.tokenSecret, undefined, 'old secret not kept in the database');
});

test('8 wrong PINs lock that visitor for 10 minutes', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await api('/api/admin/login', { method: 'POST', body: { pin: '0000' }, auth: false });
  assert.equal(last.status, 429);
  assert.match(last.data.error, /กรุณารอ 10 นาที/);
  // Even the right PIN is refused while locked
  assert.equal((await api('/api/admin/login', { method: 'POST', body: { pin: '4321' }, auth: false })).status, 429);
});
