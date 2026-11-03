import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Phone, Copy, Check, Calendar, Users, ExternalLink, QrCode, Sparkles } from 'lucide-react';
import { RoomItem, DateSelection, PricingMode } from '../types';
import { buildLineChatUrl, phoneDisplayNumber } from '../data/config';
import { useGuesthouse } from '../context/AppDataContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { formatThaiDateRange } from '../utils/dateUtils';
import { calculateStayTotalPrice } from '../utils/pricingUtils';
import { copyText } from '../utils/clipboard';
import { handleImageError } from '../utils/imageUtils';

interface QuickBookingModalProps {
  room: RoomItem | null;
  dates: DateSelection;
  pricingMode?: PricingMode;
  images: string[];
  onClose: () => void;
  onOpenLineQr?: (roomName?: string) => void;
  isBooked?: boolean;
}

export const QuickBookingModal: React.FC<QuickBookingModalProps> = ({
  room,
  dates,
  pricingMode = 'full',
  images,
  onClose,
  onOpenLineQr,
  isBooked = false,
}) => {
  const [copied, setCopied] = useState(false);
  const gh = useGuesthouse();

  useBodyScrollLock(Boolean(room));
  useEscapeKey(Boolean(room), onClose);
  useEffect(() => setCopied(false), [room?.id]);

  if (!room) return null;

  const stayCalc = calculateStayTotalPrice(dates, room.prices, pricingMode);
  const activeHoliday = stayCalc.breakdown.find((b) => b.isHoliday);
  const hasSaturday = stayCalc.breakdown.some((b) => b.isSat);
  const hasLongWeekend = stayCalc.breakdown.some((b) => b.isLongWeekend);
  const priceOnRequest = stayCalc.hasInquiryNights;
  const coverImage = images[0] || room.images[0];

  const rateDetail = activeHoliday
    ? `เรทวันหยุดนักขัตฤกษ์ (${activeHoliday.holidayName})`
    : hasLongWeekend
    ? 'เรทเสาร์หยุดยาว'
    : hasSaturday
    ? 'เรทวันเสาร์/สุดสัปดาห์'
    : 'เรทวันธรรมดา';

  const priceLine = priceOnRequest
    ? `💰 อัตราค่าที่พัก: รบกวนแจ้งราคา (${rateDetail})`
    : `💰 อัตราค่าที่พัก: รวม ${stayCalc.total.toLocaleString()} บาท (${rateDetail})`;

  const bookingMessage = `สวัสดีครับ/ค่ะ สนใจจองห้องพัก${gh.name} 🌊
🏨 ที่พัก: ${room.displayName}
📅 วันที่เข้าพัก: ${formatThaiDateRange(dates.checkin, dates.checkout)}
👥 จำนวนผู้เข้าพัก: ${room.capacityLabel}
${priceLine}
------------------
${isBooked ? 'รบกวนแอดมินเช็คคิวหลุดจองให้หน่อยครับ/ค่ะ ขอบคุณครับ/ค่ะ' : 'รบกวนแอดมินเช็คห้องว่างและส่งเลขที่บัญชีมัดจำให้หน่อยครับ/ค่ะ ขอบคุณครับ/ค่ะ'}`;

  const lineChatUrl = buildLineChatUrl(gh, bookingMessage);

  const handleCopy = async () => {
    if (await copyText(bookingMessage)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const checkTimeText =
    gh.checkInTime === gh.checkOutTime
      ? `เวลาเช็คอิน-เช็คเอาท์: ${gh.checkInTime}`
      : `เวลาเช็คอิน ${gh.checkInTime} / เช็คเอาท์ ${gh.checkOutTime}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="จองห้องพักกับแอดมิน"
        className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">จองห้องพักกับแอดมิน</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Room Summary Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 via-white to-slate-50 border border-sky-200/80 flex items-center gap-3.5 shadow-2xs">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
              <img
                src={coverImage}
                alt={room.displayName}
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={handleImageError}
              />
              <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] px-1 py-0.5 rounded font-bold">
                {Math.max(images.length, 1)} รูป
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide">{room.zoneName}</span>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight truncate">{room.displayName}</h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-semibold text-sky-800">
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  {room.capacityLabel}
                </span>
                <span>•</span>
                <span className="font-semibold truncate">{room.bedType}</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                {priceOnRequest ? (
                  <span className="text-base font-black text-amber-600">ทักสอบถามราคา</span>
                ) : (
                  <>
                    <span className={`text-base font-black ${activeHoliday ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ฿{stayCalc.total.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {stayCalc.nights === 1 ? '/คืน' : `(รวม ${stayCalc.nights} คืน)`}
                    </span>
                  </>
                )}
                {activeHoliday ? (
                  <span className="text-[10px] bg-rose-100 text-rose-900 font-bold px-1.5 py-0.5 rounded ml-1 border border-rose-200">
                    🎉 {activeHoliday.holidayName}
                  </span>
                ) : hasSaturday ? (
                  <span className="text-[10px] bg-sky-100 text-sky-900 font-bold px-1.5 py-0.5 rounded ml-1 border border-sky-200">
                    เรทวันเสาร์
                  </span>
                ) : (
                  room.priceStart === 500 && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded ml-1">
                      คนละ 250.-
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Date & Stay Info */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-slate-600">
              <span className="flex items-center gap-1.5 font-medium shrink-0">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                ช่วงวันเข้าพัก:
              </span>
              <span className="font-bold text-slate-900 text-right">{formatThaiDateRange(dates.checkin, dates.checkout)}</span>
            </div>
            {isBooked ? (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-1.5">
                <span>⚠️ ห้องนี้มีผู้จองในวันที่เลือกแล้ว สามารถทักสอบถามคิวหลุดจองได้ครับ</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                <span>ยอดประเมินรวม:</span>
                <span className={`font-extrabold text-sm ${priceOnRequest ? 'text-amber-700' : 'text-slate-900'}`}>
                  {priceOnRequest ? 'ทักสอบถามราคาวันหยุด/วันเสาร์' : `฿${stayCalc.total.toLocaleString()} บาท`}
                </span>
              </div>
            )}
          </div>

          {/* Fast Actions */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>เลือกวิธีจองที่สะดวก:</span>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                แนะนำทัก LINE ตอบไวสุด
              </span>
            </div>

            <a
              href={lineChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-md transition-all touch-manipulation cursor-pointer bg-[#06C755] hover:bg-[#05b34c] shadow-emerald-200 text-center"
              id="quick-book-line-cta"
            >
              <MessageCircle className="w-5 h-5 fill-white shrink-0" />
              <span>เปิด LINE ทักจองทันที (ข้อความพิมพ์ให้อัตโนมัติ)</span>
              <ExternalLink className="w-4 h-4 ml-0.5 opacity-80 shrink-0" />
            </a>

            <a
              href={`tel:${gh.phonePrimary}`}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl active:scale-[0.98] text-slate-800 font-bold text-xs sm:text-sm bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-all touch-manipulation cursor-pointer"
              id="quick-book-phone-cta"
            >
              <Phone className="w-4 h-4 text-sky-600 shrink-0" />
              <span>โทรจองสายตรง: {phoneDisplayNumber(gh)}</span>
            </a>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all touch-manipulation cursor-pointer ${
                  copied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>คัดลอกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>

              {onOpenLineQr && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenLineQr(room.displayName);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all touch-manipulation cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สแกน QR LINE</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold block">💡 ข้อมูลการจองที่พัก:</span>
            <span>
              • แอดมินตอบแชทและรับสายทุกวัน ({checkTimeText})
              <br />• มัดจำ 50% เพื่อล็อคห้องพัก ที่เหลือชำระวันเข้าพัก
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
