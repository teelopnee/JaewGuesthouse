import React, { useEffect, useState } from 'react';
import { X, KeyRound, Check, AlertCircle } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface AdminChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminChangePinModal: React.FC<AdminChangePinModalProps> = ({ isOpen, onClose }) => {
  const { changePin } = useAppData();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPin.trim()) {
      setErrorMsg('กรุณากรอกรหัส PIN ปัจจุบัน');
      return;
    }
    if (newPin.trim().length < 4) {
      setErrorMsg('รหัส PIN ใหม่ต้องมีอย่างน้อย 4 หลัก');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('รหัส PIN ใหม่และยืนยันรหัสไม่ตรงกัน');
      return;
    }
    if (newPin === currentPin) {
      setErrorMsg('รหัส PIN ใหม่ต้องไม่ซ้ำกับรหัสเดิม');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePin(currentPin.trim(), newPin.trim());
      setSuccessMsg('เปลี่ยนรหัส PIN เรียบร้อยแล้ว! (อุปกรณ์อื่นที่เคยเข้าแอดมินไว้ต้องใส่รหัสใหม่)');
      setTimeout(onClose, 1800);
    } catch (err) {
      setErrorMsg((err as Error).message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัส PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-500 font-mono tracking-wider outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="เปลี่ยนรหัส PIN แอดมิน"
        className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 max-h-[94vh] overflow-y-auto"
      >
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-base">เปลี่ยนรหัส PIN แอดมิน</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">รหัส PIN ปัจจุบัน</label>
            <input
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="กรอกรหัสเดิม"
              className={inputClass}
              maxLength={8}
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">รหัส PIN ใหม่ (ตัวเลข 4-8 หลัก)</label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="กรอกรหัสใหม่"
              className={inputClass}
              maxLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ยืนยันรหัส PIN ใหม่</label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="กรอกรหัสใหม่อีกครั้ง"
              className={inputClass}
              maxLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(successMsg)}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังเปลี่ยน...' : 'บันทึกรหัสใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
