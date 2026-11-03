import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Copy,
  Check,
  Calendar,
  CalendarDays,
  Sparkles,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Camera,
  Edit3,
  EyeOff,
  ShieldCheck as ShieldIcon,
} from 'lucide-react';
import { RoomItem, RoomAvailability, DateSelection, PricingMode, CustomImagesMap } from '../types';
import { buildLineChatUrl } from '../data/config';
import { useGuesthouse } from '../context/AppDataContext';
import { getRentals } from '../utils/rentalUtils';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { copyText } from '../utils/clipboard';
import { handleImageError } from '../utils/imageUtils';
import { SimilarRoomsSection } from './SimilarRoomsSection';
import { formatThaiDateRange, formatThaiDate } from '../utils/dateUtils';
import { getRoomNumberWithBuilding } from '../utils/roomUtils';
import { calculateStayTotalPrice, parsePriceNumber } from '../utils/pricingUtils';

interface RoomModalProps {
  room: RoomItem | null;
  onClose: () => void;
  availability?: RoomAvailability;
  dates: DateSelection;
  pricingMode?: PricingMode;
  similarRooms: RoomItem[];
  onSelectRoom: (room: RoomItem) => void;
  onOpenLineQr?: (roomName?: string) => void;
  images: string[];
  customImagesMap?: CustomImagesMap;
  onManagePhotos?: (room: RoomItem) => void;
  isAdmin?: boolean;
  onEditRoom?: (room: RoomItem) => void;
  onToggleRental?: (room: RoomItem, isHidden: boolean) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  room,
  onClose,
  availability,
  dates,
  pricingMode = 'full',
  similarRooms,
  onSelectRoom,
  onOpenLineQr,
  images,
  customImagesMap,
  onManagePhotos,
  isAdmin = false,
  onEditRoom,
  onToggleRental,
}) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const gh = useGuesthouse();

  const displayImages = images.length > 0 ? images : room?.images || [];
  const safeImgIndex = currentImgIndex < displayImages.length ? currentImgIndex : 0;

  // Reset image index & scroll position when a different room is opened
  useEffect(() => {
    setCurrentImgIndex(0);
    setCopied(false);
    if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
  }, [room?.id]);

  useBodyScrollLock(Boolean(room));
  useEscapeKey(Boolean(room), onClose);

  if (!room) return null;

  const stayCalc = calculateStayTotalPrice(dates, room.prices, pricingMode);
  const weekdayBaseNum = parsePriceNumber(room.prices.weekday, 500);

  const isBooked = availability?.isBooked ?? false;
  const roomNameWithBuilding = getRoomNumberWithBuilding(room);
  // Same details as the quick-booking message, so the admin can quote straight away.
  const bookingMessageText = isBooked
    ? `สวัสดีครับ/ค่ะ สอบถามห้อง "${roomNameWithBuilding}" ช่วงวันที่ ${formatThaiDateRange(dates.checkin, dates.checkout)} เผื่อมีคิวหลุดจองครับ/ค่ะ`
    : [
        `สวัสดีครับ/ค่ะ สนใจจองห้องพัก${gh.name} 🌊`,
        `🏨 ที่พัก: ${room.displayName}`,
        `📅 วันที่เข้าพัก: ${formatThaiDateRange(dates.checkin, dates.checkout)}`,
        `👥 จำนวนผู้เข้าพัก: ${room.capacityLabel}`,
        stayCalc.hasInquiryNights
          ? '💰 อัตราค่าที่พัก: รบกวนแจ้งราคา'
          : `💰 อัตราค่าที่พัก: รวม ${stayCalc.total.toLocaleString()} บาท`,
        'รบกวนแอดมินเช็คห้องว่างและส่งเลขที่บัญชีมัดจำให้หน่อยครับ/ค่ะ',
      ].join('\n');
  const lineChatUrl = buildLineChatUrl(gh, bookingMessageText);

  const handleCopyMessage = async () => {
    if (await copyText(bookingMessageText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={room.displayName}
        className="relative z-10 w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8"
      >
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-20">
          <div className="pr-4">
            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wide">
              {room.zoneName}
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
              {room.roomNumber}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all touch-manipulation cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div ref={scrollBodyRef} className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 space-y-4">
          {/* Date Summary Header inside Modal */}
          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between gap-2 text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-xs sm:text-sm block text-slate-900">
                  ช่วงเวลาเข้าพักที่คุณเลือก
                </span>
                <span className="text-[11px] text-sky-800 font-bold block">
                  วันที่: {formatThaiDateRange(dates.checkin, dates.checkout)}
                </span>
              </div>
            </div>
            {isBooked ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black shrink-0 shadow-xs">
                🚫 เต็มแล้ว
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shrink-0">
                ว่างพร้อมจอง
              </span>
            )}
          </div>

          {/* Booked Alert Banner if room is booked */}
          {isBooked && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-extrabold block">🚫 ห้องนี้เต็มแล้วในวันที่เลือก ({formatThaiDateRange(dates.checkin, dates.checkout)})</span>
                  <span className="text-[11px] text-rose-700">
                    {similarRooms.length > 0
                      ? 'แนะนำเลือกดูห้องว่างที่ใกล้เคียงกันด้านล่าง หรือทักไลน์สอบถามคิวหลุดจอง'
                      : 'ลองเปลี่ยนวันเข้าพัก หรือทักไลน์สอบถามคิวหลุดจองได้เลย'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Main Photo Carousel */}
          <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
            <img
              src={displayImages[safeImgIndex] || displayImages[0]}
              alt={room.displayName}
              className={`w-full h-full object-cover object-center ${
                isBooked ? 'grayscale-[20%]' : ''
              }`}
              referrerPolicy="no-referrer"
              onError={handleImageError}
            />

            {/* Badges on image */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {room.priceStart === 500 && room.capacity === 2 && !isBooked && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600 text-white text-xs font-black shadow-md animate-pulse">
                  🔥 จุดเด่นยอดฮิต 500.-/คืน
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-xs font-bold shadow-xs">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>พักได้ {room.capacityLabel}</span>
              </span>
            </div>

            {/* Prev/Next buttons */}
            {displayImages.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentImgIndex(
                      (prev) => (prev - 1 + displayImages.length) % displayImages.length
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all touch-manipulation cursor-pointer"
                  aria-label="รูปก่อนหน้า"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setCurrentImgIndex((prev) => (prev + 1) % displayImages.length)
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all touch-manipulation cursor-pointer"
                  aria-label="รูปถัดไป"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Thumbnails row */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-md rounded-full">
                  {displayImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImgIndex(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === safeImgIndex ? 'bg-amber-400 scale-125' : 'bg-white/60'
                      }`}
                      aria-label={`เลือกรูปที่ ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Photo counter */}
                <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold pointer-events-none">
                  {safeImgIndex + 1} / {displayImages.length}
                </span>
              </>
            )}
          </div>

          {/* Photo Thumbnail Strip & Manage Photos trigger */}
          <div className="space-y-2">
            {displayImages.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {displayImages.map((img, idx) => (
                  <button
                    key={idx}
                    id={`room-modal-thumb-${idx}`}
                    type="button"
                    onClick={() => setCurrentImgIndex(idx)}
                    className={`relative rounded-xl overflow-hidden aspect-[16/10] border-2 transition-all cursor-pointer group bg-slate-100 ${
                      idx === safeImgIndex
                        ? 'border-sky-600 ring-2 ring-sky-300 shadow-sm scale-[1.02]'
                        : 'border-slate-200 opacity-75 hover:opacity-100 hover:border-sky-400'
                    }`}
                    aria-label={`ดูรูปที่ ${idx + 1}`}
                  >
                    <img
                      id={`room-modal-thumb-img-${idx}`}
                      src={img}
                      alt={`${room.displayName} - รูปที่ ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={handleImageError}
                    />
                    <span
                      className={`absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        idx === safeImgIndex
                          ? 'bg-sky-600 text-white'
                          : 'bg-black/60 text-white/90'
                      }`}
                    >
                      {idx === 0 ? 'ปก' : `${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Admin Controls Box inside Modal */}
            {isAdmin && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldIcon className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-950">
                      จัดการห้องพัก (Admin Mode)
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      room.isHiddenFromRental
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {room.isHiddenFromRental ? '⛔ ปิดการปล่อยเช่า' : '✅ เปิดให้เช่าอยู่'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                  {onToggleRental && (
                    <button
                      type="button"
                      onClick={() => onToggleRental(room, !room.isHiddenFromRental)}
                      className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1 ${
                        room.isHiddenFromRental
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                      }`}
                    >
                      {room.isHiddenFromRental ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>เปิดให้เช่าห้องนี้</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>ปิดการปล่อยเช่า</span>
                        </>
                      )}
                    </button>
                  )}

                  {onEditRoom && (
                    <button
                      type="button"
                      onClick={() => onEditRoom(room)}
                      className="w-full py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไขข้อมูลห้อง</span>
                    </button>
                  )}

                  {onManagePhotos && (
                    <button
                      type="button"
                      onClick={() => onManagePhotos(room)}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>จัดการรูป ({displayImages.length})</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-sky-50/80 border border-sky-100">
              <span className="text-sky-700 block text-[10px] font-semibold">ชั้น / ตำแหน่ง</span>
              <span className="font-extrabold text-sky-950 text-xs sm:text-sm">{room.floorLabel || 'อาคารพัก'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] font-medium">รูปแบบเตียง</span>
              <span className="font-bold text-slate-800 text-[11px] sm:text-xs truncate block">{room.bedType}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px] font-medium">ระบบแอร์</span>
              <span className="font-bold text-slate-800 text-[11px] sm:text-xs">
                {room.coolingType === 'air' ? 'แอร์' : 'พัดลม'}
              </span>
            </div>
          </div>

          {/* Core Amenities Highlight Grid */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
            <span className="text-[11px] font-bold text-amber-900 block mb-2">
              ✨ อุปกรณ์อำนวยความสะดวกพร้อมในห้อง:
            </span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-white border border-amber-100 shadow-2xs flex flex-col items-center justify-center">
                <span className="text-base mb-0.5">📺</span>
                <span className="font-extrabold text-slate-800 text-[11px]">ทีวี (TV)</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-amber-100 shadow-2xs flex flex-col items-center justify-center">
                <span className="text-base mb-0.5">🧊</span>
                <span className="font-extrabold text-slate-800 text-[11px]">ตู้เย็น</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-amber-100 shadow-2xs flex flex-col items-center justify-center">
                <span className="text-base mb-0.5">🚿</span>
                <span className="font-extrabold text-slate-800 text-[11px]">น้ำอุ่น</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-amber-100 shadow-2xs flex flex-col items-center justify-center">
                <span className="text-base mb-0.5">❄️</span>
                <span className="font-extrabold text-slate-800 text-[11px]">แอร์เย็นฉ่ำ</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {room.description && (
            <p className="text-sm text-slate-600 leading-relaxed bg-sky-50/50 p-3.5 rounded-xl border border-sky-100/60">
              {room.description}
            </p>
          )}

          {/* Pricing Breakdown Section */}
          <div className="border border-sky-100 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-sky-600 px-4 py-2.5 flex items-center justify-between text-white">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-300" />
                อัตราค่าห้องพักตามวันที่ท่านเลือก ({stayCalc.nights} คืน)
              </span>
              <span className="text-[10px] text-sky-100 font-medium">คำนวณตามปฏิทินจริง</span>
            </div>

            <div className="divide-y divide-slate-100 bg-white text-xs">
              {stayCalc.breakdown.map((night, idx) => (
                <div key={idx} className={`p-3 flex items-center justify-between gap-2 ${night.isHoliday ? 'bg-rose-50/70' : night.isSat ? 'bg-sky-50/50' : 'bg-amber-50/30'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        {formatThaiDate(night.date)}
                      </span>
                      {night.isHoliday ? (
                        <span className="px-2 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-2xs">
                          🎉 {night.holidayName} (วันหยุดนักขัตฤกษ์)
                        </span>
                      ) : night.isSat ? (
                        <span className="px-2 py-0.2 rounded-full bg-sky-600 text-white text-[10px] font-bold">
                          {night.isLongWeekend ? '⭐ วันเสาร์ (หยุดยาว)' : '⭐ วันเสาร์ (วันหยุดสุดสัปดาห์)'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          🟢 วันธรรมดา (อา.-ศ.)
                        </span>
                      )}

                      {night.isContactOnly && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black">
                          💬 ทักสอบถามราคา
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {night.isContactOnly ? (
                        <span className="text-amber-800 font-bold">
                          (ราคาวันธรรมดาปกติ ฿{weekdayBaseNum.toLocaleString()} • วันหยุด/เสาร์ กรุณาทักสอบถามราคาพิเศษ)
                        </span>
                      ) : night.isHoliday ? (
                        <span className="text-rose-700 font-bold">
                          (ราคาวันธรรมดาปกติ ฿{weekdayBaseNum.toLocaleString()} • ปรับเรทวันหยุด {night.holidayName})
                        </span>
                      ) : night.isSat ? (
                        <span className="text-sky-700 font-bold">
                          (ราคาวันธรรมดาปกติ ฿{weekdayBaseNum.toLocaleString()} • {night.isLongWeekend ? 'ปรับเรทเสาร์หยุดยาว' : 'ปรับเรทวันเสาร์'})
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">ราคาวันธรรมดาสุดคุ้มมาตรฐาน</span>
                      )}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {night.isContactOnly ? (
                      <span className="text-xs sm:text-sm font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg block">
                        ทักสอบถาม
                      </span>
                    ) : (
                      <>
                        <span className="text-base sm:text-lg font-black text-emerald-700 block">
                          ฿{night.price.toLocaleString()}
                        </span>
                        {night.price !== weekdayBaseNum && (
                          <span className="text-[10px] text-slate-400 line-through block">
                            ฿{weekdayBaseNum.toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Total Stay Price Summary Bar */}
              <div className={`p-3.5 border-t flex items-center justify-between ${
                stayCalc.hasInquiryNights ? 'bg-amber-50/90 border-amber-200' : 'bg-emerald-50/90 border-emerald-200'
              }`}>
                <div>
                  <span className={`font-extrabold text-sm block ${
                    stayCalc.hasInquiryNights ? 'text-amber-950' : 'text-emerald-950'
                  }`}>
                    รวมยอดค่าห้องพักทั้งสิ้น ({stayCalc.nights} คืน)
                  </span>
                  <span className={`text-[11px] ${
                    stayCalc.hasInquiryNights ? 'text-amber-800 font-semibold' : 'text-emerald-800'
                  }`}>
                    {stayCalc.hasInquiryNights
                      ? '* มีคืนที่เป็นวันหยุด/วันเสาร์ กรุณาทักแชท LINE เพื่อสอบถามราคาพิเศษ'
                      : 'รวมภาษีและค่าบริการเรียบร้อยแล้ว'}
                  </span>
                </div>
                <div className="text-right">
                  {stayCalc.hasInquiryNights ? (
                    <span className="text-base sm:text-lg font-black text-amber-700 block">
                      ทักสอบถามราคา
                    </span>
                  ) : (
                    <>
                      <span className="text-xl sm:text-2xl font-black text-emerald-700">
                        ฿{stayCalc.total.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-emerald-800 block">บาท</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Full Amenities Grid */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5">
              สิ่งอำนวยความสะดวกในห้อง
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {room.amenities.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span className="leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Guesthouse Guidelines */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>เวลาเช็คอิน-เช็คเอาท์</span>
            </div>
            {gh.checkInTime === gh.checkOutTime ? (
              <p>
                • เวลาเช็คอิน-เช็คเอาท์: <strong>{gh.checkInTime}</strong>
              </p>
            ) : (
              <>
                <p>
                  • เวลาเช็คอิน: <strong>{gh.checkInTime}</strong>
                </p>
                <p>
                  • เวลาเช็คเอาท์: <strong>{gh.checkOutTime}</strong>
                </p>
              </>
            )}
            {getRentals(gh).any && (
              <p className="text-[11px] text-slate-500">
                • มีบริการเช่า{getRentals(gh).names}ขับชมวิวริมหาด
              </p>
            )}
          </div>

          {/* Similar Rooms Recommendation Section */}
          {similarRooms && similarRooms.length > 0 && (
            <div className="pt-2">
              <SimilarRoomsSection
                rooms={similarRooms}
                dates={dates}
                customImagesMap={customImagesMap}
                onSelectRoom={(r) => onSelectRoom(r)}
                title={isBooked ? '🚫 ห้องนี้เต็มแล้ว — ขอแนะนำห้องใกล้เคียงที่ยังว่าง:' : '✨ ขอแนะนำห้องพักประเภทใกล้เคียง:'}
                subtitle={isBooked ? 'ห้องพักขนาดและราคาใกล้เคียงกันที่ยังว่างสำหรับวันดังกล่าว' : 'ห้องพักขนาดและสไตล์ใกล้เคียงกันสำหรับการเข้าพักของคุณ'}
              />
            </div>
          )}
          {isBooked && similarRooms.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-extrabold block">ช่วงวันที่เลือก ห้องใกล้เคียงเต็มหมดแล้ว</span>
              <span>ลองเปลี่ยนวันเข้าพัก หรือกดทัก LINE ด้านล่างเพื่อให้แอดมินแจ้งเมื่อมีคิวหลุดจอง</span>
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shadow-lg space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Primary CTA Button */}
          <a
            href={lineChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-md transition-all touch-manipulation cursor-pointer bg-[#06C755] hover:bg-[#05b34c] shadow-emerald-200"
            id={`modal-book-line-${room.id}`}
          >
            <MessageCircle className="w-5 h-5 fill-white shrink-0" />
            <span>
              {isBooked
                ? 'ทัก LINE ถามคิวหลุดจองห้องนี้'
                : stayCalc.hasInquiryNights
                ? 'ทัก LINE สอบถามราคาและจองห้องนี้'
                : 'ทัก LINE จองห้องนี้ทันที (ตอบไว)'}
            </span>
            <ExternalLink className="w-4 h-4 ml-0.5 opacity-80 shrink-0" />
          </a>

          {/* Secondary Helpers: Direct Call, QR Scan & Copy Text */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <a
              href={`tel:${gh.phonePrimary}`}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold transition-all touch-manipulation"
            >
              <Phone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="truncate">โทร {gh.phonePrimaryDisplay}</span>
            </a>

            <button
              onClick={handleCopyMessage}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all touch-manipulation cursor-pointer truncate ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title={bookingMessageText}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">คัดลอกข้อความ</span>
                </>
              )}
            </button>

            {onOpenLineQr && (
              <button
                onClick={() => onOpenLineQr(room.displayName)}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition-all touch-manipulation cursor-pointer truncate"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">สแกน QR LINE</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
