import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Search, Calendar, Clock, Car, User, Phone, DollarSign, Copy, Check, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { BookingRecord, RoomItem, PaymentStatus } from '../types';
import {
  doesBookingMatchRoom,
  findConflictingBookings,
  formatBookingForLine,
  getTodayStats,
  isActiveBooking,
} from '../services/bookingUtils';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  addDays,
  getDaysDifference,
  getTodayString,
  isValidDateString,
  parseDate,
  THAI_DAYS_SHORT,
  THAI_MONTHS_SHORT,
} from '../utils/dateUtils';
import { copyText } from '../utils/clipboard';
import { calculateStayTotalPrice } from '../utils/pricingUtils';

interface AdminBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: RoomItem[];
}

export const AdminBookingsModal: React.FC<AdminBookingsModalProps> = ({ isOpen, onClose, rooms }) => {
  const {
    bookings,
    guesthouse,
    createBooking,
    updateBooking,
    deleteBooking,
    deleteBookings,
    clearAllBookings,
    refresh,
    isLoading,
  } = useAppData();
  const { showToast } = useToast();
  useBodyScrollLock(isOpen);

  // Navigation & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'upcoming' | 'checked_out'>('all');
  const [activeView, setActiveView] = useState<'ledger' | 'calendar'>('ledger');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => getTodayString());

  // Booking Form Modal State (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(null);

  // Form Fields
  const [formRoomId, setFormRoomId] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLicensePlate, setFormLicensePlate] = useState('');
  const [formGuestCount, setFormGuestCount] = useState<number>(2);
  const [formCheckInDate, setFormCheckInDate] = useState('');
  const [formCheckInTime, setFormCheckInTime] = useState('14:00');
  const [formCheckOutDate, setFormCheckOutDate] = useState('');
  const [formCheckOutTime, setFormCheckOutTime] = useState('12:00');
  const [formTotalPrice, setFormTotalPrice] = useState<number>(0);
  const [formDepositAmount, setFormDepositAmount] = useState<number>(0);
  const [formPaymentStatus, setFormPaymentStatus] = useState<PaymentStatus>('deposit_paid');
  const [formNotes, setFormNotes] = useState('');
  const [formBookingChannel, setFormBookingChannel] = useState('LINE OA');
  const [formStayStatus, setFormStayStatus] = useState<'จองล่วงหน้า' | 'กำลังพัก' | 'เช็คเอาท์แล้ว' | 'ยกเลิก'>('จองล่วงหน้า');

  // Copy Feedback Toast
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());

  // Today string (local calendar date)
  const todayStr = getTodayString();

  // Today Statistics
  const todayStats = useMemo(() => getTodayStats(bookings, todayStr), [bookings, todayStr]);

  const findRoomForBooking = (b: BookingRecord) =>
    rooms.find((r) => r.id === b.room_id) || rooms.find((r) => doesBookingMatchRoom(b.room_id, r));

  // Forget selections of bookings that no longer exist
  useEffect(() => {
    setSelectedBookingIds((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(bookings.map((b) => b.booking_id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [bookings]);

  // Esc closes the form first, then the ledger
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isFormOpen) setIsFormOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isFormOpen, onClose]);

  // Suggested total for a new booking = room rate for every night (weekday / Saturday / holiday)
  const suggestPrice = (roomId: string, checkin: string, checkout: string) => {
    if (editingBooking) return;
    const rm = rooms.find((r) => r.id === roomId);
    if (!rm || !isValidDateString(checkin) || !isValidDateString(checkout) || checkout <= checkin) return;
    const total = calculateStayTotalPrice({ checkin, checkout }, rm.prices, 'full').total;
    setFormTotalPrice(total);
    setFormDepositAmount(Math.round(total * 0.5));
  };

  // Open Form for New Booking
  const handleOpenNewForm = (presetDate?: string, presetRoomId?: string) => {
    setEditingBooking(null);
    const start = presetDate || todayStr;
    const tomorrow = addDays(start, 1);
    
    const defaultRoom = presetRoomId 
      ? rooms.find(r => r.id === presetRoomId || r.roomNumber === presetRoomId) || rooms[0]
      : rooms[0];

    setFormRoomId(defaultRoom?.id || '');
    setFormCustomerName('');
    setFormPhone('');
    setFormLicensePlate('');
    setFormGuestCount(defaultRoom?.capacity || 2);
    setFormCheckInDate(start);
    setFormCheckInTime('14:00');
    setFormCheckOutDate(tomorrow);
    setFormCheckOutTime('12:00');
    const suggested = defaultRoom
      ? calculateStayTotalPrice({ checkin: start, checkout: tomorrow }, defaultRoom.prices, 'full').total
      : 1000;
    setFormTotalPrice(suggested);
    setFormDepositAmount(Math.round(suggested * 0.5));
    setFormPaymentStatus('deposit_paid');
    setFormNotes('');
    setFormBookingChannel('LINE OA');
    setFormStayStatus(start === todayStr ? 'กำลังพัก' : 'จองล่วงหน้า');
    setIsFormOpen(true);
  };

  // Open Form to Edit Booking
  const handleOpenEditForm = (booking: BookingRecord) => {
    setEditingBooking(booking);
    setFormRoomId(findRoomForBooking(booking)?.id || booking.room_id);
    setFormCustomerName(booking.guest_name || '');
    setFormPhone(booking.phone || '');
    setFormLicensePlate(booking.license_plate || '');
    setFormGuestCount(booking.guest_count || 2);
    setFormCheckInDate(booking.checkin_date || todayStr);
    setFormCheckInTime(booking.checkin_time || '14:00');
    setFormCheckOutDate(booking.checkout_date || addDays(todayStr, 1));
    setFormCheckOutTime(booking.checkout_time || '12:00');
    setFormTotalPrice(booking.actual_price || 0);
    setFormDepositAmount(booking.deposit_amount || 0);
    setFormPaymentStatus((booking.payment_status as PaymentStatus) || 'deposit_paid');
    setFormNotes(booking.notes || '');
    setFormBookingChannel(booking.booking_channel || 'LINE OA');
    setFormStayStatus((booking.stay_status as any) || 'จองล่วงหน้า');
    setIsFormOpen(true);
  };

  // Handle Form Submit
  const formNights =
    isValidDateString(formCheckInDate) && isValidDateString(formCheckOutDate) && formCheckOutDate > formCheckInDate
      ? getDaysDifference(formCheckInDate, formCheckOutDate)
      : 0;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formRoomId || !isValidDateString(formCheckInDate) || !isValidDateString(formCheckOutDate)) {
      showToast('กรุณาเลือกห้องพัก วันที่เช็คอิน และวันที่เช็คเอาท์', 'error');
      return;
    }
    if (formCheckOutDate <= formCheckInDate) {
      showToast('วันเช็คเอาท์ต้องอยู่หลังวันเช็คอินอย่างน้อย 1 คืน', 'error');
      return;
    }
    if (formTotalPrice > 0 && formDepositAmount > formTotalPrice) {
      if (!window.confirm('เงินมัดจำมากกว่ายอดรวม ต้องการบันทึกต่อหรือไม่?')) return;
    }

    const selectedRoom = rooms.find(r => r.id === formRoomId);
    const roomNum = selectedRoom?.roomNumber || formRoomId;

    // Double booking check
    if (formStayStatus !== 'ยกเลิก' && formStayStatus !== 'เช็คเอาท์แล้ว' && formPaymentStatus !== 'cancelled') {
      const conflicts = findConflictingBookings(
        { booking_id: editingBooking?.booking_id, room_id: formRoomId, checkin_date: formCheckInDate, checkout_date: formCheckOutDate },
        selectedRoom,
        bookings
      );
      if (conflicts.length > 0) {
        const list = conflicts
          .slice(0, 3)
          .map((c) => `• ${c.guest_name || 'ลูกค้า'} (${c.checkin_date} ➔ ${c.checkout_date})`)
          .join('\n');
        if (!window.confirm(`⚠️ ห้อง ${roomNum} มีการจองซ้อนในช่วงวันนี้อยู่แล้ว:\n${list}\n\nต้องการบันทึกต่อหรือไม่?`)) return;
      }
    }

    const payload: Partial<BookingRecord> = {
      room_id: formRoomId,
      room_number: roomNum,
      guest_name: formCustomerName.trim() || 'ลูกค้าทั่วไป',
      phone: formPhone.trim(),
      license_plate: formLicensePlate.trim(),
      guest_count: Number(formGuestCount) || 2,
      booking_channel: formBookingChannel,
      checkin_date: formCheckInDate,
      checkin_time: formCheckInTime,
      checkout_date: formCheckOutDate,
      checkout_time: formCheckOutTime,
      nights: formNights || 1,
      actual_price: Number(formTotalPrice) || 0,
      deposit_amount: Number(formDepositAmount) || 0,
      remaining_amount: Math.max(0, (Number(formTotalPrice) || 0) - (Number(formDepositAmount) || 0)),
      payment_status: formPaymentStatus,
      notes: formNotes.trim(),
      stay_status: formStayStatus,
    };

    setIsSubmitting(true);
    try {
      if (editingBooking) {
        await updateBooking(editingBooking.booking_id, payload);
        showToast(`บันทึกการแก้ไขการจองห้อง ${roomNum} แล้ว`);
      } else {
        await createBooking(payload);
        showToast(`บันทึกการจองห้อง ${roomNum} เรียบร้อย`);
      }
      setIsFormOpen(false);
    } catch (err) {
      showToast(`บันทึกไม่สำเร็จ: ${(err as Error).message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy to LINE Formatter
  const handleCopyForLine = async (booking: BookingRecord) => {
    const text = formatBookingForLine(booking, guesthouse, findRoomForBooking(booking));
    if (await copyText(text)) {
      setCopiedId(booking.booking_id);
      setTimeout(() => setCopiedId(null), 2500);
    } else {
      showToast('คัดลอกไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
  };

  // Delete handler
  const handleDelete = async (bookingId: string) => {
    if (window.confirm('คุณต้องการลบรายการจองนี้ออกจากสมุดจดใช่หรือไม่?')) {
      try {
        await deleteBooking(bookingId);
        showToast('ลบรายการจองแล้ว');
      } catch (err) {
        showToast(`ลบไม่สำเร็จ: ${(err as Error).message}`, 'error');
      }
    }
  };

  const handleClearAll = async () => {
    if (bookings.length === 0) return;
    if (
      window.confirm(
        `คุณต้องการลบรายการจอง "ทั้งหมด" (${bookings.length} รายการ) ออกจากระบบใช่หรือไม่? (การดำเนินการนี้ไม่สามารถย้อนกลับได้)`
      )
    ) {
      setIsSubmitting(true);
      try {
        await clearAllBookings();
        setSelectedBookingIds(new Set());
        showToast('ลบรายการจองทั้งหมดแล้ว');
      } catch (err) {
        showToast(`ลบไม่สำเร็จ: ${(err as Error).message}`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedBookingIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedBookingIds(newSelection);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`คุณต้องการลบรายการจองที่เลือกไว้จำนวน ${selectedBookingIds.size} รายการใช่หรือไม่?`)) {
      setIsSubmitting(true);
      try {
        await deleteBookings([...selectedBookingIds]);
        showToast(`ลบรายการจอง ${selectedBookingIds.size} รายการแล้ว`);
        setSelectedBookingIds(new Set());
      } catch (err) {
        showToast(`ลบไม่สำเร็จ: ${(err as Error).message}`, 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Filtered Bookings List
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlate = b.license_plate?.toLowerCase().includes(q);
        const matchName = b.guest_name?.toLowerCase().includes(q);
        // Only treat the query as a phone number when it looks like one;
        // otherwise its digit-less form ('') would match every phone.
        const qDigits = q.replace(/\D/g, '');
        const looksLikePhone = qDigits.length >= 3 && /^[\d\s()+.-]+$/.test(q);
        const matchPhone = looksLikePhone && b.phone?.replace(/\D/g, '').includes(qDigits);
        const matchRoom = b.room_number?.toLowerCase().includes(q) || b.room_id?.toLowerCase().includes(q);
        const matchNotes = b.notes?.toLowerCase().includes(q);

        if (!matchPlate && !matchName && !matchPhone && !matchRoom && !matchNotes) {
          return false;
        }
      }

      // Status Tab Filter
      if (statusFilter === 'today') {
        const isStaying = b.checkin_date <= todayStr && b.checkout_date > todayStr;
        const isArriving = b.checkin_date === todayStr;
        return (isStaying || isArriving) && isActiveBooking(b);
      }
      if (statusFilter === 'upcoming') {
        return b.checkin_date > todayStr && isActiveBooking(b);
      }
      if (statusFilter === 'checked_out') {
        return b.checkout_date <= todayStr || !isActiveBooking(b);
      }

      return true;
    });
  }, [bookings, searchQuery, statusFilter, todayStr]);

  // Calendar Days Computation
  const calendarDays = useMemo(() => {
    // Window starting 3 days before the selected date
    const base = isValidDateString(selectedCalendarDate) ? selectedCalendarDate : todayStr;
    const days = [];
    for (let i = 0; i < 14; i++) {
      const str = addDays(base, i - 3);
      const d = parseDate(str);
      days.push({
        dateStr: str,
        thaiDay: THAI_DAYS_SHORT[d.getDay()],
        dayNum: d.getDate(),
        monthThai: THAI_MONTHS_SHORT[d.getMonth()],
        isToday: str === todayStr,
      });
    }
    return days;
  }, [selectedCalendarDate, todayStr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header (compact so the booking list gets the space) */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 hidden sm:flex items-center justify-center text-amber-300 shrink-0">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  📖 สมุดจดห้องพัก<span className="hidden md:inline"> (Booking Ledger)</span>
                </h2>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium shrink-0">แอดมิน</span>
              </div>
              <p className="text-xs text-slate-300 truncate hidden sm:block">{guesthouse.name} · บันทึกการจอง ทะเบียนรถ เงินมัดจำ และตรวจสอบห้องว่าง</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => refresh(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="โหลดข้อมูลล่าสุด"
              aria-label="โหลดข้อมูลล่าสุด"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Everything below the header scrolls together: the stats scroll away, the toolbar stays pinned */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">

        {/* Today's numbers (one compact row) */}
        <div className="bg-slate-50 px-3 sm:px-5 pt-3 pb-2.5">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {[
              { label: 'พักอยู่วันนี้', value: String(todayStats.occupiedToday), unit: 'ห้อง', color: 'text-slate-900' },
              { label: 'เช็คอินวันนี้', value: String(todayStats.arrivalsToday), unit: 'ห้อง', color: 'text-emerald-700' },
              { label: 'เช็คเอาท์วันนี้', value: String(todayStats.departuresToday), unit: 'ห้อง', color: 'text-amber-700' },
              { label: 'มัดจำวันนี้', value: `฿${todayStats.totalDeposit.toLocaleString()}`, unit: '', color: 'text-blue-700' },
            ].map((s) => (
              <div key={s.label} className="bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 min-w-0">
                <span className="text-[11px] sm:text-xs text-slate-600 block truncate">{s.label}</span>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className={`text-base sm:text-xl font-bold font-mono tabular-nums truncate ${s.color}`}>{s.value}</span>
                  {s.unit && <span className="text-[11px] text-slate-500 hidden sm:inline">{s.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar & Filters (pinned while scrolling) */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-y border-slate-200 px-3 sm:px-5 py-2 flex flex-col lg:flex-row lg:items-center gap-2">
          {/* Search + new booking */}
          <div className="flex items-center gap-2 lg:flex-1 lg:max-w-md">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาทะเบียนรถ ชื่อ เบอร์โทร ห้อง..."
                aria-label="ค้นหารายการจอง"
                className="w-full pl-8 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label="ล้างคำค้นหา"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleOpenNewForm()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>จดการจองใหม่</span>
            </button>
          </div>

          {/* Views & filters: one swipeable row, labels never wrap */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs font-medium -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0">
              {(
                [
                  ['ledger', '📋 ตาราง'],
                  ['calendar', '📅 ปฏิทิน'],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeView === view ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0">
              {(
                [
                  ['all', `ทั้งหมด ${bookings.length}`],
                  ['today', 'วันนี้'],
                  ['upcoming', 'จะมาถึง'],
                  ['checked_out', 'ผ่านไปแล้ว/ยกเลิก'],
                ] as const
              ).map(([status, label]) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    statusFilter === status ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {selectedBookingIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isSubmitting}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center gap-1 shadow-sm active:scale-95 transition-all whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ลบที่เลือก ({selectedBookingIds.size})
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={isSubmitting || bookings.length === 0}
              className="ml-auto px-2.5 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-1 transition-all whitespace-nowrap shrink-0 disabled:opacity-40"
              title="ลบรายการจองทั้งหมดออกจากระบบ"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ลบทั้งหมด
            </button>
          </div>
        </div>

        {/* Content View Body */}
        <div className="p-3 sm:p-5">
          {activeView === 'ledger' ? (
            /* LEDGER VIEW */
            <div className="space-y-3">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">ไม่พบรายการจองตามเงื่อนไขที่ค้นหา</p>
                  <p className="text-xs text-slate-400 mt-1">กดปุ่ม "จดการจองใหม่" เพื่อบันทึกห้องพักของลูกค้าได้ทันที</p>
                  <button
                    onClick={() => handleOpenNewForm()}
                    className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-all"
                  >
                    + เพิ่มการจองใหม่
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredBookings.map((b) => {
                    const room = findRoomForBooking(b);
                    const isCopied = copiedId === b.booking_id;
                    const isTodayStay = b.checkin_date <= todayStr && b.checkout_date > todayStr;

                    return (
                      <div
                        key={b.booking_id}
                        className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          isTodayStay 
                            ? 'bg-amber-50/50 border-amber-200 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.has(b.booking_id)}
                          onChange={() => toggleSelection(b.booking_id)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 shrink-0"
                          aria-label={`เลือกการจองของ ${b.guest_name || 'ลูกค้า'}`}
                        />
                        <div className="flex-1 min-w-0">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          
                          {/* Room & Dates */}
                          <div className="flex items-start gap-3">
                            <div className="w-14 min-h-12 px-1 py-1 rounded-xl bg-slate-900 text-amber-400 flex flex-col items-center justify-center font-bold shrink-0 shadow-inner text-center">
                              <span className="text-[10px] text-slate-400 uppercase font-sans">ห้อง</span>
                              <span className="text-xs font-mono tabular-nums leading-tight break-all">
                                {(room?.roomNumber || b.room_number || b.room_id).replace(/\s*\(.*\)/, '')}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                  {room?.displayName || `ห้องพัก ${b.room_number || b.room_id}`}
                                </h3>
                                
                                {/* Status Tag */}
                                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                                  b.stay_status === 'กำลังพัก'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : b.stay_status === 'ยกเลิก'
                                    ? 'bg-rose-100 text-rose-700'
                                    : b.stay_status === 'เช็คเอาท์แล้ว'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {b.stay_status || 'จองล่วงหน้า'}
                                </span>

                                {/* Payment Status Tag */}
                                <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                                  b.payment_status === 'fully_paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : b.payment_status === 'deposit_paid'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : b.payment_status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {b.payment_status === 'fully_paid'
                                    ? 'ชำระครบแล้ว'
                                    : b.payment_status === 'deposit_paid'
                                    ? `มัดจำแล้ว (฿${Number(b.deposit_amount || 0).toLocaleString()})`
                                    : b.payment_status === 'cancelled'
                                    ? 'ยกเลิกการจอง'
                                    : 'รอชำระ'}
                                </span>
                              </div>

                              {/* Dates & Times */}
                              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                                <span className="font-medium text-slate-800">
                                  📅 {b.checkin_date} ({b.checkin_time || '14:00'})
                                </span>
                                <span className="text-slate-400">➔</span>
                                <span className="font-medium text-slate-800">
                                  {b.checkout_date} ({b.checkout_time || '12:00'})
                                </span>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{b.nights || 1} คืน</span>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">ผู้เข้าพัก {b.guest_count || 2} ท่าน</span>
                              </div>
                            </div>
                          </div>

                          {/* Customer & Vehicle Info */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                            {/* Customer Name */}
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{b.guest_name || 'ลูกค้าทั่วไป'}</span>
                            </div>

                            {/* Phone */}
                            {b.phone && (
                              <a
                                href={`tel:${b.phone}`}
                                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono"
                              >
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span>{b.phone}</span>
                              </a>
                            )}

                            {/* License Plate - Highlighted */}
                            {b.license_plate ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100/80 border border-amber-300 text-slate-900 font-semibold font-mono text-xs">
                                <Car className="w-3.5 h-3.5 text-amber-700" />
                                <span>{b.license_plate}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Car className="w-3.5 h-3.5" />
                                <span>ไม่ระบุทะเบียน</span>
                              </div>
                            )}

                            {/* Price Summary */}
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono font-medium">
                              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                              <span>฿{Number(b.actual_price || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 self-end lg:self-center">
                            {/* Copy for LINE button */}
                            <button
                              onClick={() => handleCopyForLine(b)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 transition-all ${
                                isCopied
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                              title="คัดลอกข้อความสรุปสำหรับส่งทาง LINE"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>คัดลอกแล้ว!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>ส่ง LINE</span>
                                </>
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditForm(b)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                              title="แก้ไขข้อมูลการจอง"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(b.booking_id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                              title="ลบรายการจอง"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Customer Notes (If Any) - under the booking, not beside it */}
                        {b.notes && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-start gap-1.5">
                            <span className="font-semibold text-slate-700 shrink-0">📝 หมายเหตุ:</span>
                            <span className="text-slate-600 break-words min-w-0">{b.notes}</span>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CALENDAR VIEW */
            <div className="space-y-4">
              {/* Date Navigation */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">ช่วงวันที่แสดง:</span>
                  <input
                    type="date"
                    value={selectedCalendarDate}
                    onChange={(e) => e.target.value && setSelectedCalendarDate(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => setSelectedCalendarDate((d) => addDays(d, -7))}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-300 font-semibold hover:bg-slate-100"
                  >
                    ◀ 7 วัน
                  </button>
                  <button
                    onClick={() => setSelectedCalendarDate((d) => addDays(d, 7))}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-300 font-semibold hover:bg-slate-100"
                  >
                    7 วัน ▶
                  </button>
                  <button
                    onClick={() => setSelectedCalendarDate(todayStr)}
                    className="text-xs text-amber-700 font-semibold hover:underline"
                  >
                    กลับมาวันปัจจุบัน
                  </button>
                </div>
              </div>

              {/* Day Columns Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {calendarDays.slice(0, 7).map((d) => {
                  const dayBookings = bookings.filter((b) => {
                    return b.checkin_date <= d.dateStr && b.checkout_date > d.dateStr && isActiveBooking(b);
                  });

                  return (
                    <div
                      key={d.dateStr}
                      className={`p-3 rounded-2xl border flex flex-col min-h-[160px] ${
                        d.isToday
                          ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <div>
                          <span className="text-xs text-slate-500 font-medium block">{d.thaiDay}</span>
                          <span className="text-base font-bold text-slate-900 font-mono">{d.dayNum} {d.monthThai}</span>
                        </div>
                        {d.isToday && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded">
                            วันนี้
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5 overflow-y-auto">
                        {dayBookings.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic block text-center pt-4">ว่างทุกห้อง</span>
                        ) : (
                          dayBookings.map((b) => (
                            <div
                              key={b.booking_id}
                              onClick={() => handleOpenEditForm(b)}
                              className="p-1.5 rounded-lg bg-slate-900 text-white text-[11px] cursor-pointer hover:bg-slate-800 transition-colors"
                              title={`${b.guest_name} (${b.license_plate || 'ไม่มีทะเบียน'})`}
                            >
                              <div className="flex items-center justify-between font-bold text-amber-300 gap-1">
                                <span className="truncate">ห้อง {findRoomForBooking(b)?.roomNumber || b.room_number || b.room_id}</span>
                                {b.license_plate && <span className="text-[9px] text-slate-300 truncate max-w-[60px]">{b.license_plate}</span>}
                              </div>
                              <div className="text-[10px] text-slate-300 truncate">{b.guest_name || 'ลูกค้า'}</div>
                            </div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenNewForm(d.dateStr)}
                        className="mt-2 w-full py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-dashed border-slate-300 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        จองวันนี้
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            รวมรายการจองทั้งหมด <span className="font-bold text-slate-800 font-mono">{bookings.length}</span> รายการ
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* CREATE / EDIT BOOKING SUB-MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">
                  {editingBooking ? '✏️ แก้ไขข้อมูลการจองห้องพัก' : '➕ บันทึกการจองห้องพักใหม่'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              
              {/* Room Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ห้องพักที่จอง <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formRoomId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setFormRoomId(newId);
                    const rm = rooms.find(r => r.id === newId);
                    if (rm) {
                      setFormGuestCount(rm.capacity || 2);
                      if (!editingBooking) suggestPrice(rm.id, formCheckInDate, formCheckOutDate);
                    }
                  }}
                  className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                >
                  <option value="">-- กรุณาเลือกห้องพัก --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      ห้อง {r.roomNumber} - {r.displayName} (พักได้ {r.capacity} ท่าน · เริ่ม ฿{r.priceStart})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อลูกค้าผู้จอง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="เช่น คุณธนภัทร"
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="เบอร์ลูกค้า เช่น 08x-xxx-xxxx"
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* License Plate & Guest Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🚗 เลขทะเบียนรถ (รถยนต์ / มอเตอร์ไซค์)
                  </label>
                  <input
                    type="text"
                    value={formLicensePlate}
                    onChange={(e) => setFormLicensePlate(e.target.value)}
                    placeholder="เช่น 2ขค 4821 กทม / เวสป้า 888"
                    className="w-full text-sm px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนผู้เข้าพัก (ท่าน)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formGuestCount}
                    onChange={(e) => setFormGuestCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Checkin / Checkout Dates and Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📅 วันที่เช็คอิน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formCheckInDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormCheckInDate(v);
                      // Keep the automatic status in step with the date (today = staying, later = booked ahead).
                      if (isValidDateString(v) && (formStayStatus === 'กำลังพัก' || formStayStatus === 'จองล่วงหน้า')) {
                        if (v > todayStr) setFormStayStatus('จองล่วงหน้า');
                        else if (v === todayStr) setFormStayStatus('กำลังพัก');
                      }
                      let out = formCheckOutDate;
                      if (isValidDateString(v) && (!formCheckOutDate || formCheckOutDate <= v)) {
                        out = addDays(v, 1);
                        setFormCheckOutDate(out);
                      }
                      suggestPrice(formRoomId, v, out);
                    }}
                    className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono mb-2"
                    required
                  />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={formCheckInTime}
                      onChange={(e) => setFormCheckInTime(e.target.value)}
                      placeholder="14:00"
                      className="text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg w-20 font-mono"
                    />
                    <span className="text-xs text-slate-500">น.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📅 วันที่เช็คเอาท์ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formCheckOutDate}
                    onChange={(e) => {
                      setFormCheckOutDate(e.target.value);
                      suggestPrice(formRoomId, formCheckInDate, e.target.value);
                    }}
                    min={formCheckInDate ? addDays(formCheckInDate, 1) : undefined}
                    className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono mb-2"
                    required
                  />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={formCheckOutTime}
                      onChange={(e) => setFormCheckOutTime(e.target.value)}
                      placeholder="12:00"
                      className="text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg w-20 font-mono"
                    />
                    <span className="text-xs text-slate-500">น.</span>
                  </div>
                </div>
              </div>

              {formNights > 0 && (
                <div className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                  🌙 จำนวน {formNights} คืน
                </div>
              )}

              {/* Pricing & Deposit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    💰 ยอดรวมทั้งสิ้น (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formTotalPrice}
                    onChange={(e) => setFormTotalPrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    💵 เงินมัดจำ (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={formDepositAmount}
                    onChange={(e) => setFormDepositAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    💳 ยอดคงเหลือ
                  </label>
                  <div className="w-full text-sm px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-800">
                    ฿{(formPaymentStatus === 'fully_paid' ? 0 : Math.max(0, formTotalPrice - formDepositAmount)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Payment & Stay Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการชำระเงิน
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="deposit_paid">มัดจำแล้ว</option>
                    <option value="fully_paid">ชำระเต็มจำนวนแล้ว</option>
                    <option value="pending">รอชำระเงิน</option>
                    <option value="cancelled">ยกเลิกการจอง</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการเข้าพัก
                  </label>
                  <select
                    value={formStayStatus}
                    onChange={(e) => setFormStayStatus(e.target.value as any)}
                    className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="จองล่วงหน้า">จองล่วงหน้า</option>
                    <option value="กำลังพัก">กำลังพัก (Checked-in)</option>
                    <option value="เช็คเอาท์แล้ว">เช็คเอาท์แล้ว</option>
                    <option value="ยกเลิก">ยกเลิก</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📝 หมายเหตุเพิ่มเติมของลูกค้า
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="เช่น ขอเตียงเสริม, นำแมวมา 1 ตัว แจ้งแล้ว, เช็คอินดึก 21:00"
                  className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายการจอง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
