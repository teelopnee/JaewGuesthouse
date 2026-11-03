import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, MessageCircle, Copy, Check, ExternalLink, Phone, Smartphone, ShieldCheck, X, Download } from 'lucide-react';
import { useGuesthouse } from '../context/AppDataContext';
import { getRentals } from '../utils/rentalUtils';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { copyText } from '../utils/clipboard';

interface LineQRCodeCardProps {
  roomName?: string;
  className?: string;
  showInModal?: boolean;
  onClose?: () => void;
}

export const LineQRCodeCard: React.FC<LineQRCodeCardProps> = ({
  roomName,
  className = '',
  showInModal = false,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const gh = useGuesthouse();

  const lineUrl = gh.lineOaUrl;
  const lineId = gh.lineId;
  const phoneMatch = /^(.*?)\s*(\(.*\))?\s*$/.exec(gh.phonePrimaryDisplay || '');
  const phoneNumberText = (phoneMatch?.[1] || gh.phonePrimary).trim();
  const phoneNameText = phoneMatch?.[2] || '';

  // Generate QR code client-side instantly for maximum reliability and offline support
  useEffect(() => {
    QRCode.toDataURL(lineUrl, {
      width: 450,
      margin: 2,
      color: {
        dark: '#044e29', // Deep Forest Emerald
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });
  }, [lineUrl]);

  const handleCopyLineId = async () => {
    if (await copyText(lineId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `LINE-QR-JaewGuesthouse.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-emerald-200/90 shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-xs border border-white/20">
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                ติดต่อ & จองห้องผ่าน LINE OA
              </h3>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/25 text-white text-xs font-black tracking-wider">
                {lineId}
              </span>
            </div>
            <p className="text-xs text-emerald-50/90 mt-0.5 leading-snug">
              {roomName
                ? `สอบถามห้อง "${roomName}" โดยตรงกับแอดมิน`
                : `จองห้องพัก สอบถามคิวว่าง${getRentals(gh).any ? ' หรือเช็คมอเตอร์ไซค์' : ''} ตอบไวทุกวัน`}
            </p>
          </div>
        </div>

        {showInModal && onClose && (
          <button
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer touch-manipulation shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Body Container */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-emerald-50/30 to-white flex-1 flex flex-col justify-between gap-5">
        {/* Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* QR Code Container (Left on desktop, center on mobile) */}
          <div className="md:col-span-5 flex flex-col items-center justify-center">
            <div className="relative p-3 bg-white rounded-2xl border-2 border-emerald-500/80 shadow-md ring-4 ring-emerald-100/60 max-w-[240px] sm:max-w-[260px] w-full flex flex-col items-center">
              {/* QR Image */}
              <div className="relative aspect-square w-full bg-white rounded-xl overflow-hidden flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code LINE Official Account ${gh.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400 text-xs py-8">
                    <QrCode className="w-8 h-8 animate-spin text-emerald-500" />
                    <span>กำลังโหลด QR...</span>
                  </div>
                )}

                {/* Center Badge */}
                {qrDataUrl && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[#06C755] border-2 border-white shadow-md flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white fill-white" />
                  </div>
                )}
              </div>

              {/* QR Caption & Download Button */}
              <div className="mt-2.5 flex items-center justify-between w-full px-1 pt-1 border-t border-slate-100 text-[11px]">
                <span className="font-bold text-emerald-800">
                  📱 สแกนด้วยกล้องมือถือ
                </span>
                {qrDataUrl && (
                  <button
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-700 font-semibold cursor-pointer touch-manipulation transition-colors"
                    title="บันทึกรูป QR Code"
                  >
                    <Download className="w-3 h-3" />
                    <span>บันทึกรูป</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Column (Right on desktop) */}
          <div className="md:col-span-7 space-y-3">
            {/* Direct Mobile Tap Button */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>เปิดผ่านแอปบนมือถือ</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  ไม่ต้องสแกน
                </span>
              </div>

              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-sm transition-all touch-manipulation cursor-pointer text-center"
              >
                <MessageCircle className="w-5 h-5 fill-white shrink-0" />
                <span>แตะเพื่อเปิด LINE OA ({lineId}) ทันที</span>
                <ExternalLink className="w-4 h-4 opacity-80 shrink-0" />
              </a>
            </div>

            {/* LINE ID & Copy Card - Compact & Clean */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-xs">
                  @
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider leading-none">
                    LINE Official Account ID
                  </div>
                  <div className="text-xs sm:text-sm font-black text-slate-900 tracking-wider select-all block leading-tight truncate mt-0.5">
                    {lineId}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLineId}
                className={`inline-flex items-center justify-center gap-1 py-1.5 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer touch-manipulation shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 shadow-2xs active:scale-[0.98]'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>คัดลอก ID</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct Phone Call Card - Compact & In-Line */}
            <a
              href={`tel:${gh.phonePrimary}`}
              className="p-2.5 sm:p-3 rounded-2xl bg-sky-50/80 hover:bg-sky-100/90 border border-sky-200 flex items-center justify-between gap-2 sm:gap-3 transition-all cursor-pointer touch-manipulation text-sky-950 group shadow-2xs"
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-sky-800 leading-none">
                    โทรสอบถามหรือจองด่วน
                  </div>
                  <div className="flex items-baseline gap-1.5 leading-tight mt-0.5 whitespace-nowrap overflow-hidden">
                    <span className="text-xs sm:text-sm font-black text-sky-950 tracking-tight">
                      {phoneNumberText}
                    </span>
                    {phoneNameText && (
                      <span className="text-[11px] sm:text-xs font-bold text-sky-700">{phoneNameText}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 sm:px-3 rounded-xl bg-sky-600 group-hover:bg-sky-700 text-white text-[11px] sm:text-xs font-bold shrink-0 shadow-2xs transition-colors whitespace-nowrap">
                <Phone className="w-3 h-3" />
                <span>โทรออก</span>
              </div>
            </a>

            {/* Booking Steps Pill */}
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>ขั้นตอนการจอง:</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                1. แชทแจ้งห้องพัก/วันที่ต้องการ • 2. แอดมินสรุปยอดมัดจำ • 3. ยืนยันห้องพักทันที
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LineQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
}

export const LineQRCodeModal: React.FC<LineQRCodeModalProps> = ({
  isOpen,
  onClose,
  roomName,
}) => {
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <LineQRCodeCard
          roomName={roomName}
          showInModal={true}
          onClose={onClose}
          className="shadow-2xl ring-1 ring-black/10"
        />
      </div>
    </div>
  );
};
