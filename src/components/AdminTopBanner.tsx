import React from 'react';
import {
  ShieldCheck,
  Settings,
  KeyRound,
  LogOut,
  CheckCircle,
  EyeOff,
  RotateCcw,
  BookOpen,
  DollarSign,
  Tag,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { PricingMode } from '../types';

interface AdminTopBannerProps {
  totalRooms: number;
  openRoomsCount: number;
  closedRoomsCount: number;
  todayBookingsCount?: number;
  pricingMode?: PricingMode;
  onTogglePricingMode?: (mode: PricingMode) => void;
  onOpenBookings: () => void;
  onOpenGuesthouseSettings: () => void;
  onOpenChangePin: () => void;
  onOpenPriceManager?: () => void;
  onLogout: () => void;
  onResetAllSettings?: () => void;
  showOnlyClosedRooms?: boolean;
  onToggleShowOnlyClosed?: () => void;
  isDefaultPin?: boolean;
}

export const AdminTopBanner: React.FC<AdminTopBannerProps> = ({
  totalRooms,
  openRoomsCount,
  closedRoomsCount,
  todayBookingsCount = 0,
  pricingMode = 'full',
  onTogglePricingMode,
  onOpenBookings,
  onOpenGuesthouseSettings,
  onOpenChangePin,
  onOpenPriceManager,
  onLogout,
  onResetAllSettings,
  showOnlyClosedRooms = false,
  onToggleShowOnlyClosed,
  isDefaultPin = false,
}) => {
  return (
    <div className="relative sm:sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border-b-2 border-amber-500 transition-all">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Admin Status & Stats */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>โหมดผู้ดูแลระบบ (Admin)</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800">
              <CheckCircle className="w-3 h-3" />
              <span>เปิดให้เช่า {openRoomsCount}</span>
            </span>
            {closedRoomsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800">
                <EyeOff className="w-3 h-3" />
                <span>ปิดการเช่า {closedRoomsCount}</span>
              </span>
            )}
          </div>

          {isDefaultPin && (
            <button
              onClick={onOpenChangePin}
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white cursor-pointer animate-pulse"
              title="ยังใช้รหัส PIN เริ่มต้น 1234 อยู่ ใครก็เดาได้ กรุณาเปลี่ยน"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>ยังใช้ PIN 1234 • กดเปลี่ยน</span>
            </button>
          )}

          {closedRoomsCount > 0 && onToggleShowOnlyClosed && (
            <button
              onClick={onToggleShowOnlyClosed}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                showOnlyClosedRooms
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {showOnlyClosedRooms ? 'แสดงห้องทั้งหมด' : `ดูเฉพาะห้องที่ปิด (${closedRoomsCount})`}
            </button>
          )}
        </div>

        {/* Pricing Mode Segmented Toggle */}
        {onTogglePricingMode && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 sm:p-1 rounded-xl border border-slate-700/80 text-[11px] font-bold shadow-inner">
            <span className="text-[10px] text-slate-400 font-semibold px-1.5 hidden lg:inline">
              โหมดราคา:
            </span>
            <button
              type="button"
              onClick={() => onTogglePricingMode('full')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                pricingMode === 'full'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="โหมดแสดงราคาทุกวัน: แสดงราคาทุกวันตามปฏิทินจริง รวมวันหยุดและวันเสาร์"
            >
              <Tag className="w-3 h-3" />
              <span>ราคาทุกวัน</span>
              {pricingMode === 'full' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onTogglePricingMode('weekday_only')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                pricingMode === 'weekday_only'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="โหมดวันธรรมดาอย่างเดียว: แสดงเฉพาะวันธรรมดา วันหยุด/วันเสาร์ขึ้นให้ทักสอบถามราคา"
            >
              <MessageSquare className="w-3 h-3" />
              <span className="hidden sm:inline">เฉพาะวันธรรมดา (วันอื่นทักถาม)</span>
              <span className="sm:hidden">วันธรรมดาเท่านั้น</span>
              {pricingMode === 'weekday_only' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        )}

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
          {/* Bookings Ledger button */}
          <button
            onClick={onOpenBookings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
            title="เปิดสมุดจดห้องพักและจัดการรายการจอง"
          >
            <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>📖 สมุดจดห้องพัก</span>
            {todayBookingsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] font-mono font-bold">
                {todayBookingsCount}
              </span>
            )}
          </button>

          {/* Price Manager button */}
          {onOpenPriceManager && (
            <button
              onClick={onOpenPriceManager}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              title="เปลี่ยนราคาห้องพัก & วันหยุดนักขัตฤกษ์"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>💷 เปลี่ยนราคา</span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={onOpenGuesthouseSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-2xs"
            title="ปรับแต่งข้อมูลติดต่อ ที่พัก กฎระเบียบ"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xs:inline">ตั้งค่าที่พัก & ติดต่อ</span>
            <span className="xs:hidden">ตั้งค่า</span>
          </button>

          {/* Change PIN button */}
          <button
            onClick={onOpenChangePin}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
            title="เปลี่ยนรหัส PIN แอดมิน"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">เปลี่ยน PIN</span>
          </button>

          {/* Reset All */}
          {onResetAllSettings && (
            <button
              onClick={onResetAllSettings}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-rose-900/60 active:scale-95 text-slate-400 hover:text-rose-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title="คืนค่าข้อมูลทั้งหมดเป็นค่าเริ่มต้น"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">คืนค่าเริ่มต้น</span>
            </button>
          )}

          {/* Exit Admin Mode */}
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer ml-1"
            title="ออกจากโหมดผู้ดูแลระบบ"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออก</span>
          </button>
        </div>
      </div>
    </div>
  );
};
