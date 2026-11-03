import React, { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { DateAvailabilityPicker } from './components/DateAvailabilityPicker';
import { CapacityFilter, FilterOptions } from './components/CapacityFilter';
import { RoomCard } from './components/RoomCard';
import { RoomModal } from './components/RoomModal';
import { LocationGuideSection } from './components/LocationGuideSection';
import { LineQRCodeCard, LineQRCodeModal } from './components/LineQRCodeCard';
import { ExtraServices } from './components/ExtraServices';
import { Footer } from './components/Footer';
import { FloatingActionBar } from './components/FloatingActionBar';
import { QuickBookingModal } from './components/QuickBookingModal';
import { lazyNamed } from './utils/lazyWithReload';

// Admin screens are only downloaded when someone opens the admin login or is signed in,
// so customers get a smaller, faster page.
const AdminTopBanner = lazyNamed(() => import('./components/AdminTopBanner'), 'AdminTopBanner');
const AdminPinModal = lazyNamed(() => import('./components/AdminPinModal'), 'AdminPinModal');
const RoomPhotoModal = lazyNamed(() => import('./components/RoomPhotoModal'), 'RoomPhotoModal');
const AdminRoomEditModal = lazyNamed(() => import('./components/AdminRoomEditModal'), 'AdminRoomEditModal');
const GuesthouseSettingsModal = lazyNamed(() => import('./components/GuesthouseSettingsModal'), 'GuesthouseSettingsModal');
const AdminChangePinModal = lazyNamed(() => import('./components/AdminChangePinModal'), 'AdminChangePinModal');
const AdminBookingsModal = lazyNamed(() => import('./components/AdminBookingsModal'), 'AdminBookingsModal');
const AdminPriceModal = lazyNamed(() => import('./components/AdminPriceModal'), 'AdminPriceModal');
import { RoomItem, DateSelection, RoomAvailability, PricingMode } from './types';
import { checkRoomAvailability, findSimilarAvailableRooms, isActiveBooking } from './services/bookingUtils';
import { useAppData } from './context/AppDataContext';
import { useToast } from './context/ToastContext';
import { getTodayString, getTomorrowString, normaliseDateSelection } from './utils/dateUtils';
import { getRoomImages } from './utils/imageUtils';
import { parsePriceNumber } from './utils/pricingUtils';
import { BedDouble, Sparkles, AlertCircle, WifiOff } from 'lucide-react';

export type { FilterOptions };

const DEFAULT_FILTER: FilterOptions = {
  capacity: null,
  bedFilter: 'all',
  zone: 'all',
  searchQuery: '',
};

export default function App() {
  const {
    isAdmin,
    isLoading,
    isOffline,
    lastSyncedTime,
    rooms: processedRooms,
    bookings,
    config,
    refresh,
    logout,
    setPricingMode,
    toggleRoomRental,
    resetAllSettings,
  } = useAppData();
  const { showToast } = useToast();
  const pricingMode = config.pricingMode;
  const customImagesMap = config.roomImages;

  // 1. Date Selection State
  const [dates, setDatesRaw] = useState<DateSelection>(() => ({
    checkin: getTodayString(),
    checkout: getTomorrowString(),
  }));
  const setDates = useCallback((next: DateSelection) => {
    setDatesRaw(normaliseDateSelection(next.checkin, next.checkout));
  }, []);

  const [showOnlyAvailable, setShowOnlyAvailable] = useState<boolean>(false);

  // A page left open overnight must not keep showing yesterday as the check-in date.
  useEffect(() => {
    if (dates.checkin < getTodayString()) {
      setDatesRaw((prev) => normaliseDateSelection(prev.checkin, prev.checkout));
    }
  }, [lastSyncedTime, dates.checkin]);

  // 2. Filter State
  const [filter, setFilter] = useState<FilterOptions>(DEFAULT_FILTER);

  // 3. Selected rooms for the detail / quick booking sheets (stored by id so they always show fresh data)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [quickBookRoomId, setQuickBookRoomId] = useState<string | null>(null);

  // 4. LINE QR Code Modal State
  const [isLineQrOpen, setIsLineQrOpen] = useState<boolean>(false);
  const [lineQrRoomName, setLineQrRoomName] = useState<string | undefined>(undefined);

  const handleOpenLineQr = useCallback((roomName?: string) => {
    setLineQrRoomName(roomName);
    setIsLineQrOpen(true);
  }, []);

  // 5. Admin modals
  const [photoModalRoomId, setPhotoModalRoomId] = useState<string | null>(null);
  const [isAdminPinOpen, setIsAdminPinOpen] = useState<boolean>(false);
  const [adminEditRoomId, setAdminEditRoomId] = useState<string | null>(null);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState<boolean>(false);
  const [isAdminChangePinOpen, setIsAdminChangePinOpen] = useState<boolean>(false);
  const [isAdminBookingsOpen, setIsAdminBookingsOpen] = useState<boolean>(false);
  const [isAdminPriceOpen, setIsAdminPriceOpen] = useState<boolean>(false);
  const [showOnlyClosedRooms, setShowOnlyClosedRooms] = useState<boolean>(false);

  const findRoom = useCallback(
    (id: string | null) => (id ? processedRooms.find((r) => r.id === id) || null : null),
    [processedRooms]
  );
  const selectedRoom = findRoom(selectedRoomId);
  const quickBookRoom = findRoom(quickBookRoomId);
  const photoModalRoom = findRoom(photoModalRoomId);
  const adminEditRoom = findRoom(adminEditRoomId);

  const runAdminAction = useCallback(
    async (action: () => Promise<void>, successText?: string) => {
      try {
        await action();
        if (successText) showToast(successText);
      } catch (err) {
        showToast((err as Error).message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error');
        throw err;
      }
    },
    [showToast]
  );

  const handleTogglePricingMode = useCallback(
    (newMode: PricingMode) => {
      if (newMode === pricingMode) return;
      runAdminAction(
        () => setPricingMode(newMode),
        newMode === 'full' ? 'เปลี่ยนเป็นโหมดแสดงราคาทุกวันแล้ว' : 'เปลี่ยนเป็นโหมดแสดงเฉพาะวันธรรมดาแล้ว'
      ).catch(() => {});
    },
    [pricingMode, runAdminAction, setPricingMode]
  );

  const handleToggleRoomRental = useCallback(
    (room: RoomItem, isHidden: boolean) => {
      runAdminAction(
        () => toggleRoomRental(room.id, isHidden),
        isHidden ? `ปิดการปล่อยเช่าห้อง ${room.roomNumber} แล้ว` : `เปิดให้เช่าห้อง ${room.roomNumber} แล้ว`
      ).catch(() => {});
    },
    [runAdminAction, toggleRoomRental]
  );

  const handleResetAllAdminSettings = useCallback(() => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการคืนค่าการปรับแต่งทั้งหมดกลับสู่ค่าเริ่มต้นจากโรงงาน?')) {
      runAdminAction(resetAllSettings, 'คืนค่าเริ่มต้นทั้งหมดเรียบร้อยแล้ว').catch(() => {});
    }
  }, [resetAllSettings, runAdminAction]);

  const handleAdminLogout = useCallback(() => {
    logout();
    setShowOnlyClosedRooms(false);
    setIsAdminBookingsOpen(false);
    setIsAdminPriceOpen(false);
    setIsAdminSettingsOpen(false);
    setIsAdminChangePinOpen(false);
    setAdminEditRoomId(null);
    setPhotoModalRoomId(null);
    showToast('ออกจากโหมดผู้ดูแลระบบแล้ว');
  }, [logout, showToast]);

  const todayStr = getTodayString();
  const todayBookingsCount = useMemo(
    () => bookings.filter((b) => b.checkin_date <= todayStr && b.checkout_date > todayStr && isActiveBooking(b)).length,
    [bookings, todayStr]
  );

  const scrollToRooms = useCallback(() => {
    const el = document.getElementById('rooms-list-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToDates = useCallback(() => {
    const el = document.getElementById('date-picker-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Filter 500 baht rooms directly and scroll to rooms list
  const handleSelect500Filter = useCallback(() => {
    setShowOnlyAvailable(false);
    setFilter({ ...DEFAULT_FILTER, bedFilter: '500baht' });
    setTimeout(scrollToRooms, 50);
  }, [scrollToRooms]);

  // Rooms customers may see (admin sees everything)
  const visibleRooms = useMemo(
    () => (isAdmin ? processedRooms : processedRooms.filter((r) => !r.isHiddenFromRental)),
    [processedRooms, isAdmin]
  );

  const openRoomsCount = useMemo(() => processedRooms.filter((r) => !r.isHiddenFromRental).length, [processedRooms]);
  const closedRoomsCount = processedRooms.length - openRoomsCount;

  const availabilityMap = useMemo(() => {
    const map = new Map<string, RoomAvailability>();
    processedRooms.forEach((room) => {
      map.set(room.id, checkRoomAvailability(room, dates.checkin, dates.checkout, bookings));
    });
    return map;
  }, [processedRooms, dates, bookings]);

  const { availableCount, bookedCount } = useMemo(() => {
    let avail = 0;
    let booked = 0;
    visibleRooms.forEach((r) => {
      if (availabilityMap.get(r.id)?.isBooked) booked++;
      else avail++;
    });
    return { availableCount: avail, bookedCount: booked };
  }, [availabilityMap, visibleRooms]);

  const countsByCapacity = useMemo(() => {
    const counts: Record<number, number> = {};
    visibleRooms.forEach((r) => {
      counts[r.capacity] = (counts[r.capacity] || 0) + 1;
    });
    return counts;
  }, [visibleRooms]);

  const minWeekdayPrice = useMemo(() => {
    const prices = visibleRooms.map((r) => parsePriceNumber(r.prices.weekday, r.priceStart)).filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : undefined;
  }, [visibleRooms]);

  const countsByBed = useMemo(() => {
    let bed6 = 0;
    let bed5 = 0;
    let count500 = 0;
    visibleRooms.forEach((r) => {
      if (r.capacity === 2) {
        if (r.bedSize === 6) bed6++;
        if (r.bedSize === 5) bed5++;
      }
      if (r.priceStart === 500) count500++;
    });
    return { bed6, bed5, count500 };
  }, [visibleRooms]);

  const filteredRooms = useMemo(() => {
    const query = filter.searchQuery.toLowerCase().trim();
    const list = visibleRooms.filter((room) => {
      if (isAdmin && showOnlyClosedRooms && !room.isHiddenFromRental) return false;
      if (showOnlyAvailable && availabilityMap.get(room.id)?.isBooked) return false;
      if (filter.capacity !== null && room.capacity !== filter.capacity) return false;

      if (filter.bedFilter === '500baht') {
        if (room.priceStart !== 500) return false;
      } else if (filter.bedFilter === '6ft') {
        if (room.capacity !== 2 || room.bedSize !== 6) return false;
      } else if (filter.bedFilter === '5ft') {
        if (room.capacity !== 2 || room.bedSize !== 5) return false;
      }

      if (filter.zone !== 'all') {
        if (filter.zone === 'office') {
          if (room.zone !== 'office' && room.zone !== 'building_300') return false;
        } else if (room.zone !== filter.zone) {
          return false;
        }
      }

      if (query !== '') {
        const matches =
          room.displayName.toLowerCase().includes(query) ||
          room.roomNumber.toLowerCase().includes(query) ||
          room.zoneName.toLowerCase().includes(query) ||
          `${room.capacity}`.includes(query) ||
          room.bedType.toLowerCase().includes(query) ||
          room.badges.some((b) => b.toLowerCase().includes(query));
        if (!matches) return false;
      }
      return true;
    });

    if (filter.bedFilter === '500baht') {
      const getZonePriority = (zone: string) => {
        if (zone === 'building_16') return 1;
        if (zone === 'building_14') return 2;
        if (zone === 'building_water') return 3;
        return 4;
      };
      return [...list].sort((a, b) => getZonePriority(a.zone) - getZonePriority(b.zone));
    }
    return list;
  }, [visibleRooms, isAdmin, showOnlyClosedRooms, showOnlyAvailable, filter, availabilityMap]);

  const activeFilterTitle = useMemo(() => {
    if (isAdmin && showOnlyClosedRooms) {
      return `⛔ รายการห้องพักที่ปิดการปล่อยเช่าชั่วคราว (${closedRoomsCount} ห้อง)`;
    }
    if (filter.bedFilter === '500baht') return '🔥 ห้องพักราคา 500 บาท/คืน (ตึกสวย • ตึก 14 • ตึกน้ำ)';
    if (filter.bedFilter === '6ft') return 'ห้องพัก 2 ท่าน (เตียง 6 ฟุต ตึกหน้า, ตึก 14, ตึกสวย)';
    if (filter.bedFilter === '5ft') return 'ห้องพัก 2 ท่าน (เตียง 5 ฟุต ตึกน้ำ, ตึก 14, ตึก Office)';
    if (filter.capacity === 2) return 'ห้องพักสำหรับ 2 ท่าน ทั้งหมด';
    if (filter.capacity === 4) return 'ห้องพักสำหรับ 4 ท่าน (ตึก 300 & โซน Office)';
    if (filter.capacity === 6) return 'ห้องชุด 14 สำหรับ 4 - 6 ท่าน (ตึก 14)';
    if (filter.capacity === 10) return 'ห้องชุด Family Suite สำหรับ 8 - 10 ท่าน (3 แอร์)';
    if (filter.capacity === 15) return 'บ้านพักส่วนตัวเป็นหลัง สำหรับ 12 - 15 ท่าน (2-3 แอร์)';
    if (filter.capacity !== null) return `ห้องพักสำหรับ ${filter.capacity} ท่าน`;
    return `รายการห้องพักและบ้านพักทั้งหมด (${visibleRooms.length} ห้อง)`;
  }, [filter.bedFilter, filter.capacity, isAdmin, showOnlyClosedRooms, closedRoomsCount, visibleRooms.length]);

  const selectedRoomAvailability = selectedRoom ? availabilityMap.get(selectedRoom.id) : undefined;
  const similarAvailableRooms = useMemo(() => {
    if (!selectedRoom) return [];
    const pool = processedRooms.filter((r) => !r.isHiddenFromRental);
    return findSimilarAvailableRooms(selectedRoom, dates.checkin, dates.checkout, pool, bookings, 4);
  }, [selectedRoom, dates, bookings, processedRooms]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased">
      {/* 0. Admin Top Banner (Only visible when Admin Mode is active) */}
      {isAdmin && (
        <Suspense fallback={null}>
        <AdminTopBanner
          totalRooms={processedRooms.length}
          openRoomsCount={openRoomsCount}
          closedRoomsCount={closedRoomsCount}
          todayBookingsCount={todayBookingsCount}
          pricingMode={pricingMode}
          onTogglePricingMode={handleTogglePricingMode}
          onOpenBookings={() => setIsAdminBookingsOpen(true)}
          onOpenGuesthouseSettings={() => setIsAdminSettingsOpen(true)}
          onOpenChangePin={() => setIsAdminChangePinOpen(true)}
          onOpenPriceManager={() => setIsAdminPriceOpen(true)}
          onLogout={handleAdminLogout}
          onResetAllSettings={handleResetAllAdminSettings}
          showOnlyClosedRooms={showOnlyClosedRooms}
          onToggleShowOnlyClosed={() => setShowOnlyClosedRooms((prev) => !prev)}
          isDefaultPin={config.isDefaultPin}
        />
        </Suspense>
      )}

      {/* 1. Header */}
      <Header onOpenLineQr={() => handleOpenLineQr()} />

      {/* Connection problem notice */}
      {isOffline && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>การเชื่อมต่อขัดข้องชั่วคราว สถานะห้องว่างอาจยังไม่อัปเดต • ทัก LINE หรือโทรสอบถามได้ตลอด</span>
          </div>
        </div>
      )}

      {/* 2. Hero Section */}
      <Hero onScrollToFilter={scrollToRooms} onSelect500Filter={handleSelect500Filter} />

      {/* 3. Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 w-full flex-1 -mt-2">
        <div id="date-picker-section" className="scroll-mt-16">
          <DateAvailabilityPicker
            dates={dates}
            onChangeDates={setDates}
            showOnlyAvailable={showOnlyAvailable}
            onToggleShowOnlyAvailable={setShowOnlyAvailable}
            availableCount={availableCount}
            totalCount={visibleRooms.length}
            bookedCount={bookedCount}
            isLoadingBookings={isLoading}
            onRefreshBookings={() => refresh(true)}
            lastSyncedTime={lastSyncedTime}
            minWeekdayPrice={minWeekdayPrice}
          />
        </div>

        <CapacityFilter
          filter={filter}
          onChangeFilter={setFilter}
          countsByCapacity={countsByCapacity}
          countsByBed={countsByBed}
          totalRooms={visibleRooms.length}
          filteredCount={filteredRooms.length}
          dates={dates}
          rooms={visibleRooms}
          pricingMode={pricingMode}
        />

        {/* Room Cards Grid Header */}
        <div
          id="rooms-list-section"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3 px-1 scroll-mt-20 sm:scroll-mt-24"
        >
          <div className="flex flex-wrap items-center gap-2">
            <BedDouble className="w-5 h-5 text-sky-600" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">{activeFilterTitle}</h2>
          </div>
        </div>

        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 justify-items-center">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                availability={availabilityMap.get(room.id)}
                dates={dates}
                pricingMode={pricingMode}
                onOpenDetails={(r) => setSelectedRoomId(r.id)}
                onQuickBook={(r) => setQuickBookRoomId(r.id)}
                images={getRoomImages(room, customImagesMap)}
                onManagePhotos={(r) => setPhotoModalRoomId(r.id)}
                isAdmin={isAdmin}
                onToggleRental={handleToggleRoomRental}
                onEditRoom={(r) => setAdminEditRoomId(r.id)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs my-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">ไม่พบห้องพักตามเงื่อนไขที่เลือก</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              ลองเปลี่ยนจำนวนคนหรือประเภทเตียง หรือแตะปุ่มด้านล่างเพื่อแสดงห้องพักทั้งหมด
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowOnlyAvailable(false);
                  setShowOnlyClosedRooms(false);
                  setFilter(DEFAULT_FILTER);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs touch-manipulation cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>แสดงห้องพักทั้งหมด</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Location & Nearby Attractions Guide (Google Maps & Street View 360) */}
        <LocationGuideSection />

        {/* 5. LINE Official Account QR Code Section */}
        <section id="line-qr-section" className="my-8 scroll-mt-16">
          <LineQRCodeCard />
        </section>

        {/* 6. Extra Services */}
        <ExtraServices />
      </main>

      {/* 7. Footer (With Secret Admin PIN Trigger) */}
      <Footer onOpenAdminPin={() => setIsAdminPinOpen(true)} isAdmin={isAdmin} />

      {/* 8. Floating Action Bar on Mobile */}
      <FloatingActionBar dates={dates} availableCount={availableCount} onOpenDatesModal={scrollToDates} />

      {/* 8.1 Quick Booking Sheet (1-tap LINE / Call) */}
      <QuickBookingModal
        room={quickBookRoom}
        dates={dates}
        pricingMode={pricingMode}
        images={quickBookRoom ? getRoomImages(quickBookRoom, customImagesMap) : []}
        onClose={() => setQuickBookRoomId(null)}
        onOpenLineQr={(rName) => handleOpenLineQr(rName)}
        isBooked={quickBookRoom ? Boolean(availabilityMap.get(quickBookRoom.id)?.isBooked) : false}
      />

      {/* 9. Room Detail Modal */}
      <RoomModal
        room={selectedRoom}
        onClose={() => setSelectedRoomId(null)}
        availability={selectedRoomAvailability}
        dates={dates}
        pricingMode={pricingMode}
        similarRooms={similarAvailableRooms}
        customImagesMap={customImagesMap}
        onSelectRoom={(r) => setSelectedRoomId(r.id)}
        onOpenLineQr={(rName) => handleOpenLineQr(rName)}
        images={selectedRoom ? getRoomImages(selectedRoom, customImagesMap) : []}
        onManagePhotos={(r) => setPhotoModalRoomId(r.id)}
        isAdmin={isAdmin}
        onEditRoom={(r) => setAdminEditRoomId(r.id)}
        onToggleRental={handleToggleRoomRental}
      />

      {/* 10. LINE QR Code Popup */}
      <LineQRCodeModal isOpen={isLineQrOpen} onClose={() => setIsLineQrOpen(false)} roomName={lineQrRoomName} />

      {/* Secret Admin PIN Modal */}
      {isAdminPinOpen && (
        <Suspense fallback={null}>
          <AdminPinModal isOpen={isAdminPinOpen} onClose={() => setIsAdminPinOpen(false)} />
        </Suspense>
      )}

      {/* Admin-only tools */}
      {isAdmin && (
        <Suspense fallback={null}>
          <RoomPhotoModal
            room={photoModalRoom}
            onClose={() => setPhotoModalRoomId(null)}
            currentImages={photoModalRoom ? getRoomImages(photoModalRoom, customImagesMap) : []}
            hasCustomImages={photoModalRoom ? Boolean(customImagesMap[photoModalRoom.id]?.length) : false}
          />

          <AdminRoomEditModal room={adminEditRoom} allRooms={processedRooms} onClose={() => setAdminEditRoomId(null)} />

          <GuesthouseSettingsModal isOpen={isAdminSettingsOpen} onClose={() => setIsAdminSettingsOpen(false)} />

          <AdminChangePinModal isOpen={isAdminChangePinOpen} onClose={() => setIsAdminChangePinOpen(false)} />

          <AdminBookingsModal
            isOpen={isAdminBookingsOpen}
            onClose={() => setIsAdminBookingsOpen(false)}
            rooms={processedRooms}
          />

          <AdminPriceModal
            isOpen={isAdminPriceOpen}
            onClose={() => setIsAdminPriceOpen(false)}
            rooms={processedRooms}
            pricingMode={pricingMode}
            onTogglePricingMode={handleTogglePricingMode}
          />
        </Suspense>
      )}
    </div>
  );
}
