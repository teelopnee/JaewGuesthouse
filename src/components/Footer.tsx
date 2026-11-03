import React, { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, Compass, ExternalLink, Waves, Copy, Check, Lock } from 'lucide-react';
import { useGuesthouse } from '../context/AppDataContext';
import { copyText } from '../utils/clipboard';

interface FooterProps {
  onOpenAdminPin?: () => void;
  isAdmin?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenAdminPin,
  isAdmin = false,
}) => {
  const [copied, setCopied] = useState(false);
  const activeConfig = useGuesthouse();

  const handleCopyLineId = async () => {
    if (await copyText(activeConfig.lineId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-10 pb-28 sm:pb-12 mt-12 border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-8 border-b border-slate-800">
          {/* Brand & Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold">
                <Waves className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h3 className="font-extrabold text-white text-lg tracking-tight">
                {activeConfig.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              ที่พักแหลมแท่น ชลบุรี ข้ามถนนถึงทะเล (ห่างจากหาดบางแสนประมาณ 300 เมตร) รองรับตั้งแต่ 2 ท่านจนถึงยกก๊วน 15 ท่าน พร้อมสิ่งอำนวยความสะดวกครบครัน สบายใจเหมือนอยู่บ้าน
            </p>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {activeConfig.checkInTime === activeConfig.checkOutTime
                    ? `เวลาเช็คอิน-เช็คเอาท์: ${activeConfig.checkInTime}`
                    : `เช็คอิน: ${activeConfig.checkInTime} • เช็คเอาท์: ${activeConfig.checkOutTime}`}
                </span>
              </div>
              {activeConfig.parkingInfo && (
                <div className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>ที่จอดรถ: {activeConfig.parkingInfo}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Box & LINE Add Friend */}
          <div className="space-y-3 sm:pl-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ติดต่อสอบถาม & จองห้องพัก
            </h4>

            {/* LINE OA CTA Card */}
            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-emerald-400 font-semibold block">
                  Official Account (ตอบเร็ว)
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-white font-mono select-all">
                    {activeConfig.lineId}
                  </span>
                  <button
                    onClick={handleCopyLineId}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer touch-manipulation flex items-center gap-1 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                    title="คัดลอก LINE ID"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-white" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>ก๊อป ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <a
                href={activeConfig.lineOaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold shadow-xs transition-all touch-manipulation shrink-0"
                id="footer-add-line-btn"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>แอดไลน์</span>
              </a>
            </div>

            {/* Direct Phone Number */}
            <div>
              <a
                href={`tel:${activeConfig.phonePrimary}`}
                className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-200 flex items-center justify-between gap-2 transition-all touch-manipulation"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">เบอร์โทรศัพท์ติดต่อ</span>
                    <span className="font-bold text-white text-sm select-all tracking-wide font-mono">{activeConfig.phonePrimaryDisplay}</span>
                  </div>
                </div>
                <span className="text-[11px] bg-sky-500/20 text-sky-300 font-semibold px-2.5 py-1 rounded-lg">
                  กดโทร
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Location & Map Section */}
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-white">ที่ตั้ง{activeConfig.name}</h5>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeConfig.address}
              </p>
            </div>
          </div>

          <a
            href={activeConfig.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold transition-all shrink-0 touch-manipulation"
            id="footer-maps-btn"
          >
            <Compass className="w-4 h-4" />
            <span>เปิดแผนที่ Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>

        {/* Bottom Credits & Secret Admin Access Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <p>© {new Date().getFullYear()} {activeConfig.name}. สงวนลิขสิทธิ์</p>
            {onOpenAdminPin && (
              <button
                type="button"
                onClick={onOpenAdminPin}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  isAdmin
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30'
                    : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
                }`}
                title={isAdmin ? "คุณอยู่ในโหมดผู้ดูแลระบบ" : "เข้าสู่โหมดผู้ดูแลระบบ (ใส่ PIN)"}
              >
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-semibold">{isAdmin ? 'แอดมิน (เปิดอยู่)' : 'ผู้ดูแล'}</span>
              </button>
            )}
          </div>
          <p className="text-slate-500">
            หน้านี้ออกแบบสำหรับการดูข้อมูลผ่าน LINE Official Account
          </p>
        </div>
      </div>
    </footer>
  );
};
