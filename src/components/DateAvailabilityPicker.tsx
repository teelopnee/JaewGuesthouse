import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, X, CalendarDays, Filter } from 'lucide-react';
import { DateSelection } from '../types';
import {
  formatThaiDate,
  getNextOccurrence,
  getTodayString,
  getTomorrowString,
  getThisSaturdayString,
  getNextSaturdayString,
  addDays,
  parseDate,
  formatDateToISO,
  THAI_MONTHS_FULL,
  THAI_DAYS_SHORT,
  getDaysDifference,
} from '../utils/dateUtils';
import { getThaiHolidayName } from '../utils/holidayUtils';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DateAvailabilityPickerProps {
  dates: DateSelection;
  onChangeDates: (newDates: DateSelection) => void;
  showOnlyAvailable: boolean;
  onToggleShowOnlyAvailable: (value: boolean) => void;
  availableCount: number;
  totalCount: number;
  bookedCount: number;
  isLoadingBookings: boolean;
  onRefreshBookings: () => void;
  lastSyncedTime?: Date;
  minWeekdayPrice?: number;
}

export const DateAvailabilityPicker: React.FC<DateAvailabilityPickerProps> = ({
  dates,
  onChangeDates,
  showOnlyAvailable,
  onToggleShowOnlyAvailable,
  availableCount,
  bookedCount,
  minWeekdayPrice,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  useBodyScrollLock(isCalendarOpen);
  useEscapeKey(isCalendarOpen, () => setIsCalendarOpen(false));
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => parseDate(dates.checkin));
  const [calendarStep, setCalendarStep] = useState<'checkin' | 'checkout'>('checkin');
  const [tempCheckin, setTempCheckin] = useState<string>(dates.checkin);
  const [tempCheckout, setTempCheckout] = useState<string>(dates.checkout);

  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();
  const thisSatStr = getThisSaturdayString();
  const nextSatStr = getNextSaturdayString();
  const piyaDayStr = getNextOccurrence(10, 23);
  const songkranStr = getNextOccurrence(4, 13);

  // Quick preset clicks
  const handleSelectPreset = (checkin: string, nights = 1) => {
    const checkout = addDays(checkin, nights);
    onChangeDates({ checkin, checkout });
  };

  const isTodaySelected = dates.checkin === todayStr && dates.checkout === addDays(todayStr, 1);
  const isTomorrowSelected = dates.checkin === tomorrowStr && dates.checkout === addDays(tomorrowStr, 1);
  const isThisSatSelected = dates.checkin === thisSatStr && dates.checkout === addDays(thisSatStr, 1);
  const isNextSatSelected = dates.checkin === nextSatStr && dates.checkout === addDays(nextSatStr, 1);

  // Open calendar
  const handleOpenCalendar = () => {
    setTempCheckin(dates.checkin);
    setTempCheckout(dates.checkout);
    setCalendarStep('checkin');
    setCurrentMonthDate(parseDate(dates.checkin));
    setIsCalendarOpen(true);
  };

  // Calendar navigation
  const nextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  const today = parseDate(todayStr);
  const canGoPrevMonth =
    currentMonthDate.getFullYear() > today.getFullYear() ||
    (currentMonthDate.getFullYear() === today.getFullYear() && currentMonthDate.getMonth() > today.getMonth());

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  // Build calendar matrix
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDateClick = (day: number) => {
    const clickedDateStr = formatDateToISO(new Date(year, month, day));
    
    // Disallow dates before today
    if (clickedDateStr < todayStr) return;

    if (calendarStep === 'checkin') {
      setTempCheckin(clickedDateStr);
      setTempCheckout(addDays(clickedDateStr, 1));
      setCalendarStep('checkout');
    } else {
      // Selecting checkout
      if (clickedDateStr <= tempCheckin) {
        // Reset checkin to clicked date
        setTempCheckin(clickedDateStr);
        setTempCheckout(addDays(clickedDateStr, 1));
        setCalendarStep('checkout');
      } else {
        setTempCheckout(clickedDateStr);
      }
    }
  };

  const handleApplyCalendar = () => {
    onChangeDates({ checkin: tempCheckin, checkout: tempCheckout });
    setIsCalendarOpen(false);
  };

  const nightsCount = getDaysDifference(dates.checkin, dates.checkout);

  return (
    <div className="bg-gradient-to-br from-white via-sky-50/50 to-teal-50/30 rounded-3xl p-4 sm:p-5 shadow-xs border border-sky-200/80 mb-6 relative overflow-hidden">
      {/* Top Header & Live Availability Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-sky-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
              เลือกวันเข้าพัก & เช็คห้องว่างทันที
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              อัปเดตสถานะห้องว่างแบบเรียลไทม์ พร้อมจองผ่าน LINE
            </p>
          </div>
        </div>

        {/* Live Availability Status Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ว่าง {availableCount} ห้อง
          </span>
          {bookedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
              เต็ม {bookedCount} ห้อง
            </span>
          )}
          {/* Quick Toggle: Show Only Available */}
          <button
            type="button"
            onClick={() => onToggleShowOnlyAvailable(!showOnlyAvailable)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all touch-manipulation cursor-pointer border ${
              showOnlyAvailable
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="ซ่อนห้องที่เต็มแล้ว แสดงเฉพาะห้องว่าง"
          >
            <Filter className="w-3 h-3" />
            <span>{showOnlyAvailable ? '✓ เฉพาะห้องว่าง' : 'ดูเฉพาะห้องว่าง'}</span>
          </button>
        </div>
      </div>

      {/* Main Selected Date Banner (Tappable on mobile to open Calendar) */}
      <div className="pt-3 space-y-2.5">
        {(() => {
          const selectedHolidays: string[] = [];
          let hasSat = false;
          for (let i = 0; i < nightsCount; i++) {
            const d = addDays(dates.checkin, i);
            const h = getThaiHolidayName(d);
            if (h && !selectedHolidays.includes(h)) {
              selectedHolidays.push(h);
            }
            if (parseDate(d).getDay() === 6) {
              hasSat = true;
            }
          }

          const todayHoliday = getThaiHolidayName(todayStr);

          return (
            <>
              <div
                onClick={handleOpenCalendar}
                className={`p-3 sm:p-3.5 rounded-2xl bg-white border shadow-xs hover:border-sky-400 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-2.5 touch-manipulation group ${
                  selectedHolidays.length > 0
                    ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/20'
                    : hasSat
                    ? 'border-sky-300 ring-1 ring-sky-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-white flex flex-col items-center justify-center font-black shrink-0 shadow-xs ${
                      selectedHolidays.length > 0
                        ? 'bg-gradient-to-br from-rose-500 to-red-600'
                        : hasSat
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                        : 'bg-gradient-to-br from-sky-500 to-teal-600'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold text-white/90 leading-none">พัก</span>
                    <span className="text-base leading-none font-black my-0.5">{nightsCount}</span>
                    <span className="text-[8px] leading-none text-white/90 font-medium">คืน</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 font-medium">ช่วงเวลาที่คุณเลือกเข้าพัก:</div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                      {formatThaiDate(dates.checkin, true)} ➔ {formatThaiDate(dates.checkout, true)}
                    </div>
                    {/* Holiday / Weekend / Weekday Status Label */}
                    {selectedHolidays.length > 0 ? (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black shadow-2xs">
                          🎉 ตรงกับวันหยุดนักขัตฤกษ์: {selectedHolidays.join(', ')}
                        </span>
                        <span className="text-[11px] text-rose-700 font-bold">
                          (แสดงเรทราคาวันหยุดนักขัตฤกษ์)
                        </span>
                      </div>
                    ) : hasSat ? (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black shadow-2xs">
                          ⭐ รวมคืนวันเสาร์
                        </span>
                        <span className="text-[11px] text-amber-900 font-bold">
                          (แสดงเรทราคาสุดสัปดาห์)
                        </span>
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                        <span>🟢 วันธรรมดา (อา.-ศ.) เรทราคาเริ่มต้นสุดคุ้ม {(minWeekdayPrice || 500).toLocaleString()}.-</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-all text-xs font-bold border border-sky-200">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>เปลี่ยนวัน</span>
                </div>
              </div>

              {/* Quick Date Presets Row (Clean horizontal chips) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                <span className="text-[11px] text-slate-400 font-bold shrink-0 hidden xs:inline">ลัด:</span>

                <button
                  onClick={() => handleSelectPreset(todayStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    isTodaySelected
                      ? todayHoliday
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : todayHoliday
                      ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {todayHoliday ? `🎉 คืนนี้ (${todayHoliday})` : 'คืนนี้ (วันนี้)'}
                </button>

                <button
                  onClick={() => handleSelectPreset(tomorrowStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    isTomorrowSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  พรุ่งนี้
                </button>

                <button
                  onClick={() => handleSelectPreset(thisSatStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    isThisSatSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  ⭐ เสาร์นี้
                </button>

                <button
                  onClick={() => handleSelectPreset(nextSatStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    isNextSatSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  ⭐ เสาร์หน้า
                </button>

                {/* Upcoming Public Holiday Fast Preset: 23 Oct (Chulalongkorn Day) */}
                <button
                  onClick={() => handleSelectPreset(piyaDayStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    dates.checkin === piyaDayStr
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                >
                  🎉 วันปิยมหาราช (23 ต.ค.)
                </button>

                {/* Songkran Fast Preset: 13 Apr */}
                <button
                  onClick={() => handleSelectPreset(songkranStr, 1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all touch-manipulation cursor-pointer border shrink-0 ${
                    dates.checkin === songkranStr
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                >
                  🎉 วันสงกรานต์ (13 เม.ย.)
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {/* Calendar Dialog Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
          {/* Backdrop Click */}
          <div
            className="fixed inset-0"
            onClick={() => setIsCalendarOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container with Max Height & Flex Column */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เลือกวันเข้าพัก"
            className="relative z-10 bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95"
          >
            {/* 1. Sticky Modal Header */}
            <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 bg-white shrink-0">
              <div>
                <h4 className="font-black text-slate-900 text-base leading-tight">
                  เลือกวันเข้าพัก & วันเช็คเอาท์
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {calendarStep === 'checkin'
                    ? 'ขั้นตอนที่ 1: แตะเลือก "วันเช็คอินเข้าพัก"'
                    : 'ขั้นตอนที่ 2: แตะเลือก "วันเช็คเอาท์ออก"'}
                </p>
              </div>
              <button
                onClick={() => setIsCalendarOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Scrollable Calendar Content */}
            <div className="overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-3 flex-1">
              {/* Current Selection Pill */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCalendarStep('checkin')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    calendarStep === 'checkin'
                      ? 'bg-sky-50 border-sky-500 text-sky-900 font-bold ring-2 ring-sky-200 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-normal leading-tight">วันเช็คอิน</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                    {formatThaiDate(tempCheckin)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCalendarStep('checkout')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    calendarStep === 'checkout'
                      ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-2 ring-teal-200 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-normal leading-tight">วันเช็คเอาท์</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                    {formatThaiDate(tempCheckout)}
                  </span>
                </button>
              </div>

              {/* Month & Nav Controls */}
              <div className="flex items-center justify-between px-1 py-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  disabled={!canGoPrevMonth}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-black text-slate-800 text-sm sm:text-base">
                  {THAI_MONTHS_FULL[month]} {year + 543}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-all"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar Days Matrix */}
              <div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
                  {THAI_DAYS_SHORT.map((d, i) => (
                    <span key={i} className={i === 0 ? 'text-rose-500 font-black' : i === 6 ? 'text-amber-500 font-black' : ''}>
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {/* Empty offset padding */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-12 sm:h-14" />
                  ))}

                  {/* Days of Month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = formatDateToISO(new Date(year, month, dayNum));
                    const isPast = dateStr < todayStr;
                    const isCheckin = dateStr === tempCheckin;
                    const isCheckout = dateStr === tempCheckout;
                    const isInRange = dateStr > tempCheckin && dateStr < tempCheckout;
                    const holidayName = getThaiHolidayName(dateStr);

                    let styleClass = 'hover:bg-sky-50 text-slate-800 bg-white border border-slate-100';
                    if (isPast) {
                      styleClass = 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40';
                    } else if (isCheckin) {
                      styleClass = 'bg-sky-600 text-white font-extrabold shadow-md rounded-xl border border-sky-700 ring-2 ring-sky-300';
                    } else if (isCheckout) {
                      styleClass = 'bg-teal-600 text-white font-extrabold shadow-md rounded-xl border border-teal-700 ring-2 ring-teal-300';
                    } else if (isInRange) {
                      styleClass = 'bg-sky-100 text-sky-900 font-bold border border-sky-200';
                    } else if (holidayName) {
                      styleClass = 'bg-rose-50 border border-rose-300 text-rose-950 font-bold hover:bg-rose-100 shadow-2xs';
                    }

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        disabled={isPast}
                        onClick={() => handleDateClick(dayNum)}
                        className={`h-12 sm:h-14 relative flex flex-col items-center justify-start pt-1 px-0.5 text-xs rounded-xl transition-all touch-manipulation cursor-pointer ${styleClass}`}
                        title={holidayName ? `🎉 วันหยุดนักขัตฤกษ์: ${holidayName}` : undefined}
                      >
                        <span className={`text-xs sm:text-sm font-extrabold leading-none ${isCheckin || isCheckout ? 'text-white' : holidayName ? 'text-rose-800' : 'text-slate-900'}`}>
                          {dayNum}
                        </span>
                        {holidayName && (
                          <span className={`text-[8px] sm:text-[9px] font-extrabold px-0.5 sm:px-1 py-0.2 rounded mt-0.5 leading-tight truncate w-full text-center ${
                            isCheckin || isCheckout
                              ? 'bg-white/20 text-white'
                              : 'bg-rose-200/90 text-rose-950'
                          }`}>
                            {holidayName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Month Holiday Summary List */}
                {(() => {
                  const monthHolidays: { day: number; name: string }[] = [];
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dStr = formatDateToISO(new Date(year, month, d));
                    const hName = getThaiHolidayName(dStr);
                    if (hName) {
                      monthHolidays.push({ day: d, name: hName });
                    }
                  }
                  if (monthHolidays.length === 0) return null;
                  return (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-[11px] text-rose-900">
                      <span className="font-extrabold flex items-center gap-1 mb-1">
                        <span>🎉 วันหยุดนักขัตฤกษ์ในเดือนนี้:</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {monthHolidays.map((h, idx) => (
                          <span key={idx} className="bg-white px-2 py-0.5 rounded-md border border-rose-200 text-[10px] font-bold shadow-2xs">
                            {h.day} {THAI_MONTHS_FULL[month].slice(0, 3)}: <span className="text-rose-700">{h.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 3. Sticky Footer Actions (Always visible, prominent 'ตกลงเลือกวัน' button) */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white/95 backdrop-blur-md shrink-0 space-y-2.5 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
              {/* Selected date overview banner */}
              {(() => {
                const tempN = Math.max(1, getDaysDifference(tempCheckin, tempCheckout));
                const tempHolidays: string[] = [];
                for (let i = 0; i < tempN; i++) {
                  const d = addDays(tempCheckin, i);
                  const h = getThaiHolidayName(d);
                  if (h && !tempHolidays.includes(h)) tempHolidays.push(h);
                }
                return (
                  <div className="space-y-1 text-xs px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <span>ช่วงที่เลือก:</span>
                      </span>
                      <span className="font-extrabold text-sky-900 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                        {formatThaiDate(tempCheckin)} ➔ {formatThaiDate(tempCheckout)} ({tempN} คืน)
                      </span>
                    </div>
                    {tempHolidays.length > 0 && (
                      <div className="flex items-center justify-end">
                        <span className="text-[11px] font-extrabold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                          🎉 ตรงกับวันหยุด: {tempHolidays.join(', ')} (เรทวันหยุดนักขัตฤกษ์)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="button"
                  onClick={handleApplyCalendar}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 active:scale-[0.98] text-white text-sm font-black shadow-lg shadow-sky-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  id="btn-confirm-calendar-dates"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>ตกลงเลือกวัน ({Math.max(1, getDaysDifference(tempCheckin, tempCheckout))} คืน)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
