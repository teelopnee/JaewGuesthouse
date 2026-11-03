import React, { useEffect, useState } from 'react';
import { X, Save, DollarSign, CheckCircle2, Tag, Search, Sliders, Sparkles } from 'lucide-react';
import { RoomItem, RoomOverride, PricingMode } from '../types';
import { getRoomNumberWithBuilding } from '../utils/roomUtils';
import { parsePriceNumber } from '../utils/pricingUtils';
import { useCreative } from '../context/CreativeContext';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AdminPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: RoomItem[];
  pricingMode?: PricingMode;
  onTogglePricingMode?: (mode: PricingMode) => void;
}

export const AdminPriceModal: React.FC<AdminPriceModalProps> = ({
  isOpen,
  onClose,
  rooms,
  pricingMode = 'full',
  onTogglePricingMode,
}) => {
  const { isCreativeMode, setIsCreativeMode } = useCreative();
  const { saveBulkRoomOverrides } = useAppData();
  const { showToast } = useToast();
  useBodyScrollLock(isOpen);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [weekdayPrice, setWeekdayPrice] = useState('500');
  const [saturdayPrice, setSaturdayPrice] = useState('800');
  const [specialSatPrice, setSpecialSatPrice] = useState('1,000');
  const [festivalPrice, setFestivalPrice] = useState('1,200');
  const [priceStartNum, setPriceStartNum] = useState(500);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedRoomIds([]);
      setSearchQuery('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.roomNumber.toLowerCase().includes(q) ||
      r.displayName.toLowerCase().includes(q) ||
      r.zoneName.toLowerCase().includes(q)
    );
  });

  const allFilteredSelected = filteredRooms.length > 0 && filteredRooms.every((r) => selectedRoomIds.includes(r.id));

  const handleSelectAll = () => {
    const filteredIds = filteredRooms.map((r) => r.id);
    if (allFilteredSelected) {
      setSelectedRoomIds(selectedRoomIds.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedRoomIds(Array.from(new Set([...selectedRoomIds, ...filteredIds])));
    }
  };

  const handleApplyPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (selectedRoomIds.length === 0) {
      showToast('กรุณาเลือกห้องพักอย่างน้อย 1 ห้องที่ต้องการเปลี่ยนราคา', 'error');
      return;
    }
    if (!parsePriceNumber(weekdayPrice)) {
      showToast('กรุณาใส่ราคาวันธรรมดาเป็นตัวเลข เช่น 500', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const override: RoomOverride = {
        priceStart: priceStartNum,
        prices: {
          weekday: weekdayPrice,
          saturday: saturdayPrice,
          specialSaturday: specialSatPrice,
          festival: festivalPrice,
        },
      };

      await saveBulkRoomOverrides(selectedRoomIds, override);
      setSuccessMessage(`อัปเดตราคาสำเร็จสำหรับ ${selectedRoomIds.length} ห้องพักเรียบร้อย!`);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1200);
    } catch (err) {
      showToast(`บันทึกราคาไม่สำเร็จ: ${(err as Error).message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black text-base">
              ฿
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                ระบบจัดการราคาห้องพักแบบกลุ่ม / รายห้อง (Admin Price Manager)
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                ตั้งค่าและเปลี่ยนเรทราคารวม / วันหยุดนักขัตฤกษ์
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="bg-emerald-600 text-white px-4 py-3 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleApplyPrices} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Canva Creative Mode Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 text-white space-y-3 border border-indigo-500/40 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                    Canva-Style Creative Mode (โหมดครีเอทีฟตกแต่งหน้าเว็บ)
                  </h4>
                  <p className="text-[11px] text-slate-300">ลาก ขยาย และแก้ไขข้อความหรือจัดวางหน้าแอพได้ทันทีเหมือนใน Canva</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreativeMode(!isCreativeMode);
                  onClose();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isCreativeMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isCreativeMode ? '🎨 ปิดโหมดครีเอทีฟ' : '✨ เปิดโหมดครีเอทีฟ'}</span>
              </button>
            </div>
          </div>

          {/* Mode Selector Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-800 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  โหมดการแสดงราคาของระบบ (Pricing Display Mode)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700 w-fit">
                โหมดปัจจุบัน: {pricingMode === 'full' ? '🏷️ แสดงราคาทุกวัน' : '💬 เฉพาะวันธรรมดา (วันอื่นทักถาม)'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal">
              เลือกวิธีที่ระบบจะแสดงราคาแก่ลูกค้าเมื่อเลือกวันในปฏิทิน:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Full Dynamic Rates */}
              <div
                onClick={() => onTogglePricingMode && onTogglePricingMode('full')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  pricingMode === 'full'
                    ? 'bg-emerald-950/70 border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>🏷️ โหมดแสดงราคาทุกวันและวันหยุด</span>
                    {pricingMode === 'full' && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                        ใช้งานอยู่
                      </span>
                    )}
                  </span>
                  <input
                    type="radio"
                    name="pricingDisplayMode"
                    checked={pricingMode === 'full'}
                    onChange={() => onTogglePricingMode && onTogglePricingMode('full')}
                    className="text-emerald-500 focus:ring-emerald-400 w-4 h-4 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  แสดงราคาที่คำนวณจริงทุกวัน (วันธรรมดา, เสาร์, นักขัตฤกษ์) พร้อมป้ายชื่อวันหยุด และมีราคาวันธรรมดาตัวเล็กเขียนอ้างอิง
                </p>
              </div>

              {/* Option 2: Weekday Only */}
              <div
                onClick={() => onTogglePricingMode && onTogglePricingMode('weekday_only')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  pricingMode === 'weekday_only'
                    ? 'bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>💬 โหมดแสดงเฉพาะวันธรรมดา</span>
                    {pricingMode === 'weekday_only' && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                        ใช้งานอยู่
                      </span>
                    )}
                  </span>
                  <input
                    type="radio"
                    name="pricingDisplayMode"
                    checked={pricingMode === 'weekday_only'}
                    onChange={() => onTogglePricingMode && onTogglePricingMode('weekday_only')}
                    className="text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  แสดงราคาเฉพาะวันธรรมดา (อา.-ศ.) ส่วนวันเสาร์และวันหยุดนักขัตฤกษ์จะขึ้นป้าย <strong className="text-amber-300">"ทักสอบถามราคา"</strong> เพื่อให้ลูกค้าทักคุย
                </p>
              </div>
            </div>
          </div>

          {/* Price inputs card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>กำหนดเรทราคาใหม่สำหรับห้องที่เลือก</span>
              </h4>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                เลือกอยู่ {selectedRoomIds.length} / {rooms.length} ห้อง
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  วันธรรมดา (อา.-ศ.)
                </label>
                <input
                  type="text"
                  value={weekdayPrice}
                  onChange={(e) => {
                    setWeekdayPrice(e.target.value);
                    const n = parsePriceNumber(e.target.value);
                    if (n) setPriceStartNum(n);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:border-emerald-500 font-bold text-slate-900 outline-none shadow-2xs"
                  placeholder="500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  วันเสาร์
                </label>
                <input
                  type="text"
                  value={saturdayPrice}
                  onChange={(e) => setSaturdayPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:border-emerald-500 font-bold text-slate-900 outline-none shadow-2xs"
                  placeholder="800"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  เสาร์พิเศษ / วันหยุดยาว
                </label>
                <input
                  type="text"
                  value={specialSatPrice}
                  onChange={(e) => setSpecialSatPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:border-emerald-500 font-bold text-slate-900 outline-none shadow-2xs"
                  placeholder="1,000"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-rose-700 mb-1">
                  วันหยุดนักขัตฤกษ์ / เทศกาล
                </label>
                <input
                  type="text"
                  value={festivalPrice}
                  onChange={(e) => setFestivalPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-rose-300 focus:border-rose-500 font-bold text-rose-700 outline-none shadow-2xs"
                  placeholder="1,200"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ราคาเริ่มต้น (แสดงผลการ์ด)
                </label>
                <input
                  type="number"
                  value={priceStartNum}
                  onChange={(e) => setPriceStartNum(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-36 px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:border-emerald-500 font-bold text-slate-900 outline-none shadow-2xs"
                />
              </div>
              <p className="text-[11px] text-emerald-800 self-end pb-2 font-medium">
                * ระบบจะคำนวณราคาวันหยุดนักขัตฤกษ์ วันเสาร์ และเสาร์หยุดยาว (มีวันหยุดติดศุกร์/อาทิตย์/จันทร์) ให้อัตโนมัติเมื่อลูกค้ากดเลือกวันในปฏิทิน
              </p>
            </div>
          </div>

          {/* Room Selection Checklist */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-sky-600" />
                <span>ติ๊กเลือกห้องพักที่ต้องการอัปเดตราคา</span>
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="ค้นหาห้อง..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-sky-500 outline-none w-40 sm:w-48 bg-slate-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer border border-slate-300"
                >
                  {allFilteredSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              </div>
            </div>

            {/* Grid of rooms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
              {filteredRooms.map((room) => {
                const isChecked = selectedRoomIds.includes(room.id);
                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedRoomIds(selectedRoomIds.filter((id) => id !== room.id));
                      } else {
                        setSelectedRoomIds([...selectedRoomIds, room.id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 block truncate">
                          {getRoomNumberWithBuilding(room)}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {room.capacityLabel} • ปกติ ฿{room.prices.weekday} | เสาร์ ฿{room.prices.saturday}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-rose-600 shrink-0">
                      หยุด ฿{room.prices.festival || room.prices.specialSaturday || room.prices.saturday}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || selectedRoomIds.length === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกเปลี่ยนราคา ({selectedRoomIds.length} ห้อง)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
