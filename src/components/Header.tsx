import React from 'react';
import { Phone, MessageCircle, Waves, MapPin, QrCode, ChevronRight } from 'lucide-react';
import { useCreative } from '../context/CreativeContext';
import { useGuesthouse } from '../context/AppDataContext';
import { FloatingShareButton } from './FloatingShareButton';

interface HeaderProps {
  onOpenLineQr?: (roomName?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLineQr }) => {
  const { isCreativeMode } = useCreative();
  const gh = useGuesthouse();
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100 shadow-2xs">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2">
        {/* Brand Logo & Name */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 text-left group shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 flex items-center justify-center text-white shadow-xs shadow-sky-200 shrink-0">
            <Waves className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight tracking-tight">
                {gh.name}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-full hidden sm:inline-block">
                แหลมแท่น
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-semibold flex items-center gap-1 leading-none mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span>ข้ามถนนถึงทะเล · ห่างหาดบางแสน ~300ม.</span>
            </p>
          </div>
        </a>

        {/* Quick Contact & Navigation Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -my-1 min-w-0 pr-6">
          {onOpenLineQr && (
            <button
              onClick={() => onOpenLineQr()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 transition-all touch-manipulation cursor-pointer border border-emerald-200 shrink-0"
              title="สแกน QR Code"
              aria-label="สแกน QR Code LINE"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
            </button>
          )}

          <button
            onClick={() => {
              if (isCreativeMode) return;
              const el = document.getElementById('location-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-700 transition-all touch-manipulation cursor-pointer border border-sky-200 shrink-0"
            title="ดูแผนที่"
            aria-label="ดูแผนที่"
          >
            <MapPin className="w-4 h-4 text-rose-500" />
          </button>

          <a
            href={`tel:${gh.phonePrimary}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all touch-manipulation shrink-0"
            title="โทรสอบถาม"
            aria-label="โทรสอบถาม"
            id="header-call-btn"
          >
            <Phone className="w-4 h-4 text-sky-600" />
          </a>

          <FloatingShareButton variant="header" />

          <a
            href={gh.lineOaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white shadow-xs transition-all touch-manipulation shrink-0"
            id="header-line-btn"
            title="ติดต่อ LINE"
            aria-label="ติดต่อ LINE"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
          </a>

          <div className="flex items-center justify-center w-4 h-8 text-slate-400 shrink-0 pointer-events-none">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
