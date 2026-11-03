import React from 'react';
import { useCreative } from '../context/CreativeContext';
import { Sparkles, RotateCcw, X, Type, Palette, Maximize2, EyeOff, Eye, Loader2, Check } from 'lucide-react';

export const CreativeToolbar: React.FC = () => {
  const { isCreativeMode, setIsCreativeMode, selectedId, setSelectedId, updateOverride, resetOverrides, getOverride, isSaving } =
    useCreative();

  if (!isCreativeMode) return null;

  const currentOverride = selectedId ? getOverride(selectedId) : undefined;

  return (
    <div className="fixed bottom-24 sm:bottom-6 right-3 sm:right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white border border-indigo-500/50 rounded-2xl shadow-2xl p-4 w-80 max-w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Canva Creative Mode</h3>
            <p className="text-[10px] text-slate-400">คลิกที่ข้อความหรือกรอบบนหน้าเว็บเพื่อแก้ไข</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreativeMode(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="ปิดโหมดครีเอทีฟ"
          aria-label="ปิดโหมดครีเอทีฟ"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {selectedId ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between bg-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-indigo-300 font-mono font-semibold">#{selectedId}</span>
            <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white text-[11px] cursor-pointer">
              ยกเลิกเลือก
            </button>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 mb-1">
              <Type className="w-3.5 h-3.5 text-indigo-400" /> แก้ไขข้อความ (Custom Text)
            </label>
            <input
              type="text"
              value={currentOverride?.customText || ''}
              onChange={(e) => updateOverride(selectedId, { customText: e.target.value })}
              placeholder="พิมพ์ข้อความใหม่ที่นี่... (เว้นว่าง = ข้อความเดิม)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 mb-1">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" /> ขนาดฟอนต์
              </label>
              <select
                value={currentOverride?.fontSize || ''}
                onChange={(e) => updateOverride(selectedId, { fontSize: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">ค่าเริ่มต้น (Default)</option>
                <option value="0.75rem">เล็กมาก (12px)</option>
                <option value="0.875rem">เล็ก (14px)</option>
                <option value="1rem">ปกติ (16px)</option>
                <option value="1.125rem">ใหญ่ (18px)</option>
                <option value="1.25rem">ใหญ่มาก (20px)</option>
                <option value="1.5rem">หัวข้อเล็ก (24px)</option>
                <option value="1.875rem">หัวข้อกลาง (30px)</option>
                <option value="2.25rem">หัวข้อใหญ่ (36px)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 mb-1">
                <Palette className="w-3.5 h-3.5 text-indigo-400" /> สีตัวอักษร
              </label>
              <select
                value={currentOverride?.textColor || ''}
                onChange={(e) => updateOverride(selectedId, { textColor: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">ค่าเริ่มต้น</option>
                <option value="#ffffff">สีขาว</option>
                <option value="#f8fafc">สีเทาอ่อน</option>
                <option value="#fbbf24">สีทอง/เหลือง</option>
                <option value="#38bdf8">สีฟ้า</option>
                <option value="#f43f5e">สีแดง/ชมพู</option>
                <option value="#4ade80">สีเขียว</option>
                <option value="#1e293b">สีเข้ม</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 font-medium block mb-1">สีพื้นหลังกรอบ</label>
              <select
                value={currentOverride?.bgColor || ''}
                onChange={(e) => updateOverride(selectedId, { bgColor: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">โปร่งใส</option>
                <option value="rgba(15, 23, 42, 0.8)">น้ำเงินเข้มโปร่งแสง</option>
                <option value="rgba(239, 68, 68, 0.2)">แดงอ่อน</option>
                <option value="rgba(59, 130, 246, 0.2)">ฟ้าอ่อน</option>
                <option value="#ffffff">ขาว</option>
                <option value="#0f172a">มืด</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-medium block mb-1">ซ่อนองค์ประกอบนี้</label>
              {currentOverride?.isHidden ? (
                <button
                  type="button"
                  onClick={() => updateOverride(selectedId, { isHidden: false })}
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg py-1.5 text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> แสดงอีกครั้ง
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateOverride(selectedId, { isHidden: true })}
                  className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg py-1.5 text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" /> ซ่อนชั่วคราว
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 py-6 text-center bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
          <p className="text-xs text-slate-400 px-2">
            💡 คลิกเลือกข้อความหรือกรอบใดก็ได้บนหน้าเว็บไซต์ เพื่อปรับแต่งข้อความ สี และขนาดแบบเรียลไทม์
          </p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <button onClick={resetOverrides} className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตทั้งหมด
        </button>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> กำลังบันทึก...
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" /> บันทึกให้ลูกค้าเห็นอัตโนมัติ
            </>
          )}
        </span>
      </div>
    </div>
  );
};
