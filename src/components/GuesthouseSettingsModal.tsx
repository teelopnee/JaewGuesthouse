import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Bike,
  Building,
  RotateCcw,
  Sparkles,
  Download,
} from 'lucide-react';
import { GuesthouseConfig } from '../types';
import { GUESTHOUSE_CONFIG } from '../data/config';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { isSwitchOn } from '../utils/rentalUtils';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface GuesthouseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Small "show to guests" switch for each rental type. */
const ShowSwitch: React.FC<{ on: boolean; onToggle: (on: boolean) => void; label: string }> = ({ on, onToggle, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={`${on ? 'ปิด' : 'เปิด'}บริการเช่า${label}`}
    onClick={() => onToggle(!on)}
    className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer shrink-0"
  >
    <span className={`relative w-8 h-5 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[14px]' : 'left-0.5'}`} />
    </span>
    <span className={on ? 'text-emerald-700' : 'text-slate-400'}>{on ? 'แสดง' : 'ซ่อน'}</span>
  </button>
);

export const GuesthouseSettingsModal: React.FC<GuesthouseSettingsModalProps> = ({ isOpen, onClose }) => {
  const { guesthouse: currentConfig, saveGuesthouseSettings, downloadBackup } = useAppData();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<GuesthouseConfig>(currentConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useBodyScrollLock(isOpen);

  // Load the saved values only when the window opens, so background refreshes never wipe what the admin is typing.
  useEffect(() => {
    if (isOpen) {
      setFormData(currentConfig);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.name.trim() || !formData.phonePrimary.trim() || !formData.lineId.trim() || !formData.lineOaUrl.trim()) {
      showToast('กรุณากรอกชื่อที่พัก เบอร์โทร LINE ID และลิงก์ LINE ให้ครบ', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await saveGuesthouseSettings(formData);
      setSaveSuccess(true);
      showToast('บันทึกข้อมูลที่พักเรียบร้อย ลูกค้าจะเห็นข้อมูลใหม่ทันที');
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    setIsDownloading(true);
    try {
      await downloadBackup();
      showToast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('ต้องการคืนค่าข้อมูลที่พักกลับเป็นค่าเริ่มต้นจากระบบใช่หรือไม่?')) {
      setFormData(GUESTHOUSE_CONFIG);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight">ตั้งค่าข้อมูลที่พัก & ติดต่อ</h3>
              <p className="text-xs text-slate-400 font-medium">
                ข้อมูลเบอร์โทรศัพท์ LINE แผนที่ และกฎเวลาเช็คอิน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>ชื่อที่พักและสโลแกน</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อที่พักภาษาไทย
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-sky-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อที่พักภาษาอังกฤษ
                </label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-sky-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สโลแกน / จุดเด่นที่พัก
              </label>
              <input
                type="text"
                value={formData.slogan}
                onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          {/* 2. Contact Information */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-sky-600" />
              <span>ข้อมูลเบอร์โทรศัพท์ติดต่อ</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรหลัก (สำหรับกดโทร เช่น 0641455635)
                </label>
                <input
                  type="tel"
                  value={formData.phonePrimary}
                  onChange={(e) => setFormData({ ...formData, phonePrimary: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-sky-500 outline-none font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ข้อความแสดงเบอร์โทรหลัก (เช่น 064-145-5635 (คุณจูน))
                </label>
                <input
                  type="text"
                  value={formData.phonePrimaryDisplay}
                  onChange={(e) =>
                    setFormData({ ...formData, phonePrimaryDisplay: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-sky-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. LINE Official Account */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>LINE Official Account</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LINE ID (เช่น @914wtbbq)
                </label>
                <input
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => {
                    const lineId = e.target.value;
                    // Keep the standard add-friend link in step with the ID so the QR,
                    // buttons and prefilled chats never point at different accounts.
                    // A custom link (e.g. lin.ee/...) is left alone.
                    const isStandardUrl = /^https:\/\/line\.me\/R\/ti\/p\/[^/?#]*$/.test(formData.lineOaUrl.trim()) || !formData.lineOaUrl.trim();
                    const id = lineId.trim();
                    setFormData({
                      ...formData,
                      lineId,
                      ...(isStandardUrl && id.startsWith('@') ? { lineOaUrl: `https://line.me/R/ti/p/${id}` } : {}),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-emerald-500 outline-none font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ลิงก์แอดเพื่อน LINE OA (URL)
                </label>
                <input
                  type="url"
                  value={formData.lineOaUrl}
                  onChange={(e) => setFormData({ ...formData, lineOaUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-emerald-500 outline-none font-mono text-emerald-800"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Location & Google Maps */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>ที่ตั้งและแผนที่ Google Maps</span>
            </h4>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ที่อยู่เต็มของที่พัก
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-rose-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ลิงก์ Google Maps (URL)
              </label>
              <input
                type="url"
                value={formData.googleMapsUrl}
                onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-rose-500 outline-none font-mono text-rose-800"
                required
              />
            </div>
          </div>

          {/* 5. Check-in / Check-out Times */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>เวลาเช็คอินและเช็คเอาท์</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เวลาเช็คอิน (Check-in)
                </label>
                <input
                  type="text"
                  value={formData.checkInTime}
                  onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="เช่น 13:00 น. หรือตามที่ตกลง"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เวลาเช็คเอาท์ (Check-out)
                </label>
                <input
                  type="text"
                  value={formData.checkOutTime}
                  onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="เช่น 11:30 น."
                />
              </div>
            </div>
          </div>

          {/* 6. Scooter & Extra Service Rates */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-teal-600" />
              <span>บริการเสริม & มอเตอร์ไซค์ให้เช่า</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    ค่าเช่ามอเตอร์ไซค์ไฟฟ้า (บาท / วัน)
                  </label>
                  <ShowSwitch
                    on={isSwitchOn(formData.electricScooterEnabled)}
                    onToggle={(on) => setFormData({ ...formData, electricScooterEnabled: on ? 'on' : 'off' })}
                    label="มอเตอร์ไซค์ไฟฟ้า"
                  />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.electricScooterPrice}
                  onChange={(e) => setFormData({ ...formData, electricScooterPrice: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-teal-500 outline-none"
                  placeholder="เช่น 200"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    ค่าเช่ามอเตอร์ไซค์ (บาท / วัน)
                  </label>
                  <ShowSwitch
                    on={isSwitchOn(formData.motorcycleEnabled)}
                    onToggle={(on) => setFormData({ ...formData, motorcycleEnabled: on ? 'on' : 'off' })}
                    label="มอเตอร์ไซค์"
                  />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.motorcyclePrice}
                  onChange={(e) => setFormData({ ...formData, motorcyclePrice: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-teal-500 outline-none"
                  placeholder="เช่น 350"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ข้อมูลที่จอดรถ
                </label>
                <input
                  type="text"
                  value={formData.parkingInfo || ''}
                  onChange={(e) => setFormData({ ...formData, parkingInfo: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-teal-500 outline-none"
                  placeholder="เช่น มีที่จอดรถฟรีหน้าบ้านและในพื้นที่"
                />
              </div>
            </div>
          </div>

          {/* 7. Backup */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-900 block">สำรองข้อมูลทั้งหมด (Backup)</span>
              <span className="text-[11px] text-slate-500">ห้องพัก ราคา รูป และสมุดจดการจอง เก็บไว้ในเครื่องเป็นไฟล์ .json</span>
            </div>
            <button
              type="button"
              onClick={handleBackup}
              disabled={isDownloading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'กำลังเตรียมไฟล์...' : 'ดาวน์โหลดไฟล์สำรอง'}</span>
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าเริ่มต้น</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : saveSuccess ? 'บันทึกแล้ว!' : 'บันทึกข้อมูล'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
