import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Compass,
  Eye,
  Footprints,
  Car,
  Bike,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { buildLineChatUrl } from '../data/config';
import { useGuesthouse } from '../context/AppDataContext';
import { getRentals } from '../utils/rentalUtils';

interface AttractionItem {
  id: string;
  name: string;
  nameEn: string;
  category: 'beach' | 'food' | 'viewpoint' | 'market';
  distance: string;
  distanceKm: number;
  walkTime: string;
  scooterTime: string;
  carTime: string;
  highlight: string;
  directionsUrl: string;
  emoji: string;
  tag: string;
}

// Distances measured from the map pin (OpenStreetMap, straight line) and rounded up for roads.
const NEARBY_ATTRACTIONS: AttractionItem[] = [
  {
    id: 'laem-thaen',
    name: 'ทะเลแหลมแท่น & ถนนคนเดิน',
    nameEn: 'Laem Thaen Seafront & Walking Street',
    category: 'beach',
    distance: 'ข้ามถนน',
    distanceKm: 0.05,
    walkTime: '1 นาที',
    scooterTime: '1 นาที',
    carTime: '1 นาที',
    highlight: 'ข้ามถนนก็ถึงทะเลแหลมแท่น จุดชมวิวพระอาทิตย์ตก ตกปลา ลานจัดกิจกรรม และถนนคนเดินบางแสน',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Laem+Thaen+Chon+Buri',
    emoji: '🌅',
    tag: 'ข้ามถนนถึงทะเล',
  },
  {
    id: 'bangsaen-beach',
    name: 'ชายหาดบางแสน',
    nameEn: 'Bang Saen Beach',
    category: 'beach',
    distance: '~300 ม.',
    distanceKm: 0.3,
    walkTime: '4-5 นาที',
    scooterTime: '1 นาที',
    carTime: '1-2 นาที',
    highlight: 'ห่างจากที่พักประมาณ 300 เมตร เดินเล่นรับลมชิลๆ นั่งเตียงผ้าใบ สั่งซีฟู้ดริมหาด',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Bang+Saen+Beach',
    emoji: '🏖️',
    tag: 'เดินถึงได้สบาย',
  },
  {
    id: 'khao-sam-muk',
    name: 'เขาสามมุข & จุดชมวิวสามมุข',
    nameEn: 'Khao Sam Muk Viewpoint',
    category: 'viewpoint',
    distance: '~2 กม.',
    distanceKm: 2,
    walkTime: '25 นาที',
    scooterTime: '4-5 นาที',
    carTime: '5 นาที',
    highlight: 'จุดชมวิวโค้งอ่าวบางแสน คาเฟ่ริมผาสวยระดับพรีเมียม ไหว้ศาลเจ้าแม่เขาสามมุข',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Khao+Sam+Muk',
    emoji: '🐒',
    tag: 'จุดชมวิวพาโนรามา',
  },
  {
    id: 'aquarium-buu',
    name: 'สถาบันวิทยาศาสตร์ทางทะเล ม.บูรพา (Aquarium)',
    nameEn: 'Marine Science Institute (Aquarium)',
    category: 'viewpoint',
    distance: '~3.5 กม.',
    distanceKm: 3.5,
    walkTime: '40 นาที',
    scooterTime: '7 นาที',
    carTime: '7-8 นาที',
    highlight: 'ชมแมงกะพรุนเรืองแสง อุโมงค์ปลาใต้ทะเลขนาดใหญ่ เหมาะกับครอบครัวและแก๊งเพื่อน',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Institute+of+Marine+Science+Burapha+University',
    emoji: '🐠',
    tag: 'แลนด์มาร์คห้ามพลาด',
  },
  {
    id: 'wonnapha-beach',
    name: 'หาดวอนนภา & คาเฟ่ริมหาด',
    nameEn: 'Wonnapha Beach',
    category: 'beach',
    distance: '~4 กม.',
    distanceKm: 4,
    walkTime: '45 นาที',
    scooterTime: '8 นาที',
    carTime: '8-10 นาที',
    highlight: 'โซนคาเฟ่สุดชิค สตรีทฟู้ดยามเย็น บรรยากาศนั่งชิลริมทะเลโรแมนติก',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Wonnapha+Beach',
    emoji: '☕',
    tag: 'สายคาเฟ่ & ชิลยามเย็น',
  },
  {
    id: 'nongmon-market',
    name: 'ตลาดหนองมน (ศูนย์รวมของฝาก)',
    nameEn: 'Nong Mon Market',
    category: 'market',
    distance: '~5 กม.',
    distanceKm: 5,
    walkTime: '1 ชม.',
    scooterTime: '10 นาที',
    carTime: '10-12 นาที',
    highlight: 'แหล่งซื้อข้าวหลามหนองมน ขนมจาก หอยจ๊อปู และอาหารทะเลแปรรูปชื่อดัง',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Nong+Mon+Market',
    emoji: '🛍️',
    tag: 'ของฝากชื่อดัง',
  },
  {
    id: 'angsila-fish-market',
    name: 'สะพานปลาอ่างศิลา / ตลาดประมงพื้นบ้าน',
    nameEn: 'Ang Sila Fish Market',
    category: 'market',
    distance: '~6 กม.',
    distanceKm: 6,
    walkTime: '1 ชม.+',
    scooterTime: '12 นาที',
    carTime: '12-15 นาที',
    highlight: 'อาหารทะเลสดๆ จากเรือประมง ปูเป็น กุ้งเป็น หอยนางรมสด และครกหินอ่างศิลาแท้',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Ang+Sila+Fish+Market',
    emoji: '🦀',
    tag: 'ซีฟู้ดสดขึ้นจากเรือ',
  },
];

