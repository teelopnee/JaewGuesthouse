import React from 'react';
import { RoomItem, DateSelection, CustomImagesMap } from '../types';
import { Sparkles, Users, ChevronRight } from 'lucide-react';
import { formatThaiDateRange } from '../utils/dateUtils';
import { getRoomImages, handleImageError } from '../utils/imageUtils';

interface SimilarRoomsSectionProps {
  rooms: RoomItem[];
  dates: DateSelection;
  onSelectRoom: (room: RoomItem) => void;
  customImagesMap?: CustomImagesMap;
  title?: string;
  subtitle?: string;
}

export const SimilarRoomsSection: React.FC<SimilarRoomsSectionProps> = ({
  rooms,
  dates,
  onSelectRoom,
  customImagesMap,
  title = '✨ ขอแนะนำห้องพักประเภทอื่นๆ ที่น่าสนใจ:',
  subtitle = 'ห้องพักขนาดและสไตล์ใกล้เคียงกันสำหรับการเข้าพักของคุณ',
}) => {
  if (rooms.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50/80 via-sky-50/60 to-slate-50/70 border border-sky-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 my-3 shadow-xs space-y-3">
      <div>
        <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-sm sm:text-base">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{title}</span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          {subtitle} ({formatThaiDateRange(dates.checkin, dates.checkout)})
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rooms.map((room) => (
          <button
            type="button"
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className="group w-full text-left bg-white rounded-2xl p-2.5 border border-slate-200 hover:border-sky-500 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-3 active:scale-[0.98] touch-manipulation"
          >
            {/* Thumbnail */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              <img
                src={getRoomImages(room, customImagesMap)[0]}
                alt={room.displayName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={handleImageError}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="block font-extrabold text-slate-900 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition-colors">
                  {room.roomNumber}
                </span>
                <span className="text-xs font-black text-emerald-600 shrink-0">
                  เริ่ม ฿{room.prices.weekday}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-1 truncate">
                <Users className="w-3 h-3 text-sky-600 shrink-0" />
                <span className="truncate">{room.capacityLabel}</span>
                <span>•</span>
                <span className="truncate">{room.zoneName}</span>
              </div>

              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                <span>เลือกดูห้องนี้</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
