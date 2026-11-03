/**
 * Compares what customers see on two copies of the site (old Railway vs new Cloudflare):
 * room settings, prices, photos (byte for byte), availability, and the search-engine pages.
 *
 * Usage: node scripts/compare-sites.mjs <old site url> <new site url>
 */
import crypto from 'crypto';

const [oldBase, newBase] = process.argv.slice(2).map((u) => u?.replace(/\/$/, ''));
if (!oldBase || !newBase) {
  console.error('Usage: node scripts/compare-sites.mjs <old site url> <new site url>');
  process.exit(1);
}

const problems = [];
const ok = (msg) => console.log(`✅ ${msg}`);
const fail = (msg) => {
  problems.push(msg);
  console.log(`❌ ${msg}`);
};

async function get(base, route, type = 'json') {
  const res = await fetch(base + route, { headers: { Accept: type === 'json' ? 'application/json' : '*/*' } });
  if (!res.ok) throw new Error(`${base}${route}: HTTP ${res.status}`);
  if (type === 'json') return res.json();
  if (type === 'text') return res.text();
  return Buffer.from(await res.arrayBuffer());
}

/** JSON with sorted keys, so key order never counts as a difference. */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const [oldState, newState] = await Promise.all([get(oldBase, '/api/state'), get(newBase, '/api/state')]);

for (const key of ['roomOverrides', 'guesthouseConfig', 'pricingMode', 'creativeOverrides', 'roomImages', 'isDefaultPin']) {
  if (stable(oldState.config[key]) === stable(newState.config[key])) ok(`${key} ตรงกัน`);
  else fail(`${key} ไม่ตรงกัน`);
}
console.log(`   ห้องที่แอดมินแก้ไว้ ${Object.keys(newState.config.roomOverrides).length} ห้อง, ห้องที่มีรูป ${Object.keys(newState.config.roomImages).length} ห้อง`);

const byId = (list) => new Map(list.map((b) => [b.booking_id, stable(b)]));
const oldBookings = byId(oldState.bookings);
const newBookings = byId(newState.bookings);
const missing = [...oldBookings.keys()].filter((id) => newBookings.get(id) !== oldBookings.get(id));
const extra = [...newBookings.keys()].filter((id) => !oldBookings.has(id));
if (!missing.length && !extra.length) ok(`ห้องว่าง/การจองที่ลูกค้าเห็นตรงกัน (${newBookings.size} รายการ)`);
else fail(`การจองไม่ตรงกัน: เว็บใหม่ขาด/ต่าง ${missing.join(', ') || '-'} | เกินมา ${extra.join(', ') || '-'}`);
if (oldState.sync.ok === newState.sync.ok) ok(`สถานะเชื่อม Jaew Logbook ตรงกัน (${newState.sync.ok ? 'เชื่อมได้' : 'เชื่อมไม่ได้'})`);
else fail(`สถานะเชื่อม Jaew Logbook ต่างกัน: เก่า ${oldState.sync.ok} ใหม่ ${newState.sync.ok}`);

const photoUrls = [...new Set(Object.values(newState.config.roomImages).flat())];
let photoOk = 0;
for (const url of photoUrls) {
  if (/^https?:/.test(url)) continue;
  try {
    const [a, b] = await Promise.all([get(oldBase, url, 'bytes'), get(newBase, url, 'bytes')]);
    const name = url.split('/').pop();
    if (!a.equals(b)) fail(`รูป ${url} ไม่เหมือนเดิม`);
    else if (url.startsWith('/uploads/') && !name.startsWith(sha(b).slice(0, 24))) fail(`รูป ${url} เสีย`);
    else photoOk++;
  } catch (err) {
    fail(`เปิดรูป ${url} ไม่ได้: ${err.message}`);
  }
}
if (photoOk === photoUrls.length) ok(`รูปห้องเหมือนเดิมทุกไบต์ (${photoOk} รูป)`);

for (const img of ['/images/room_33_interior_1791728201467.jpg', '/images/regenerated_image_1791728524545.jpg']) {
  const b = await get(newBase, img, 'bytes').catch(() => null);
  if (b && b.length > 1000) ok(`รูปตั้งต้น ${img} เปิดได้`);
  else fail(`รูปตั้งต้น ${img} เปิดไม่ได้`);
}

const html = await get(newBase, '/', 'text');
for (const [label, needle] of [
  ['canonical', `<link rel="canonical" href="${newBase}/" />`],
  ['ข้อมูลธุรกิจสำหรับ Google', '"@type":"LodgingBusiness"'],
  ['หน้าจอแรก (ปุ่ม LINE/โทร)', 'ทัก LINE จองที่พัก'],
  ['ชื่อใหม่ แหลมแท่น', 'แจ๋วเกสต์เฮ้าส์ แหลมแท่น'],
]) {
  if (html.includes(needle)) ok(`หน้าเว็บมี ${label}`);
  else fail(`หน้าเว็บไม่มี ${label}`);
}
const robots = await get(newBase, '/robots.txt', 'text');
if (robots.includes(`Sitemap: ${newBase}/sitemap.xml`)) ok('robots.txt ถูกต้อง');
else fail('robots.txt ไม่ถูกต้อง');
const sitemap = await get(newBase, '/sitemap.xml', 'text');
if (sitemap.includes(`<loc>${newBase}/</loc>`)) ok('sitemap.xml ถูกต้อง');
else fail('sitemap.xml ไม่ถูกต้อง');

console.log(problems.length ? `\nพบ ${problems.length} จุดที่ต่างกัน` : '\n✅ เว็บใหม่แสดงข้อมูลเหมือนเว็บเดิมทุกจุด');
process.exit(problems.length ? 1 : 0);
