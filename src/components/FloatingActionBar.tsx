import React from 'react';
import { Phone, MessageCircle, Calendar } from 'lucide-react';
import { phoneDisplayNumber } from '../data/config';
import { useGuesthouse } from '../context/AppDataContext';
import { DateSelection } from '../types';
import { formatThaiDateRange } from '../utils/dateUtils';

interface FloatingActionBarProps {
  dates?: DateSelection;
  availableCount?: number;
  onOpenDatesModal: () => void;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({ dates, availableCount, onOpenDatesModal }) => {
  const gh = useGuesthouse();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:hidden px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto space-y-1.5">
        {/* Top Mini Info Bar (Tappable to change dates) */}
        {dates && (
          <div className="flex items-center justify-between gap-2 text-[11px] px-1 font-semibold text-slate-600">
            <button
              type="button"
              onClick={onOpenDatesModal}
              className="flex items-center gap-1.5 min-w-0 text-slate-700 hover:text-sky-700 active:scale-95 transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {formatThaiDateRange(dates.checkin, dates.checkout)}
              </span>
              <span className="text-sky-600 underline text-[10px] shrink-0">เปลี่ยน</span>
            </button>

            {typeof availableCount === 'number' && (
              <span className="flex items-center gap-1 shrink-0 whitespace-nowrap font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ว่าง {availableCount} ห้อง
              </span>
            )}
          </div>
        )}

        {/* Primary Action Buttons Row */}
        <div className="grid grid-cols-12 gap-2 items-center">
          {/* Quick Call Button */}
          <a
            href={`tel:${gh.phonePrimary}`}
            className="col-span-5 flex items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-900 text-xs font-bold border border-sky-200 shadow-2xs transition-all touch-manipulation cursor-pointer"
            id="floating-call-btn"
            aria-label={`โทร ${phoneDisplayNumber(gh)}`}
          >
            <Phone className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="truncate">
              {/* The phone icon already says "call"; the number alone fits common 375px phones. */}
              <span className="min-[360px]:hidden">โทร</span>
              <span className="hidden min-[360px]:inline">{phoneDisplayNumber(gh)}</span>
            </span>
          </a>

          {/* Big LINE OA CTA Button */}
          <a
            href={gh.lineOaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-7 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.98] text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-200/80 transition-all touch-manipulation cursor-pointer"
            id="floating-line-btn"
          >
            <MessageCircle className="w-4 h-4 fill-white shrink-0" />
            <span className="truncate">ทัก LINE จองที่พัก</span>
          </a>
        </div>
      </div>
    </div>
  );
};
