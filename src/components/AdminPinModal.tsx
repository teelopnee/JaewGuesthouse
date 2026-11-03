import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({ isOpen, onClose }) => {
  const { login, isAdmin, config } = useAppData();
  const { showToast } = useToast();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setIsLoading(false);
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (isAdmin) {
    // Already signed in - the footer button just confirms it.
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-3 animate-in zoom-in-95">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900">คุณอยู่ในโหมดผู้ดูแลระบบแล้ว</h3>
          <p className="text-xs text-slate-500">ใช้แถบเมนูแอดมินด้านบนสุดของหน้าเพื่อจัดการห้องพัก ราคา และสมุดจด</p>
          <button
            onClick={() => {
              onClose();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
          >
            ไปที่เมนูแอดมิน
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    if (!pin.trim()) {
      setErrorMsg('กรุณากรอกรหัส PIN');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await login(pin.trim());
      showToast('เข้าสู่โหมดผู้ดูแลระบบเรียบร้อย');
      onClose();
    } catch (err) {
      setPin('');
      setErrorMsg((err as Error).message || 'เกิดข้อผิดพลาดในการตรวจสอบรหัส');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + num);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="เข้าสู่โหมดผู้ดูแลระบบ"
        className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 max-h-[94vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">เข้าสู่โหมดผู้ดูแลระบบ</h3>
              <p className="text-xs text-slate-300 font-medium">เฉพาะเจ้าของและผู้จัดการที่พัก</p>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">กรอกรหัส PIN ผู้ดูแลระบบ</label>

              <div className="relative flex items-center justify-center">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setErrorMsg('');
                  }}
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono tracking-widest py-3 px-10 rounded-2xl border-2 border-slate-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 outline-none transition-all bg-slate-50 font-bold"
                  maxLength={8}
                  autoComplete="off"
                  aria-label="รหัส PIN"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  title={showPin ? 'ซ่อนรหัส' : 'แสดงรหัส'}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-rose-600 text-xs font-bold mt-2 animate-shake text-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Numeric Keypad for convenient mobile & touch entry */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyPress(num)}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-lg font-bold transition-all shadow-2xs cursor-pointer touch-manipulation font-mono"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 text-xs font-bold transition-all shadow-2xs cursor-pointer touch-manipulation"
              >
                ล้าง
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-lg font-bold transition-all shadow-2xs cursor-pointer touch-manipulation font-mono"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-rose-600 text-xs font-bold transition-all shadow-2xs cursor-pointer touch-manipulation"
              >
                ลบ ⌫
              </button>
            </div>

            {/* Hint (only while the factory PIN has not been changed yet) */}
            {config.isDefaultPin && (
              <p className="text-[11px] text-center text-slate-400 font-medium">
                💡 รหัสเริ่มต้นสำหรับเข้าใช้งาน: <span className="font-mono font-bold text-amber-600">1234</span>
              </p>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isLoading || pin.length === 0}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? 'กำลังตรวจ...' : 'ปลดล็อกแอดมิน'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
