import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  EyeOff,
  BedDouble,
  DollarSign,
  Tag,
  ListCheck,
} from 'lucide-react';
import { RoomItem, RoomOverride } from '../types';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { parsePriceNumber } from '../utils/pricingUtils';
import { getRoomNumberWithBuilding } from '../utils/roomUtils';

interface AdminRoomEditModalProps {
  room: RoomItem | null;
  allRooms?: RoomItem[];
  onClose: () => void;
}

export const AdminRoomEditModal: React.FC<AdminRoomEditModalProps> = ({ room, allRooms, onClose }) => {
  const { saveRoomOverride, saveBulkRoomOverrides, resetRoomOverride } = useAppData();
  const { showToast } = useToast();
  const isOpen = Boolean(room);
  useBodyScrollLock(isOpen);
  const [formData, setFormData] = useState<RoomOverride>({});
  const [newBadge, setNewBadge] = useState('');
  const [newAmenity, setNewAmenity] = useState('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (room && isOpen) {
      setFormData({
        isHiddenFromRental: Boolean(room.isHiddenFromRental),
        roomNumber: room.roomNumber,
        displayName: room.displayName,
        capacity: room.capacity,
        capacityLabel: room.capacityLabel,
        bedType: room.bedType,
        priceStart: room.priceStart,
        prices: {
          weekday: room.prices.weekday,
          saturday: room.prices.saturday,
          specialSaturday: room.prices.specialSaturday,
          festival: room.prices.festival,
        },
        badges: [...room.badges],
        amenities: [...room.amenities],
        description: room.description || '',
      });
      setNewBadge('');
      setNewAmenity('');
      setSelectedBulkIds([]);
      setSaveSuccess(false);
    }
    // Only when a (different) room is opened - background refreshes must not wipe unsaved edits.
  }, [room?.id]);

  if (!isOpen || !room) return null;

  const handleSave = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formData.roomNumber?.trim() || !formData.displayName?.trim() || !formData.bedType?.trim()) {
      showToast('กรุณากรอกหมายเลขห้อง ชื่อที่แสดง และรายละเอียดเตียงให้ครบ', 'error');
      return;
    }
    if (!parsePriceNumber(formData.prices?.weekday)) {
      showToast('กรุณาใส่ราคาวันธรรมดาเป็นตัวเลข เช่น 500', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await saveRoomOverride(room.id, formData);
      if (selectedBulkIds.length > 0) {
        // Other rooms only receive the prices - never this room's name, number or details.
        await saveBulkRoomOverrides(selectedBulkIds, { priceStart: formData.priceStart, prices: formData.prices });
      }
      setSaveSuccess(true);
      showToast(
        selectedBulkIds.length > 0
          ? `บันทึกห้อง ${formData.roomNumber} และใช้ราคาเดียวกันกับอีก ${selectedBulkIds.length} ห้องแล้ว`
          : `บันทึกข้อมูลห้อง ${formData.roomNumber} เรียบร้อย`
      );
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

  const handleResetRoom = async () => {
    if (window.confirm(`ต้องการคืนค่าเริ่มต้นของห้อง "${room.roomNumber}" ใช่หรือไม่?`)) {
      setIsSaving(true);
      try {
        await resetRoomOverride(room.id);
        showToast(`คืนค่าเริ่มต้นห้อง ${room.roomNumber} แล้ว`);
        onClose();
      } catch (err) {
        showToast((err as Error).message, 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddBadge = () => {
    if (newBadge.trim()) {
      const current = formData.badges || [];
      if (!current.includes(newBadge.trim())) {
        setFormData({ ...formData, badges: [...current, newBadge.trim()] });
      }
      setNewBadge('');
    }
  };

  const handleRemoveBadge = (badgeToRemove: string) => {
    const current = formData.badges || [];
    setFormData({ ...formData, badges: current.filter((b) => b !== badgeToRemove) });
  };

  const handleAddAmenity = () => {
    if (newAmenity.trim()) {
      const current = formData.amenities || [];
      if (!current.includes(newAmenity.trim())) {
        setFormData({ ...formData, amenities: [...current, newAmenity.trim()] });
      }
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (amenityToRemove: string) => {
    const current = formData.amenities || [];
    setFormData({ ...formData, amenities: current.filter((a) => a !== amenityToRemove) });
  };

  const BADGE_PRESETS = [
    '🔥 500.-',
    '🌊 วิวทะเล',
    '❄️ แอร์',
    '👥 พัก 2 ท่าน',
    '👥 พัก 4 ท่าน',
    '🏠 มีระเบียง',
    '🚗 ที่จอดรถส่วนตัว',
    '📶 Wi-Fi ฟรี',
    '🛁 มีอ่างอาบน้ำ',
  ];

  const AMENITY_PRESETS = [
    'เครื่องปรับอากาศ (แอร์)',
    'ทีวี (TV)',
    'ตู้เย็น',
    'เครื่องทำน้ำอุ่น',
    'Wi-Fi ฟรี',
    'ผ้าเช็ดตัว & สบู่',
    'ห้องน้ำในตัว',
    'ระเบียงชมวิว',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                แก้ไขห้องพัก (Admin Mode)
              </span>
              {formData.isHiddenFromRental ? (
                <span className="text-[10px] bg-rose-900/80 text-rose-300 px-2 py-0.5 rounded-full font-bold border border-rose-700">
                  ปิดการปล่อยเช่า
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-700">
                  เปิดให้เช่า
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
              {room.displayName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Toggle Open / Closed Rental Status */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-amber-900 block">
                สถานะการปล่อยเช่าห้องนี้
              </span>
              <p className="text-xs text-amber-700">
                {formData.isHiddenFromRental
                  ? '⛔ ปิดการปล่อยเช่าชั่วคราว (ผู้ใช้งานทั่วไปจะไม่เห็นห้องนี้ในรายการ)'
                  : '✅ เปิดให้เช่าตามปกติ (ผู้ใช้งานสามารถดูและติดต่อจองได้)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  isHiddenFromRental: !formData.isHiddenFromRental,
                })
              }
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                formData.isHiddenFromRental
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {formData.isHiddenFromRental ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>กดเพื่อเปิดให้เช่า</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>กดเพื่อปิดการปล่อยเช่า</span>
                </>
              )}
            </button>
          </div>

          {/* 2. Basic Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-sky-600" />
              <span>ข้อมูลพื้นฐานของห้อง</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หมายเลขห้อง
                </label>
                <input
                  type="text"
                  value={formData.roomNumber || ''}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อที่แสดงในการ์ด
                </label>
                <input
                  type="text"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนผู้เข้าพัก (คน)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.capacity || 2}
                  onChange={(e) => {
                    const capacity = Math.max(1, parseInt(e.target.value) || 2);
                    setFormData({ ...formData, capacity, capacityLabel: `${capacity} ท่าน` });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดเตียงนอน
                </label>
                <input
                  type="text"
                  value={formData.bedType || ''}
                  onChange={(e) => setFormData({ ...formData, bedType: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
                  placeholder="เช่น เตียง 6 ฟุต 1 เตียง"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Pricing Tiers */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>อัตราค่าบริการ (บาท)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  วันธรรมดา (อา.-ศ.)
                </label>
                <input
                  type="text"
                  value={formData.prices?.weekday || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceStart: parsePriceNumber(e.target.value) || formData.priceStart,
                      prices: {
                        weekday: e.target.value,
                        saturday: formData.prices?.saturday || '',
                        specialSaturday: formData.prices?.specialSaturday || '',
                        festival: formData.prices?.festival || '',
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"
                  placeholder="เช่น 500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  วันเสาร์
                </label>
                <input
                  type="text"
                  value={formData.prices?.saturday || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prices: {
                        weekday: formData.prices?.weekday || '',
                        saturday: e.target.value,
                        specialSaturday: formData.prices?.specialSaturday || '',
                        festival: formData.prices?.festival || '',
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"
                  placeholder="เช่น 800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เสาร์พิเศษ / หยุดยาว
                </label>
                <input
                  type="text"
                  value={formData.prices?.specialSaturday || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prices: {
                        weekday: formData.prices?.weekday || '',
                        saturday: formData.prices?.saturday || '',
                        specialSaturday: e.target.value,
                        festival: formData.prices?.festival || '',
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"
                  placeholder="เช่น 1,000"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  เทศกาล (ปีใหม่/สงกรานต์)
                </label>
                <input
                  type="text"
                  value={formData.prices?.festival || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prices: {
                        weekday: formData.prices?.weekday || '',
                        saturday: formData.prices?.saturday || '',
                        specialSaturday: formData.prices?.specialSaturday || '',
                        festival: e.target.value,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"
                  placeholder="เช่น 1,200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                ราคาเริ่มต้นสำหรับจัดลำดับ / กรอง (ตัวเลขเท่านั้น)
              </label>
              <input
                type="number"
                value={formData.priceStart || 500}
                onChange={(e) =>
                  setFormData({ ...formData, priceStart: parseInt(e.target.value) || 500 })
                }
                className="w-40 px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Bulk room apply section */}
            {allRooms && allRooms.length > 1 && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900">
                    💡 เลือกใช้ราคานี้กับห้องอื่นๆ พร้อมกัน (Bulk Price Update — ใช้เฉพาะราคา)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const otherRooms = allRooms.filter((r) => r.id !== room.id);
                      if (selectedBulkIds.length === otherRooms.length) {
                        setSelectedBulkIds([]);
                      } else {
                        setSelectedBulkIds(otherRooms.map((r) => r.id));
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {selectedBulkIds.length === allRooms.filter((r) => r.id !== room.id).length
                      ? 'ยกเลิกเลือกทั้งหมด'
                      : 'เลือกห้องอื่นๆ ทั้งหมด'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-white rounded-xl border border-emerald-100">
                  {allRooms
                    .filter((r) => r.id !== room.id)
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer p-1.5 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBulkIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBulkIds([...selectedBulkIds, r.id]);
                            } else {
                              setSelectedBulkIds(selectedBulkIds.filter((id) => id !== r.id));
                            }
                          }}
                          className="shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="truncate min-w-0 font-semibold" title={getRoomNumberWithBuilding(r)}>{getRoomNumberWithBuilding(r)}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Badges Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-amber-500" />
              <span>ป้ายกำกับ (Badges)</span>
            </h4>
            <div className="flex flex-wrap gap-1.5 items-center">
              {(formData.badges || []).map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200"
                >
                  <span>{badge}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBadge(badge)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Badge input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBadge();
                  }
                }}
                placeholder="พิมพ์ป้ายใหม่ เช่น 🔥 โปรพิเศษ"
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none"
              />
              <button
                type="button"
                onClick={handleAddBadge}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[10px] text-slate-400 font-medium mr-1">เลือกด่วน:</span>
              {BADGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const current = formData.badges || [];
                    if (!current.includes(preset)) {
                      setFormData({ ...formData, badges: [...current, preset] });
                    }
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Amenities Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ListCheck className="w-4 h-4 text-indigo-500" />
              <span>สิ่งอำนวยความสะดวกในห้อง</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {(formData.amenities || []).map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
                >
                  <span>✓ {amenity}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAmenity(amenity)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Amenity input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAmenity();
                  }
                }}
                placeholder="พิมพ์สิ่งอำนวยความสะดวกใหม่ เช่น ไดร์เป่าผม"
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none"
              />
              <button
                type="button"
                onClick={handleAddAmenity}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[10px] text-slate-400 font-medium mr-1">เลือกด่วน:</span>
              {AMENITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const current = formData.amenities || [];
                    if (!current.includes(preset)) {
                      setFormData({ ...formData, amenities: [...current, preset] });
                    }
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Description */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              คำอธิบายเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-sky-500 outline-none resize-none"
              placeholder="รายละเอียดห้อง บรรยากาศ จุดเด่น"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetRoom}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
            title="คืนค่าห้องนี้กลับเป็นค่าเริ่มต้นจากระบบ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าเริ่มต้นห้องนี้</span>
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
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : saveSuccess ? 'บันทึกแล้ว!' : 'บันทึกการแก้ไข'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
