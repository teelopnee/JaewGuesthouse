import React from 'react';
import { Users, User, Home, Sparkles, Search, X } from 'lucide-react';
import { ZoneType } from '../types';
import { useCreative } from '../context/CreativeContext';
import { CreativeWrapper } from './CreativeWrapper';

export type BedFilterType = 'all' | '6ft' | '5ft' | '500baht';

export interface FilterOptions {
  capacity: number | null; // null for all
  bedFilter: BedFilterType;
  zone: ZoneType | 'all';
  searchQuery: string;
}

import { DateSelection, PricingMode, RoomItem } from '../types';
import { getThaiHolidayName } from '../utils/holidayUtils';
import { getDaysDifference, addDays, parseDate } from '../utils/dateUtils';
import { parsePriceNumber } from '../utils/pricingUtils';
import { getBuildingName } from '../utils/roomUtils';

interface CapacityFilterProps {
  filter: FilterOptions;
  onChangeFilter: (newFilter: FilterOptions) => void;
  countsByCapacity: Record<number, number>;
  countsByBed: { bed6: number; bed5: number; count500: number };
  totalRooms: number;
  filteredCount: number;
  dates?: DateSelection;
  rooms: RoomItem[];
  pricingMode: PricingMode;
}

export const CapacityFilter: React.FC<CapacityFilterProps> = ({
  filter,
  onChangeFilter,
  countsByBed,
  totalRooms,
  filteredCount,
  dates,
  rooms,
  pricingMode,
}) => {
  const { isCreativeMode } = useCreative();

  // Cheapest weekday price for each group, so the buttons follow the admin's price changes.
  const minWeekdayPrice = (capacity: number): string | null => {
    const prices = rooms
      .filter((r) => r.capacity === capacity)
      .map((r) => parsePriceNumber(r.prices.weekday, r.priceStart))
      .filter((n) => n > 0);
    return prices.length ? `${Math.min(...prices).toLocaleString()}.- / คืน` : null;
  };
  const price4 = minWeekdayPrice(4);
  const price6 = minWeekdayPrice(6);
  const price10 = minWeekdayPrice(10);

  // Only offer groups that have rooms open right now, so no button leads to an empty list.
  // (The admin gets every room in `rooms`, so they still see all buttons.)
  const countCapacity = (capacity: number) => rooms.filter((r) => r.capacity === capacity).length;
  const show = {
    bed6: countsByBed.bed6 > 0,
    bed5: countsByBed.bed5 > 0,
    room500: countsByBed.count500 > 0,
    cap4: countCapacity(4) > 0,
    cap6: countCapacity(6) > 0,
    cap10: countCapacity(10) > 0,
    cap15: countCapacity(15) > 0,
  };
  // "ตึกสวย • ตึก 14 • ตึกน้ำ" and the bed sizes, taken from the 500.- rooms that are open.
  const rooms500 = rooms.filter((r) => r.priceStart === 500);
  const buildings500 = [...new Set(rooms500.map(getBuildingName))].join(' • ');
  const bedSizes500 = [...new Set(rooms500.map((r) => r.bedSize).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const bedText500 = bedSizes500.length > 1
    ? `มีทั้งเตียง ${bedSizes500.join(' ฟุต และ ')} ฟุต`
    : bedSizes500.length === 1
    ? `เตียง ${bedSizes500[0]} ฟุต`
    : '';
  // Primary options
  const isAllSelected = filter.capacity === null && filter.bedFilter === 'all';
  const is2pBed6Selected = filter.capacity === 2 && filter.bedFilter === '6ft';
  const is2pBed5Selected = filter.capacity === 2 && filter.bedFilter === '5ft';
  const is500Selected = filter.bedFilter === '500baht';

  // Holiday / weekend detection for selected dates
  const activeHolidays: string[] = [];
  let hasSaturday = false;
  if (dates) {
    const nights = Math.max(1, getDaysDifference(dates.checkin, dates.checkout));
    for (let i = 0; i < nights; i++) {
      const d = addDays(dates.checkin, i);
      const h = getThaiHolidayName(d);
      if (h && !activeHolidays.includes(h)) activeHolidays.push(h);
      if (parseDate(d).getDay() === 6) hasSaturday = true;
    }
  }

  const hasActiveFilters =
    filter.capacity !== null ||
    filter.bedFilter !== 'all' ||
    filter.zone !== 'all' ||
    filter.searchQuery.trim() !== '';

  const scrollToRooms = () => {
    if (isCreativeMode) return;
    setTimeout(() => {
      const el = document.getElementById('rooms-list-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const handleSelectFilter = (newFilter: FilterOptions) => {
    onChangeFilter(newFilter);
    scrollToRooms();
  };

  return (
    <div
      id="room-filter-section"
      className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/90 mb-6 transition-all"
    >
      {/* 500 Baht Standout Spotlight Banner */}
      {show.room500 && (
      <CreativeWrapper id="highlight_banner_500" tag="div" className="w-full">
        <div
          onClick={() => {
            if (isCreativeMode) return;
            handleSelectFilter({ ...filter, capacity: null, bedFilter: '500baht' });
          }}
          className={`mb-4 p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all touch-manipulation border-2 ${
            is500Selected
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-500 shadow-md ring-2 ring-emerald-300/60'
              : 'bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50/80 hover:from-amber-100 hover:to-emerald-100 text-slate-900 border-amber-400 shadow-xs'
          }`}
          id="highlight-banner-500"
        >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex flex-col items-center justify-center font-black shadow-xs">
              <span className="text-[10px] leading-none uppercase font-bold tracking-tight text-amber-950">
                เพียง
              </span>
              <span className="text-base leading-none font-black">500.-</span>
              <span className="text-[9px] leading-none font-medium text-amber-900">/คืน</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-black tracking-wide shadow-xs animate-pulse">
                  🔥 จุดเด่นยอดฮิต
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                  ห้องพักเริ่มต้น 500 บาท/คืน{buildings500 ? ` (${buildings500})` : ''}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[11px] font-bold">
                  เริ่มต้น 500.-
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed flex flex-col justify-between">
                <span>📺 ทีวี • 🧊 ตู้เย็น • 🚿 เครื่องทำน้ำอุ่น • ❄️ แอร์ ครบทุกห้อง!{bedText500 ? ` (${bedText500})` : ''}</span>
              </p>
              {/* Dynamic context note to avoid conflict */}
              {activeHolidays.length > 0 ? (
                <div className="mt-1 text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 flex flex-col justify-between">
                  <span>⚠️ วันที่คุณเลือกตรงกับวันหยุดนักขัตฤกษ์ ({activeHolidays.join(', ')}): ราคา 500 บาทมีเฉพาะวันธรรมดา สำหรับวันหยุดระบบจะแสดงและคิดเรทตามวันหยุดจริง</span>
                </div>
              ) : hasSaturday ? (
                <div className="mt-1 text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex flex-col justify-between">
                  <span>⭐ วันที่คุณเลือกตรงกับคืนวันเสาร์: ราคา 500 บาทมีเฉพาะวันธรรมดา (อา.-ศ.) คืนวันเสาร์จะคิดเรทตามปฏิทินสุดสัปดาห์</span>
                </div>
              ) : (
                <div className="mt-1 text-[11px] font-semibold text-emerald-800 flex flex-col justify-between">
                  <span>🟢 ราคาวันธรรมดาสุดคุ้ม ตกเฉลี่ยคนละ 250 บาท เข้าพักได้สบายใจ</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 self-end sm:self-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-xs transition-all whitespace-nowrap ${
                is500Selected
                  ? 'bg-white text-emerald-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <span>{is500Selected ? '✓ กำลังดูห้อง 500.-' : 'แตะดูห้อง 500.- ทันที 👉'}</span>
            </span>
          </div>
        </div>
      </div>
      </CreativeWrapper>
      )}

      {/* Section Header - Clickable to scroll directly to rooms */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div
          onClick={scrollToRooms}
          className="flex items-center gap-2.5 cursor-pointer group select-none touch-manipulation"
          title="แตะเพื่อเลื่อนลงไปดูห้องพักทันที"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold group-hover:bg-sky-600 group-hover:text-white transition-colors shadow-2xs">
            <Users className="w-5 h-5 text-sky-600 group-hover:text-white transition-colors" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight flex items-center gap-1.5 flex-wrap">
              <span>เลือกตามจำนวนคน & เตียง</span>
              <span className="text-sky-600 group-hover:text-sky-700 font-semibold text-xs sm:text-sm inline-flex items-center gap-0.5 group-hover:underline">
                (แตะเพื่อดูกลุ่มห้องทันที ↓)
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {pricingMode === 'weekday_only'
                ? 'วันธรรมดาราคาเดียวชัดเจน • วันเสาร์ & วันหยุดนักขัตฤกษ์ติดต่อสอบถาม'
                : 'แสดงราคาตามวันที่เลือก • รวมราคาวันเสาร์ & วันหยุดนักขัตฤกษ์'}
            </p>
          </div>
        </div>

        {/* Counter Badge / Clear Filter */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => {
                onChangeFilter({
                  capacity: null,
                  bedFilter: 'all',
                  zone: 'all',
                  searchQuery: '',
                });
                scrollToRooms();
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 py-1 px-1.5 touch-manipulation cursor-pointer"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      {/* Main Capacity & Bed Fast Filter Buttons (Directly clickable grid on all devices) */}
      <div className="relative mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {/* 1. All */}
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: null, bedFilter: 'all' })}
            id="filter-cap-all"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              isAllSelected
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${isAllSelected ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">ทั้งหมด</span>
          </button>

          {/* 2. 2 คน เตียง 6 ฟุต */}
          {show.bed6 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 2, bedFilter: '6ft' })}
            id="filter-cap-2p-6ft"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              is2pBed6Selected
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-sky-50/50 hover:bg-sky-100/60 text-sky-900 border-sky-200/80 active:scale-95'
            }`}
          >
            <User className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${is2pBed6Selected ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-black leading-tight">2 คน เตียง 6 ฟุต</span>
          </button>
          )}

          {/* 3. 2 คน เตียง 5 ฟุต */}
          {show.bed5 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 2, bedFilter: '5ft' })}
            id="filter-cap-2p-5ft"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              is2pBed5Selected
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <User className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${is2pBed5Selected ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">2 คน เตียง 5 ฟุต</span>
          </button>
          )}

          {/* 4. เฉพาะห้อง 500 บาท - HIGHLIGHTED */}
          {show.room500 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: null, bedFilter: '500baht' })}
            id="filter-cap-500"
            className={`relative flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border-2 text-center ${
              is500Selected
                ? 'bg-gradient-to-b from-emerald-600 to-teal-700 text-white border-emerald-600 shadow-md shadow-emerald-200 scale-[1.03] ring-2 ring-emerald-300'
                : 'bg-gradient-to-b from-amber-50 to-emerald-50 hover:from-amber-100 hover:to-emerald-100 text-emerald-950 border-amber-400 shadow-xs active:scale-95'
            }`}
          >
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-white text-[9px] font-black tracking-tight shadow-xs">
              🔥 จุดเด่น
            </span>
            <User className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${is500Selected ? 'text-white' : 'text-emerald-700'}`} />
            <span className="text-xs sm:text-sm font-black leading-tight">ห้อง 500.-</span>
          </button>
          )}

          {/* 5. 4 คน */}
          {show.cap4 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 4, bedFilter: 'all' })}
            id="filter-cap-4"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              filter.capacity === 4
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <Users className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${filter.capacity === 4 ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">4 คน</span>
            {price4 && (
              <span
                className={`text-[10px] mt-0.5 leading-none ${
                  filter.capacity === 4 ? 'text-sky-100' : 'text-slate-400'
                }`}
              >
                {price4}
              </span>
            )}
          </button>
          )}

          {/* 6. 4 - 6 คน */}
          {show.cap6 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 6, bedFilter: 'all' })}
            id="filter-cap-6"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              filter.capacity === 6
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <Users className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${filter.capacity === 6 ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">4 - 6 คน</span>
            {price6 && (
              <span
                className={`text-[10px] mt-0.5 leading-none ${
                  filter.capacity === 6 ? 'text-sky-100' : 'text-slate-400'
                }`}
              >
                {price6}
              </span>
            )}
          </button>
          )}

          {/* 7. 8 - 10 คน */}
          {show.cap10 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 10, bedFilter: 'all' })}
            id="filter-cap-10"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              filter.capacity === 10
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <Users className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${filter.capacity === 10 ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">8 - 10 คน</span>
            {price10 && (
              <span
                className={`text-[10px] mt-0.5 leading-none ${
                  filter.capacity === 10 ? 'text-sky-100' : 'text-slate-400'
                }`}
              >
                {price10}
              </span>
            )}
          </button>
          )}

          {/* 8. 12 - 15 คน */}
          {show.cap15 && (
          <button
            onClick={() => handleSelectFilter({ ...filter, capacity: 15, bedFilter: 'all' })}
            id="filter-cap-15"
            className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl transition-all touch-manipulation cursor-pointer border text-center ${
              filter.capacity === 15
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-200 scale-[1.02] ring-2 ring-sky-300/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 active:scale-95'
            }`}
          >
            <Home className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${filter.capacity === 15 ? 'text-white' : 'text-sky-600'}`} />
            <span className="text-xs sm:text-sm font-bold leading-tight">12 - 15 คน</span>
            <span
              className={`text-[10px] mt-0.5 leading-none ${
                filter.capacity === 15 ? 'text-sky-100' : 'text-slate-400'
              }`}
            >
              บ้านเป็นหลัง
            </span>
          </button>
          )}
        </div>
      </div>

      {/* Optional Search Input */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={(e) => onChangeFilter({ ...filter, searchQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                scrollToRooms();
              }
            }}
            placeholder="ค้นหา เช่น Seaview, 204, 14, 500, บ้านหลัง, 6 ฟุต, 3 แอร์... (กด Enter เพื่อเลื่อนดู)"
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-800 placeholder:text-slate-400"
          />
          {filter.searchQuery && (
            <button
              onClick={() => {
                onChangeFilter({ ...filter, searchQuery: '' });
                scrollToRooms();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              aria-label="ล้างคำค้นหา"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
