/**
 * seo.ts
 * Fills index.html before it is sent:
 *  - an instant first screen (name + LINE / phone buttons) that shows before the app's code
 *    has downloaded, so customers on slow mobile data can contact the guesthouse right away
 *  - canonical / og:url / og:image and Google "LodgingBusiness" info, built from the
 *    guesthouse settings the admin saved
 * Also serves robots.txt and sitemap.xml for search engines.
 */

import type { Request } from 'express';
import { GUESTHOUSE_CONFIG } from '../src/data/config';
import { ROOMS_DATA } from '../src/data/roomsData';
import { parsePriceNumber } from '../src/utils/pricingUtils';
import { getRentals } from '../src/utils/rentalUtils';
import { getSettings } from './store';

const SHARE_IMAGE = '/images/room_33_interior_1791728201467.jpg';
const GEO = { latitude: 13.2998882, longitude: 100.9008211 };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** https://host of this request (Railway's proxy says https via X-Forwarded-Proto). */
export function siteBase(req: Request): string {
  const host = (req.get('host') || 'localhost').replace(/[^a-zA-Z0-9.:-]/g, '');
  return `${req.protocol}://${host}`;
}

function activeGuesthouse(): typeof GUESTHOUSE_CONFIG {
  const merged = { ...GUESTHOUSE_CONFIG };
  for (const [k, v] of Object.entries(getSettings().guesthouseConfig || {})) {
    if (k in merged && typeof v === 'string' && v.trim() !== '') {
      (merged as Record<string, string>)[k] = v.trim();
    }
  }
  return merged;
}

function weekdayPrices(): number[] {
  const overrides = getSettings().roomOverrides || {};
  return ROOMS_DATA.filter((r) => !(overrides[r.id] as any)?.isHiddenFromRental)
    .map((r) => {
      const o = overrides[r.id] as { prices?: { weekday?: string }; priceStart?: number } | undefined;
      const text = o?.prices?.weekday ?? r.prices.weekday;
      return parsePriceNumber(text, o?.priceStart ?? r.priceStart);
    })
    .filter((n) => n > 0);
}

function internationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `+66${digits.slice(1)}` : `+${digits}`;
}

function seoTags(req: Request): string {
  const base = siteBase(req);
  const gh = activeGuesthouse();
  const prices = weekdayPrices();
  const priceRange = prices.length
    ? `฿${Math.min(...prices).toLocaleString('en-US')} - ฿${Math.max(...prices).toLocaleString('en-US')}`
    : undefined;

  const business = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: gh.name,
    alternateName: gh.nameEn,
    description: `${gh.slogan} • ${gh.subSlogan}`,
    url: `${base}/`,
    image: [`${base}${SHARE_IMAGE}`],
    telephone: internationalPhone(gh.phonePrimary),
    priceRange,
    currenciesAccepted: 'THB',
    address: {
      '@type': 'PostalAddress',
      streetAddress: gh.address,
      addressLocality: 'แสนสุข, เมืองชลบุรี',
      addressRegion: 'ชลบุรี',
      postalCode: '20130',
      addressCountry: 'TH',
    },
    geo: { '@type': 'GeoCoordinates', ...GEO },
    hasMap: gh.googleMapsUrl,
    sameAs: [gh.lineOaUrl],
    numberOfRooms: prices.length,
    amenityFeature: [
      'เครื่องปรับอากาศ', 'Wi-Fi ฟรี', 'ทีวี', 'ตู้เย็น', 'เครื่องทำน้ำอุ่น',
      ...getRentals(gh).available.map((r) => `${r.name}ให้เช่า`),
    ].map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
  };

  const json = JSON.stringify(business).replace(/</g, '\\u003c');
  return [
    `<link rel="canonical" href="${escapeHtml(base)}/" />`,
    `<meta property="og:url" content="${escapeHtml(base)}/" />`,
    `<meta property="og:image" content="${escapeHtml(base + SHARE_IMAGE)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`ห้องพัก ${gh.name}`)}" />`,
    `<script type="application/ld+json">${json}</script>`,
  ].join('\n    ');
}

/** Plain HTML + inline styles: shows before React and Tailwind's CSS are needed. */
function appShell(): string {
  const gh = activeGuesthouse();
  const phoneText = escapeHtml((gh.phonePrimaryDisplay || gh.phonePrimary).replace(/\s*\(.*\)\s*$/, ''));
  const btn =
    'display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 16px;border-radius:16px;font-weight:800;font-size:15px;text-decoration:none;';
  return `
      <div style="min-height:100vh;background:#f8fafc;font-family:Prompt,system-ui,sans-serif;">
        <div style="background:#fff;border-bottom:1px solid #e0f2fe;padding:10px 16px;display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#0d9488);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">🌊</div>
          <div><div style="font-weight:800;color:#0f172a;font-size:15px;">${escapeHtml(gh.name)}</div>
          <div style="font-size:11px;color:#64748b;">แหลมแท่น ข้ามถนนถึงทะเล · หาดบางแสน ~300ม.</div></div>
        </div>
        <div style="max-width:28rem;margin:0 auto;padding:28px 16px;text-align:center;">
          <div style="width:28px;height:28px;margin:0 auto 12px;border:3px solid #bae6fd;border-top-color:#0284c7;border-radius:50%;animation:jaew-spin 0.8s linear infinite;"></div>
          <p style="color:#334155;font-size:14px;margin:0 0 20px;">กำลังโหลดห้องพักและห้องว่างล่าสุด...</p>
          <a href="${escapeHtml(gh.lineOaUrl)}" style="${btn}background:#06C755;color:#fff;margin-bottom:10px;">💬 ทัก LINE จองที่พัก ${escapeHtml(gh.lineId)}</a>
          <a href="tel:${escapeHtml(gh.phonePrimary)}" style="${btn}background:#f0f9ff;color:#0c4a6e;border:1px solid #bae6fd;">📞 โทร ${phoneText}</a>
        </div>
        <style>@keyframes jaew-spin{to{transform:rotate(360deg)}}</style>
      </div>
    `;
}

export function renderIndexHtml(template: string, req: Request): string {
  return template
    .replace(/<!--\s*seo:[^>]*-->/, seoTags(req))
    .replace(/<!--\s*app-shell:[^>]*-->/, appShell());
}

export function robotsTxt(req: Request): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${siteBase(req)}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(req: Request): string {
  const lastmod = (getSettings().updatedAt || new Date().toISOString()).slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeHtml(siteBase(req))}/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>
`;
}
