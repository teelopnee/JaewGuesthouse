import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  RotateCcw,
  Check,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
} from 'lucide-react';
import { RoomItem } from '../types';
import { optimizeImageFile, handleImageError } from '../utils/imageUtils';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface RoomPhotoModalProps {
  room: RoomItem | null;
  onClose: () => void;
  currentImages: string[];
  hasCustomImages: boolean;
}

const SLOT_LABELS = [
  'รูปที่ 1 (รูปหน้าปก ⭐)',
  'รูปที่ 2',
  'รูปที่ 3',
  'รูปที่ 4',
];

export const RoomPhotoModal: React.FC<RoomPhotoModalProps> = ({ room, onClose, currentImages, hasCustomImages }) => {
  const { uploadImage, saveRoomImages, resetRoomImages } = useAppData();
  const { showToast } = useToast();
  const isOpen = Boolean(room);
  useBodyScrollLock(isOpen);
  const [slots, setSlots] = useState<string[]>(['', '', '', '']);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingSlot, setProcessingSlot] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeUrlInputSlot, setActiveUrlInputSlot] = useState<number | null>(null);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load the room's photos when a room is opened. Not on every background refresh,
  // otherwise the admin's unsaved changes would be thrown away.
  useEffect(() => {
    if (room) {
      const initial = [...currentImages];
      // Keep at least 4 slots for easy filling, or all existing images if more
      while (initial.length < 4) {
        initial.push('');
      }
      setSlots(initial);
      setStatusMessage(null);
      setActiveUrlInputSlot(null);
      setUrlInputValue('');
    }
  }, [room?.id]);

  if (!isOpen || !room) return null;

  // Add another photo slot
  const handleAddSlot = () => {
    if (slots.length >= 16) {
      setStatusMessage({ type: 'error', text: 'สามารถเพิ่มรูปภาพได้สูงสุด 16 รูป' });
      return;
    }
    setSlots((prev) => [...prev, '']);
    setStatusMessage({ type: 'success', text: `เพิ่มช่องรูปภาพที่ ${slots.length + 1} แล้ว` });
  };

  // Delete a slot completely
  const handleDeleteSlot = (slotIndex: number) => {
    if (slots.length <= 1) {
      setSlots(['']);
      return;
    }
    setSlots((prev) => prev.filter((_, idx) => idx !== slotIndex));
    setStatusMessage(null);
  };

  // Handle local image file upload & compression
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingSlot(slotIndex);
    setStatusMessage(null);

    try {
      const optimizedDataUrl = await optimizeImageFile(file);
      const url = await uploadImage(optimizedDataUrl);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = url;
        return next;
      });
      setStatusMessage({
        type: 'success',
        text: `อัปโหลดรูปช่องที่ ${slotIndex + 1} เรียบร้อย (กด "บันทึก" เพื่อให้ลูกค้าเห็น)`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดไฟล์รูปนี้ได้',
      });
    } finally {
      setIsProcessing(false);
      setProcessingSlot(null);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  // Handle URL submission
  const handleApplyUrl = (slotIndex: number) => {
    const url = urlInputValue.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setStatusMessage({ type: 'error', text: 'ลิงก์รูปต้องขึ้นต้นด้วย https:// หรือ http://' });
      return;
    }
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = urlInputValue.trim();
      return next;
    });
    setActiveUrlInputSlot(null);
    setUrlInputValue('');
  };

  // Clear photo inside slot
  const handleClearSlot = (slotIndex: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = '';
      return next;
    });
  };

  // Swap slots (reorder)
  const handleSwapSlots = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= slots.length) return;
    setSlots((prev) => {
      const next = [...prev];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      // Filter out blank slots
      const validImages = slots.filter((url) => url && url.trim().length > 0);
      if (validImages.length === 0) {
        setStatusMessage({ type: 'error', text: 'กรุณาใส่รูปภาพอย่างน้อย 1 รูปสำหรับห้องนี้' });
        setIsSaving(false);
        return;
      }

      await saveRoomImages(room.id, validImages);
      setStatusMessage({ type: 'success', text: `บันทึกรูปภาพห้อง ${room.roomNumber} สำเร็จแล้ว!` });
      showToast(`บันทึกรูปภาพห้อง ${room.roomNumber} แล้ว ลูกค้าเห็นรูปใหม่ทันที`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `บันทึกรูปภาพไม่สำเร็จ: ${(err as Error).message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original default images
  const handleReset = async () => {
    if (!window.confirm(`ต้องการคืนค่ารูปภาพเดิมของห้อง ${room.roomNumber} ใช่หรือไม่?`)) {
      return;
    }
    setIsSaving(true);
    try {
      await resetRoomImages(room.id);
      setStatusMessage({ type: 'success', text: 'คืนค่ารูปภาพเดิมของห้องสำเร็จแล้ว' });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `ไม่สามารถคืนค่ารูปภาพได้: ${(err as Error).message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-sky-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  จัดการรูปภาพ: ห้อง {room.roomNumber}
                </h3>
                {hasCustomImages && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    ใช้รูปที่แก้ไขแล้ว
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {room.displayName} · {room.zoneName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        {statusMessage && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center gap-2 font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                : 'bg-rose-50 text-rose-800 border-b border-rose-100'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Body / Slots Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs pb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-800">รูปภาพห้องพัก ({slots.length} รูป)</span>
              <span className="text-slate-400 hidden xs:inline">·</span>
              <span className="text-slate-500 text-[11px] hidden sm:inline">รูปที่ 1 เป็นรูปหน้าปก</span>
            </div>

            <button
              type="button"
              onClick={handleAddSlot}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
              title="เพิ่มรูปภาพห้องนี้"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ เพิ่มรูปภาพ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {slots.map((imageUrl, idx) => {
              const title = SLOT_LABELS[idx] || `รูปที่ ${idx + 1}`;
              const isCover = idx === 0;
              const isCurrentProcessing = isProcessing && processingSlot === idx;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all p-3.5 flex flex-col justify-between ${
                    isCover
                      ? 'border-emerald-300 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-200/50'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  {/* Slot Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-bold ${
                          isCover ? 'text-emerald-800' : 'text-slate-800'
                        }`}
                      >
                        {title}
                      </span>
                    </div>

                    {/* Swap / Move actions & Delete */}
                    <div className="flex items-center gap-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSwapSlots(idx, idx - 1)}
                          className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                          title="เลื่อนขึ้น / สลับไปช่องก่อนหน้า"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < slots.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleSwapSlots(idx, idx + 1)}
                          className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                          title="เลื่อนลง / สลับไปช่องถัดไป"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer ml-0.5"
                        title={slots.length > 1 ? "ลบช่องรูปภาพนี้" : "ล้างรูปในช่องนี้"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail / Preview Area */}
                  <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-200 border border-slate-300/70 flex items-center justify-center group mb-2.5">
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt={title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[idx]?.click()}
                            className="px-2.5 py-1.5 bg-white text-slate-800 text-xs font-semibold rounded-lg shadow-md hover:bg-slate-100 transition-transform active:scale-95"
                          >
                            เปลี่ยนรูป
                          </button>
                        </div>
                      </>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.current[idx]?.click()}
                        className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-slate-300/40 w-full h-full transition-colors"
                      >
                        <Upload className="w-6 h-6 text-slate-400 mb-1.5 stroke-[1.5]" />
                        <span className="text-xs font-medium text-slate-600">คลิกเพื่ออัปโหลดรูป</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP</span>
                      </div>
                    )}

                    {isCurrentProcessing && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center">
                        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-1" />
                        <span className="text-xs font-semibold text-slate-700">กำลังปรับขนาดและอัปโหลด...</span>
                      </div>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => {
                      fileInputRefs.current[idx] = el;
                    }}
                    onChange={(e) => handleFileSelect(e, idx)}
                    className="hidden"
                  />

                  {/* Slot Controls */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[idx]?.click()}
                      className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>เลือกไฟล์</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveUrlInputSlot(activeUrlInputSlot === idx ? null : idx);
                        setUrlInputValue(imageUrl || '');
                      }}
                      className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                      title="วางลิงก์รูปภาพจาก URL"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* URL Input Dropdown */}
                  {activeUrlInputSlot === idx && (
                    <div className="mt-2.5 p-2 bg-white rounded-lg border border-slate-300 shadow-sm animate-in fade-in duration-150">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">ใส่ลิงก์รูปภาพ (URL):</div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="url"
                          placeholder="https://..."
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyUrl(idx)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold"
                        >
                          ใส่รูป
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add New Photo Card Tile */}
            {slots.length < 16 && (
              <button
                type="button"
                onClick={handleAddSlot}
                className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/40 p-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-emerald-700 transition-all cursor-pointer min-h-[190px] group active:scale-[0.98]"
              >
                <div className="w-11 h-11 rounded-2xl bg-white group-hover:bg-emerald-600 text-slate-500 group-hover:text-white flex items-center justify-center shadow-xs transition-colors border border-slate-200 group-hover:border-emerald-600">
                  <Plus className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold block text-slate-800 group-hover:text-emerald-800">
                    + เพิ่มรูปภาพ
                  </span>
                  <span className="text-[11px] text-slate-400">รูปที่ {slots.length + 1}</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            {hasCustomImages && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>คืนค่ารูปเดิมจากระบบ</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isProcessing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกและแสดงผลทันที</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
