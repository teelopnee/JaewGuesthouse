/**
 * Moves the data downloaded from the Railway volume into the Cloudflare version:
 * settings, booking ledger, daily backups and every uploaded photo.
 *
 * Usage:
 *   IMPORT_TOKEN=... node scripts/import-railway-backup.mjs --url https://<site> --dir <backup folder>
 *
 * The site only accepts this while the IMPORT_TOKEN Cloudflare secret is set
 * (on your own computer it is read from .dev.vars). Running it again is safe: it replaces
 * settings / bookings with the copy in the folder and re-uploads the same photos.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const base = (arg('url', 'http://127.0.0.1:8787') || '').replace(/\/$/, '');
const dir = path.resolve(arg('dir', '../railway-backup-2026-11-03'));
let token = process.env.IMPORT_TOKEN;
if (!token && /^http:\/\/(127\.0\.0\.1|localhost)/.test(base) && fs.existsSync('.dev.vars')) {
  token = /^IMPORT_TOKEN=(.+)$/m.exec(fs.readFileSync('.dev.vars', 'utf-8'))?.[1]?.trim();
}
if (!token) {
  console.error('ต้องตั้ง IMPORT_TOKEN ก่อน (เหมือนกับ secret บน Cloudflare)');
  process.exit(1);
}
if (!fs.existsSync(path.join(dir, 'settings.json'))) {
  console.error(`ไม่พบ settings.json ในโฟลเดอร์ ${dir}`);
  process.exit(1);
}

async function call(method, route, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${base}/api/import/${route}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${method} ${route}: HTTP ${res.status} ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  ลองใหม่ (${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));

console.log(`ย้ายข้อมูลจาก ${dir}\n        ไปที่ ${base}\n`);

const settingsText = fs.readFileSync(path.join(dir, 'settings.json'), 'utf-8');
JSON.parse(settingsText); // stop here if the file is damaged
console.log('การตั้งค่า:', await call('POST', 'settings', settingsText));

const bookingsFile = path.join(dir, 'bookings.json');
if (fs.existsSync(bookingsFile)) console.log('สมุดจอง:', await call('POST', 'bookings', fs.readFileSync(bookingsFile, 'utf-8')));

const backupsDir = path.join(dir, 'backups');
const days = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
for (const day of days) {
  const settings = readJson(path.join(backupsDir, day, 'settings.json'));
  const bookings = readJson(path.join(backupsDir, day, 'bookings.json'));
  await call('POST', 'backup', { day, settings, bookings });
}
console.log(`สำรองรายวัน: ${days.length} วัน`);

const uploadsDir = path.join(dir, 'uploads');
const photos = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).sort() : [];
let done = 0;
for (const name of photos) {
  const bytes = fs.readFileSync(path.join(uploadsDir, name));
  await call('POST', 'photo', { name, base64: bytes.toString('base64') });
  done++;
  if (done % 10 === 0 || done === photos.length) console.log(`รูป: ${done}/${photos.length}`);
}

// Check everything arrived
const status = await call('GET', 'status');
const remotePhotos = new Map(status.photos.map((p) => [p.name, p.base64_length]));
const problems = [];
for (const name of photos) {
  const expected = fs.readFileSync(path.join(uploadsDir, name)).toString('base64').length;
  if (remotePhotos.get(name) !== expected) problems.push(`รูป ${name} ไม่ครบ`);
}
for (const day of days) if (!status.backups.includes(day)) problems.push(`สำรองวันที่ ${day} ไม่ครบ`);
for (const key of ['settings', 'bookings']) if (!status.docs.some((d) => d.key === key)) problems.push(`ไม่มี ${key}`);
const settings = readJson(path.join(dir, 'settings.json'));
const referenced = Object.values(settings.roomImages || {}).flat().filter((u) => u.startsWith('/uploads/'));
for (const url of referenced) if (!remotePhotos.has(url.slice(9))) problems.push(`ห้องใช้รูปที่ไม่มี: ${url}`);
// Photo names are content hashes - double-check the local copies too
for (const name of photos) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(uploadsDir, name))).digest('hex').slice(0, 24);
  if (!name.startsWith(hash)) problems.push(`ไฟล์รูปในเครื่องเสีย: ${name}`);
}

console.log(`\nบนเว็บใหม่มี: รูป ${status.photos.length} รูป, สำรองรายวัน ${status.backups.length} วัน`);
if (problems.length) {
  console.error('\nพบปัญหา:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('✅ ย้ายข้อมูลครบทุกรายการ');