export const LocationGuideSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'streetview' | 'attractions'>('map');
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null);
  const gh = useGuesthouse();
  const rentals = getRentals(gh);
  const shortName = gh.name.replace(/\s+By\s.*$/i, '');

  const googleMapsAppUrl = gh.googleMapsUrl;
  const googleStreetViewUrl = 'https://maps.app.goo.gl/GSeczAQ1ePLWtdLX6';

  return (
    <section id="location-section" className="my-8 scroll-mt-16">
      {/* Container Box */}
      <div className="bg-white rounded-3xl p-4 sm:p-7 border border-slate-200/90 shadow-sm space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                  แผนที่ & ระยะทางสถานที่ท่องเที่ยว
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  🌊 แหลมแท่น ข้ามถนนถึงทะเล · หาดบางแสน ~300ม.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ดูพิกัดปักหมุดชัดเจน • สำรวจภาพจริงด้วย Google Street View 360° • เช็คระยะทางไปที่เที่ยวรอบแหลมแท่น-บางแสน
              </p>
            </div>
          </div>

          {/* Quick External Navigation Button */}
          <a
            href={googleMapsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-all touch-manipulation cursor-pointer shrink-0"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>เปิด Google Maps นำทาง</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex rounded-2xl bg-slate-100/90 p-1 gap-1">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer touch-manipulation ${
              activeTab === 'map'
                ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4 text-rose-500" />
            <span>แผนที่ปักหมุด (Google Maps)</span>
          </button>

          <button
            onClick={() => setActiveTab('streetview')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer touch-manipulation ${
              activeTab === 'streetview'
                ? 'bg-white text-teal-700 shadow-xs ring-1 ring-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span>Street View 360° (ภาพจริง)</span>
          </button>

          <button
            onClick={() => setActiveTab('attractions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer touch-manipulation ${
              activeTab === 'attractions'
                ? 'bg-white text-amber-700 shadow-xs ring-1 ring-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>ที่เที่ยวใกล้เคียง ({NEARBY_ATTRACTIONS.length})</span>
          </button>
        </div>

        {/* TAB 1: Google Maps View */}
        {activeTab === 'map' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
              <iframe
                title={`พิกัด ${shortName} บน Google Maps`}
                src="https://maps.google.com/maps?q=13.2998882,100.9008211&hl=th&z=17&output=embed"
                width="100%"
                height="100%"
                className="w-full h-full border-0"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />

              {/* Compact Mini Pin Tag on top of map */}
              <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-md border border-slate-200/90 flex items-center gap-1.5 pointer-events-auto">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                <span className="font-extrabold text-slate-900 text-[11px] sm:text-xs">
                  {shortName}
                </span>
              </div>
            </div>

            {/* Address & Navigation Bar below Map (Clean & Unobstructed Map) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-slate-700 font-medium text-xs leading-tight">
                  📍 {gh.address}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={googleMapsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-2xs transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>นำทางผ่านแอป</span>
                </a>
                <button
                  onClick={() => setActiveTab('streetview')}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 text-xs font-bold transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>ดูภาพจริง 360°</span>
                </button>
              </div>
            </div>

            {/* Quick Location Highlights Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center gap-2">
                <span className="text-lg">🌊</span>
                <div>
                  <strong className="block text-slate-800">ข้ามถนนถึงทะเล</strong>
                  <span className="text-[11px] text-slate-500">แหลมแท่น · หาดบางแสน ~300ม.</span>
                </div>
              </div>

              {rentals.any && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-center gap-2">
                  <span className="text-lg">🛵</span>
                  <div>
                    <strong className="block text-slate-800">เช่ามอเตอร์ไซค์</strong>
                    <span className="text-[11px] text-slate-500">
                      {rentals.available.map((r) => (r.key === 'electric' ? 'ไฟฟ้า' : 'ธรรมดา')).join(' & ')} พร้อม
                    </span>
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100 flex items-center gap-2">
                <span className="text-lg">🎪</span>
                <div>
                  <strong className="block text-slate-800">ใกล้วอคกิ้งสตรีท</strong>
                  <span className="text-[11px] text-slate-500">แหลมแท่น เดินไม่กี่นาที</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-2">
                <span className="text-lg">🦐</span>
                <div>
                  <strong className="block text-slate-800">ใกล้ร้านอาหาร</strong>
                  <span className="text-[11px] text-slate-500">ซีฟู้ด & สตรีทฟู้ดเพียบ</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Google Street View 360° */}
        {activeTab === 'streetview' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Street View Container */}
            <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden border border-teal-200 shadow-inner bg-slate-900">
              <iframe
                title={`Google Street View 360 ${shortName}`}
                src="https://www.google.com/maps/embed?pb=!4v1727090000000!6m8!1m7!1sX7P7VvxPSC38JraasPBqWQ!2m2!1d13.2997227!2d100.9007758!3f313.8!4f7.68!5f0.7820865974627469"
                width="100%"
                height="100%"
                className="w-full h-full border-0"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />

              {/* Street View Top Badge */}
              <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                <Eye className="w-3.5 h-3.5 text-teal-400" />
                <span>Google Street View 360° บริเวณหน้าแจ๋วเกสต์เฮ้าส์</span>
              </div>

              {/* Fullscreen Button */}
              <a
                href={googleStreetViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md border border-slate-200 transition-all cursor-pointer touch-manipulation"
              >
                <span>เปิดดู Street View เต็มจอ</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>

            {/* Street View Navigation Guide */}
            <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-teal-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-teal-900">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>จุดสังเกตการเดินทาง & ทางเข้า:</span>
              </div>
              <p className="leading-relaxed">
                • ขับมาตามถนนเลียบหาดบางแสนมาทางแหลมแท่น มองเห็นป้ายและทางเข้าเกสต์เฮ้าส์ชัดเจน ข้ามถนนถึงทะเล (ห่างหาดบางแสนประมาณ 300 เมตร)
              </p>
              <p className="leading-relaxed text-[11px] text-teal-800">
                • สามารถแตะหมุนหน้าจอ 360 องศาในกรอบด้านบนเพื่อดูถนนเลียบหาด ต้นมะพร้าว และบรรยากาศโดยรอบได้แบบเสมือนจริง
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Nearby Attractions & Distance Cards */}
        {activeTab === 'attractions' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                📍 ระยะทางโดยประมาณจาก "แจ๋วเกสต์เฮ้าส์" ไปยังแลนด์มาร์คยอดฮิต:
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                (แตะการ์ดเพื่อดูเส้นทางบน Google Maps)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NEARBY_ATTRACTIONS.map((attraction) => {
                const isSelected = selectedAttraction === attraction.id;

                return (
                  <div
                    key={attraction.id}
                    onClick={() => setSelectedAttraction(isSelected ? null : attraction.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer touch-manipulation flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-50/90 border-sky-400 shadow-md ring-1 ring-sky-300'
                        : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200 hover:border-sky-200'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{attraction.emoji}</span>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                              {attraction.name}
                            </h4>
                            <span className="text-[11px] text-slate-500 block">
                              {attraction.nameEn}
                            </span>
                          </div>
                        </div>

                        {/* Distance Badge */}
                        <div className="text-right shrink-0">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-sky-600 text-white text-xs font-black shadow-2xs">
                            {attraction.distance}
                          </span>
                        </div>
                      </div>

                      {/* Tag pill */}
                      <div className="mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                          {attraction.tag}
                        </span>
                      </div>

                      {/* Highlight Description */}
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        {attraction.highlight}
                      </p>
                    </div>

                    {/* Travel Times Comparison & Navigation Action */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-2">
                        {/* Walking */}
                        <span className="inline-flex items-center gap-1">
                          <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{attraction.walkTime}</span>
                        </span>

                        {/* Scooter / Electric */}
                        <span className="inline-flex items-center gap-1 font-bold text-sky-700">
                          <Bike className="w-3.5 h-3.5 text-sky-600" />
                          <span>{attraction.scooterTime}</span>
                        </span>

                        {/* Car */}
                        <span className="inline-flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-500" />
                          <span>{attraction.carTime}</span>
                        </span>
                      </div>

                      <a
                        href={attraction.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold transition-all shadow-2xs"
                      >
                        <Navigation className="w-3 h-3 text-sky-600" />
                        <span>เปิดเส้นทางไป {attraction.name}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Contact & Rental Banner */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold">
              {rentals.any ? '🛵' : '🧭'}
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                {rentals.any ? `มีบริการเช่า${rentals.names} ขับเที่ยวชิลๆ` : 'หาทางมาไม่เจอ? ทักแอดมินได้เลย'}
              </h4>
              <p className="text-xs text-slate-600">
                {rentals.any
                  ? 'ขับรับลมเลียบหาดบางแสน ขึ้นเขาสามมุข หรือแวะคาเฟ่หาดวอนนภาได้สบายๆ'
                  : 'แอดมินส่งพิกัดและจุดสังเกตทางเข้าให้ทาง LINE'}
              </p>
            </div>
          </div>

          <a
            href={buildLineChatUrl(gh, 'สอบถามเส้นทางการเดินทางไปที่พักครับ/ค่ะ')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold shadow-xs transition-all touch-manipulation cursor-pointer shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white" />
            <span>ทักไลน์สอบถามเส้นทาง</span>
          </a>
        </div>
      </div>
    </section>
  );
};
