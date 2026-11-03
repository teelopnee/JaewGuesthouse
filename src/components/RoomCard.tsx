import React, { useState } from 'react';
import {
  Users,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Images,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Camera,
  Edit3,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { RoomItem, RoomAvailability, DateSelection, PricingMode } from '../types';
import { buildLineChatUrl, phoneDisplayNumber } from '../data/config';
import { useGuesthouse } from '../context/AppDataContext';
import { formatThaiDate } from '../utils/dateUtils';
import { getApplicableDisplayPrice } from '../utils/pricingUtils';
import { getRoomNumberWithBuilding } from '../utils/roomUtils';
import { handleImageError } from '../utils/imageUtils';

interface RoomCardProps {
  room: RoomItem;
  availability?: RoomAvailability;
  dates: DateSelection;
  pricingMode?: PricingMode;
  onOpenDetails: (room: RoomItem) => void;
  onQuickBook?: (room: RoomItem) => void;
  images: string[];
  onManagePhotos?: (room: RoomItem) => void;
  isAdmin?: boolean;
  onToggleRental?: (room: RoomItem, isHidden: boolean) => void;
  onEditRoom?: (room: RoomItem) => void;
}

// Small pills on the photo: always one line, never wrap.
const pill = 'inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md';

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  availability,
  dates,
  pricingMode = 'full',
  onOpenDetails,
  onQuickBook,
  images,
  onManagePhotos,
  isAdmin = false,
  onToggleRental,
  onEditRoom,
}) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const gh = useGuesthouse();

  const displayImages = images.length > 0 ? images : room.images;
  const safeImgIndex = currentImgIndex < displayImages.length ? currentImgIndex : 0;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const isBooked = availability?.isBooked ?? false;
  const isHidden = isAdmin && Boolean(room.isHiddenFromRental);
  const is500Baht = room.priceStart === 500 && room.capacity === 2;
  const p = getApplicableDisplayPrice(dates, room.prices, pricingMode);
  const isSpecialDay = p.isHolidayRate || p.isWeekendRate;
  const waitlistLineUrl = buildLineChatUrl(
    gh,
    `สอบถามห้อง "${getRoomNumberWithBuilding(room)}" ช่วงวันที่ ${formatThaiDate(dates.checkin)} - ${formatThaiDate(dates.checkout)} (เผื่อมีห้องหลุดจอง)`
  );

  // ---- price block texts (each one short and on its own line) ----
  const rateLabel = p.isHolidayRate
    ? { text: `🎉 ราคาวันหยุด · ${p.holidayName}`, className: 'text-rose-700' }
    : p.isLongWeekendRate
    ? { text: '⭐ ราคาเสาร์หยุดยาว', className: 'text-amber-800' }
    : p.isWeekendRate
    ? { text: '⭐ ราคาวันเสาร์', className: 'text-amber-800' }
    : is500Baht
    ? { text: '🔥 ราคาวันธรรมดาสุดคุ้ม', className: 'text-emerald-700' }
    : { text: 'ราคาวันธรรมดา', className: 'text-slate-600' };

  const priceColor = isBooked
    ? 'text-slate-500'
    : p.isContactOnly
    ? 'text-amber-700'
    : p.isHolidayRate
    ? 'text-rose-600'
    : is500Baht && !isSpecialDay
    ? 'text-emerald-600'
    : 'text-sky-700';

  const priceNote: { text: string; className: string }[] = [];
  if (p.isContactOnly) {
    priceNote.push({ text: `ปกติวันธรรมดา ฿${p.weekdayPrice.toLocaleString()}`, className: 'text-slate-600' });
    priceNote.push({ text: 'วันหยุด/เสาร์ ทักถามราคาพิเศษ', className: 'text-amber-800 font-semibold' });
  } else {
    if (isSpecialDay) priceNote.push({ text: `ปกติวันธรรมดา ฿${p.weekdayPrice.toLocaleString()}`, className: 'text-slate-600' });
    if (p.nights > 1) {
      priceNote.push({
        text: `รวม ${p.nights} คืน ฿${p.totalPrice.toLocaleString()}`,
        className: 'text-emerald-700 font-semibold',
      });
    } else if (is500Baht && !isSpecialDay) {
      priceNote.push({ text: 'ตกคนละ ฿250', className: 'text-emerald-700 font-semibold' });
    }
  }

  return (
    <div
      onClick={() => onOpenDetails(room)}
      className={`group w-full bg-white rounded-2xl sm:rounded-3xl border transition-all overflow-hidden flex flex-col cursor-pointer active:scale-[0.99] touch-manipulation relative ${
        isHidden
          ? 'border-dashed border-rose-300 bg-rose-50/20 shadow-2xs'
          : isBooked
          ? 'border-rose-200 bg-slate-50/70 hover:border-rose-300 shadow-2xs'
          : is500Baht
          ? 'border-amber-300 hover:border-emerald-500 shadow-xs hover:shadow-lg ring-1 ring-amber-200/50'
          : 'border-slate-200/90 hover:border-sky-300 shadow-xs hover:shadow-md'
      }`}
      id={`room-card-${room.id}`}
    >
      {/* Admin quick controls */}
      {isAdmin && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 ${
            room.isHiddenFromRental ? 'bg-rose-50/90 border-rose-200' : 'bg-amber-50/90 border-amber-200'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold whitespace-nowrap text-white ${
              room.isHiddenFromRental ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          >
            {room.isHiddenFromRental ? <EyeOff className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {room.isHiddenFromRental ? 'ปิดปล่อยเช่า (ลูกค้าไม่เห็น)' : 'เปิดให้เช่า'}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleRental && (
              <button
                type="button"
                onClick={() => onToggleRental(room, !room.isHiddenFromRental)}
                className={`h-7 px-2.5 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  room.isHiddenFromRental
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700'
                }`}
                title={room.isHiddenFromRental ? 'เปิดให้ลูกค้าเช่าห้องนี้' : 'ปิดการปล่อยเช่าห้องนี้ชั่วคราว'}
              >
                {room.isHiddenFromRental ? 'เปิดห้อง' : 'ปิดห้อง'}
              </button>
            )}
            {onManagePhotos && (
              <button
                type="button"
                onClick={() => onManagePhotos(room)}
                className="h-7 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                title={`เปลี่ยน/อัปโหลดรูปห้อง ${room.roomNumber}`}
              >
                <Camera className="w-3.5 h-3.5 text-emerald-300" />
                <span>รูป</span>
              </button>
            )}
            {onEditRoom && (
              <button
                type="button"
                onClick={() => onEditRoom(room)}
                className="h-7 px-2.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                title="แก้ไขข้อมูล ราคา และสิ่งอำนวยความสะดวก"
              >
                <Edit3 className="w-3 h-3" />
                <span>แก้ไข</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo */}
      <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden">
        <img
          src={displayImages[safeImgIndex] || displayImages[0]}
          alt={room.displayName}
          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ${
            isBooked || isHidden ? 'grayscale-[35%] opacity-90' : ''
          }`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />

        {/* Top row: one status pill (left) + guests (right) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10 pointer-events-none">
          <div className="min-w-0">
            {isBooked ? (
              <span className={`${pill} bg-rose-600 text-white`}>🚫 เต็มแล้ว</span>
            ) : p.isHolidayRate ? (
              <span className={`${pill} bg-rose-600 text-white max-w-full`}>
                <span className="truncate">🎉 {p.holidayName}</span>
              </span>
            ) : p.isWeekendRate ? (
              <span className={`${pill} bg-amber-400 text-slate-950`}>⭐ วันเสาร์</span>
            ) : is500Baht ? (
              <span className={`${pill} bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 text-white`}>
                🔥 500.- วันธรรมดา
              </span>
            ) : null}
          </div>
          <span className={`${pill} bg-slate-900/85 backdrop-blur-md text-white shrink-0`}>
            <Users className="w-3.5 h-3.5 text-sky-300" />
            {room.capacityLabel}
          </span>
        </div>

        {/* Bottom row: building (left) + photo counter (right) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10 pointer-events-none">
          <span className="inline-flex items-center h-6 px-2 rounded-full bg-slate-900/75 backdrop-blur-md text-white text-[11px] font-semibold whitespace-nowrap min-w-0">
            <span className="truncate">{room.zoneName}</span>
          </span>
          {displayImages.length > 1 && (
            <span className="inline-flex items-center h-6 px-2 rounded-full bg-slate-900/75 text-white text-[11px] font-semibold shrink-0">
              {safeImgIndex + 1}/{displayImages.length}
            </span>
          )}
        </div>

        {displayImages.length > 1 && (
          <>
            <button
              onClick={prevImage}
              aria-label="รูปก่อนหน้า"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs opacity-80 hover:opacity-100 touch-manipulation cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextImage}
              aria-label="รูปถัดไป"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs opacity-80 hover:opacity-100 touch-manipulation cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Details */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {/* Name and bed share a line when they fit; otherwise the bed text moves down as a whole line */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h3
              className={`font-extrabold text-base sm:text-lg leading-snug max-w-full truncate ${
                isBooked ? 'text-slate-700' : 'text-slate-900 group-hover:text-sky-700'
              }`}
            >
              {room.roomNumber}
            </h3>
            <span className="text-xs font-bold text-sky-700 whitespace-nowrap max-w-full truncate">{room.bedType}</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {room.badges.map((b, badgeIdx) => {
              const highlight = b.includes('500') || b.includes('สุดคุ้ม');
              return (
                <span
                  key={`${b}-${badgeIdx}`}
                  className={`text-xs font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                    highlight
                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                      : 'bg-sky-50 text-sky-800 border-sky-100'
                  }`}
                >
                  {b}
                </span>
              );
            })}
          </div>

          {isBooked && (
            <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">เต็มแล้ว {formatThaiDate(dates.checkin)}</span>
              </span>
              <span className="font-bold text-sky-800 whitespace-nowrap shrink-0">ดูห้องแนะนำ 👉</span>
            </div>
          )}
        </div>

        {/* Price: label / big price / one short note */}
        <div className="pt-3 border-t border-slate-100 mt-auto flex flex-col gap-1">
          <span className={`text-xs font-bold truncate ${rateLabel.className}`}>{rateLabel.text}</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black leading-tight whitespace-nowrap ${priceColor}`}>{p.priceLabel}</span>
            {!p.isContactOnly && <span className="text-sm text-slate-500 whitespace-nowrap">/ คืน</span>}
          </div>
          {priceNote.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
              {priceNote.map((n, i) => (
                <React.Fragment key={n.text}>
                  {i > 0 && <span className="text-slate-300">·</span>}
                  <span className={`whitespace-nowrap ${n.className}`}>{n.text}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {isBooked ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(room);
              }}
              className="w-full flex items-center justify-center gap-2 h-11 px-3 rounded-xl sm:rounded-2xl bg-sky-700 hover:bg-sky-600 active:scale-[0.98] text-white text-sm font-extrabold shadow-sm transition-all touch-manipulation cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate">ดูห้องว่างที่ใกล้เคียง</span>
            </button>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <a
                href={waitlistLineUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all touch-manipulation whitespace-nowrap"
                title="ทักไลน์สอบถามคิวหลุดจอง"
              >
                <MessageCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">ถามคิวหลุดจอง</span>
              </a>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(room);
                }}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all touch-manipulation cursor-pointer whitespace-nowrap"
              >
                <Images className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">ดูรูป ({displayImages.length})</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickBook) onQuickBook(room);
                else window.open(gh.lineOaUrl, '_blank', 'noopener,noreferrer');
              }}
              className="w-full flex items-center justify-center gap-2 h-12 px-3 rounded-xl sm:rounded-2xl bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.98] text-white text-sm font-black shadow-sm shadow-emerald-200 transition-all touch-manipulation cursor-pointer whitespace-nowrap"
              id={`book-line-btn-${room.id}`}
            >
              <MessageCircle className="w-5 h-5 fill-white shrink-0" />
              <span className="truncate">{p.isContactOnly ? 'ทัก LINE ถามราคาห้องนี้' : 'จองห้องนี้ (ทัก LINE)'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
            </button>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <a
                href={`tel:${gh.phonePrimary}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-2 rounded-xl bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-800 text-xs font-bold border border-sky-200/70 transition-all touch-manipulation whitespace-nowrap"
                title={`โทรจองสายตรง ${phoneDisplayNumber(gh)}`}
              >
                <Phone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="truncate">โทร {phoneDisplayNumber(gh)}</span>
              </a>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(room);
                }}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold transition-all touch-manipulation cursor-pointer whitespace-nowrap"
              >
                <Images className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">ดูรูป ({displayImages.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
