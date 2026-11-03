/**
 * Makes the website QR code (qr-code/jaew-website-qr.png + .svg) and puts it, with the link,
 * into the A5 poster qr-code/qr-poster.html.
 *
 * Usage: node scripts/make-qr.mjs [website link]
 */
import fs from 'fs';
import QRCode from 'qrcode';

const url = process.argv[2] || 'https://jaew-guesthouse.teelopnee.workers.dev/';
const options = { errorCorrectionLevel: 'Q', margin: 2, color: { dark: '#0f172a', light: '#ffffff' } };

const png = await QRCode.toBuffer(url, { ...options, width: 1200 });
const svg = await QRCode.toString(url, { ...options, type: 'svg' });
fs.writeFileSync('qr-code/jaew-website-qr.png', png);
fs.writeFileSync('qr-code/jaew-website-qr.svg', svg);

const posterFile = 'qr-code/qr-poster.html';
const poster = fs
  .readFileSync(posterFile, 'utf-8')
  .replace(/<img src="data:image\/png;base64,[^"]*"/, `<img src="data:image/png;base64,${png.toString('base64')}"`)
  .replace(/<div class="url">[^<]*<\/div>/, `<div class="url">${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>`);
fs.writeFileSync(posterFile, poster);
console.log(`QR + poster updated for ${url}`);
