import React from 'react';
import { Waves, Sparkles, MapPin, Bike, Eye } from 'lucide-react';
import { useGuesthouse } from '../context/AppDataContext';
import { getRentals } from '../utils/rentalUtils';
import { useCreative } from '../context/CreativeContext';
import { CreativeWrapper } from './CreativeWrapper';

interface HeroProps {
  onScrollToFilter: () => void;
  onSelect500Filter?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScrollToFilter, onSelect500Filter }) => {
  const { isCreativeMode } = useCreative();
  const gh = useGuesthouse();
  const rentals = getRentals(gh);
  // "แจ๋วเกสต์เฮ้าส์ แหลมแท่น By K.Joon" -> big name + smaller "By K.Joon"
  const byAt = gh.name.search(/\sBy\s/i);
  const titleMain = byAt > 0 ? gh.name.slice(0, byAt) : gh.name;
  const titleBy = byAt > 0 ? gh.name.slice(byAt + 1) : '';

  const handleScrollToLocation = () => {
    if (isCreativeMode) return;
    const el = document.getElementById('location-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-slate-50 pt-1.5 pb-4 sm:pb-6">
      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        {/* Main Hero Card with Coastal Beach Background */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-sky-100/80 bg-slate-900 text-white p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-4 min-h-[320px] sm:min-h-[380px]">
          {/* Background Image with optimized loading & overlay */}
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"
            alt="บรรยากาศริมทะเล"
            className="absolute inset-0 w-full h-full object-cover object-center scale-105"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          {/* Subtle gradient overlays for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/65 to-slate-900/40" />
          <div className="absolute inset-0 bg-sky-950/20 mix-blend-multiply" />

          {/* Top Badges inside Hero (In-Flow Flex Row) */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={handleScrollToLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 hover:bg-white text-sky-900 text-xs font-bold shadow-xs transition-all cursor-pointer touch-manipulation"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>แหลมแท่น บางแสน ชลบุรี (ดูแผนที่)</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span>เปิดรับจองทุกวัน</span>
            </div>
          </div>

          {/* Hero Main Content */}
          <div className="relative z-10 space-y-2 sm:space-y-3 my-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/25 border border-sky-300/40 backdrop-blur-md text-sky-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>สะดวก รวดเร็ว จองผ่าน LINE OA</span>
            </div>

            <div>
              <CreativeWrapper
                id="hero_title"
                tag="h1"
                defaultText={gh.name}
                className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight flex items-baseline flex-wrap gap-x-2"
              >
                <span>{titleMain}</span>
                {titleBy && <span className="text-amber-300 font-semibold text-base sm:text-2xl">{titleBy}</span>}
              </CreativeWrapper>
              
              <CreativeWrapper
                id="hero_slogan"
                tag="p"
                defaultText={`${gh.slogan} 🌊`}
                className="text-sm sm:text-xl font-bold text-amber-300 mt-1 block"
              />
            </div>

            <CreativeWrapper
              id="hero_desc"
              tag="p"
              defaultText={`ที่พักแหลมแท่นราคาสบายกระเป๋า ใกล้หาดบางแสน รองรับตั้งแต่ 2 ท่าน จนถึงยกก๊วน 12 - 15 ท่าน (ห้อง Seaview วิวทะเล, ห้องชุด, บ้านพักเป็นหลัง)${rentals.any ? ` พร้อมบริการ${rentals.names}ให้เช่า` : ''}`}
              className="text-xs sm:text-sm text-slate-200 max-w-xl font-normal leading-relaxed block"
            />

            {/* Quick feature tags */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-1 text-xs text-white/90">
              <CreativeWrapper id="hero_500_btn_wrapper" tag="div" className="w-full sm:w-auto inline-block">
                <button
                  type="button"
                  onClick={() => {
                    if (isCreativeMode) return;
                    if (onSelect500Filter) onSelect500Filter();
                    else onScrollToFilter();
                  }}
                  className="w-full sm:w-auto inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 active:scale-98 text-white font-black px-4 py-3 rounded-2xl shadow-md cursor-pointer transition-all touch-manipulation text-center"
                >
                  <span className="block">🔥 จุดเด่นยอดฮิต: เริ่มต้น 500.-/คืน</span>
                  <span className="block text-amber-100 text-xs sm:text-sm font-extrabold bg-black/20 px-2.5 py-0.5 rounded-lg">(กดดูห้อง 500) ➔</span>
                </button>
              </CreativeWrapper>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1.5 rounded-xl">
                  <Waves className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  ข้ามถนนถึงทะเลทันที
                </span>
                {rentals.any && (
                  <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-1.5 rounded-xl">
                    <Bike className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    {rentals.available
                      .map((r) => `${r.key === 'electric' ? 'เช่ารถไฟฟ้า' : 'มอเตอร์ไซค์'} ${r.price}.-`)
                      .join(' / ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CTA action buttons */}
          <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (isCreativeMode) return;
                onScrollToFilter();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-900 font-extrabold text-sm sm:text-base shadow-md transition-all touch-manipulation cursor-pointer"
              id="hero-find-room-btn"
            >
              <span>กดดูห้องพักทั้งหมด</span>
              <span className="text-lg">👇</span>
            </button>

            <button
              onClick={handleScrollToLocation}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-sm border border-white/30 transition-all touch-manipulation cursor-pointer"
            >
              <Eye className="w-4 h-4 text-teal-300 shrink-0" />
              <span>ดูแผนที่ & Street View 360°</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
