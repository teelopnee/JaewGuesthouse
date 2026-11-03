import { BookingRecord, RoomItem, RoomAvailability, GuesthouseConfig } from '../types';
import { ROOMS_DATA } from '../data/roomsData';
import { getTodayString, formatThaiDate } from '../utils/dateUtils';
import { phoneDisplayNumber } from '../data/config';

const KNOWN_ROOM_IDS = new Set(ROOMS_DATA.map((r) => r.id));

const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * Does a booking's room_id point at this room?
 * Bookings made in this app use the room's id (e.g. "b14-15") and match exactly.
 * Bookings from the Jaew Logbook use free text such as "301", "บ้านหลัง 5",
 * "ห้องชุด 14" or "1 (Seaview)", which are matched by building rules below.
 */
export function doesBookingMatchRoom(bookingRoomId: string, room: RoomItem): boolean {
  if (!bookingRoomId || !room) return false;
  const b = String(bookingRoomId).trim();
  const rNum = room.roomNumber.trim();

  // 1. Booking made in this app
  if (KNOWN_ROOM_IDS.has(b)) return b === room.id;
  if (b === room.displayName.trim()) return true;

  // 2. Houses (บ้านหลัง 5, บ้าน 10 ...)
  const isBHouse = b.includes('บ้าน');
  const isRHouse = room.zone === 'house' || rNum.includes('บ้าน');
  if (isBHouse || isRHouse) {
    return isBHouse && isRHouse && digitsOf(b) === digitsOf(rNum);
  }

  // 3. Suites (ห้องชุด 1, ห้องชุด 2, ห้องชุด 14)
  const isBSuite = b.includes('ชุด');
  const isRSuite = room.zone === 'suite' || rNum.includes('ห้องชุด');
  if (isBSuite || isRSuite) {
    if (isBSuite && isRSuite) return digitsOf(b) === digitsOf(rNum);
    // plain "14" means the building-14 suite
    return isRSuite && room.id === 'b14-suite14' && b === '14';
  }

  // 4. Front building / seaview: "1 (Seaview)", "4 วิวทะเล", "7 (ตึกหน้า)", "2 (ระเบียง)", plain "1" / "2"
  const isBSeaview = /seaview/i.test(b) || b.includes('วิวทะเล') || b.includes('ตึกหน้า');
  if (isBSeaview || /^[1-6]\s*\((ระเบียง|seaview)/i.test(b) || /^[12]$/.test(b)) {
    return room.zone === 'seaview' && digitsOf(b) === digitsOf(rNum);
  }

  // 5. Water building: "7 (ตึกน้ำ)" or plain single digits 3-9
  if (b.includes('น้ำ') || /^[3-9]$/.test(b)) {
    return room.zone === 'building_water' && digitsOf(b) === digitsOf(rNum);
  }

  // 6. Exact room number ("8 (ระเบียง)", "66 (ระเบียง)" ...)
  if (b === rNum) return true;

  // 7. Building 301-306 (listed under the office zone)
  if (/^30[1-6]/.test(b)) {
    return (room.zone === 'office' || room.zone === 'building_300') && digitsOf(b) === digitsOf(rNum);
  }

  // 8. Building 14 rooms 15-20
  if (/^(15|16|17|18|19|20)$/.test(b)) {
    return room.zone === 'building_14' && rNum === b;
  }

  // 9. Beautiful building 33-88
  if (/^(33|44|55|66|77|88)/.test(b)) {
    return room.zone === 'building_16' && digitsOf(b) === digitsOf(rNum);
  }

  // 10. Office rooms 102, 201-206
  if (/^(102|20[1-6])$/.test(b)) {
    return room.zone === 'office' && rNum === b;
  }

  return false;
}

export function isActiveBooking(b: BookingRecord): boolean {
  return b.stay_status !== 'เช็คเอาท์แล้ว' && b.stay_status !== 'ยกเลิก' && b.payment_status !== 'cancelled';
}

/** Is the room booked during [checkin, checkout)? */
export function checkRoomAvailability(
  room: RoomItem,
  checkin: string,
  checkout: string,
  bookings: BookingRecord[]
): RoomAvailability {
  if (!checkin || !checkout) {
    return { isBooked: false, statusLabel: 'ว่าง', overlappingBookings: [] };
  }

  const overlapping = bookings.filter(
    (b) =>
      isActiveBooking(b) &&
      doesBookingMatchRoom(b.room_id, room) &&
      b.checkin_date < checkout &&
      b.checkout_date > checkin
  );

  const isBooked = overlapping.length > 0;
  return {
    isBooked,
    statusLabel: isBooked ? 'ติดจองแล้ว' : 'ว่าง',
    overlappingBookings: overlapping,
  };
}

/**
 * Recommends similar rooms that are AVAILABLE on the selected dates.
 * Never suggests a booked room: when nothing is free the list is simply empty.
 */
export function findSimilarAvailableRooms(
  targetRoom: RoomItem,
  checkin: string,
  checkout: string,
  allRooms: RoomItem[],
  bookings: BookingRecord[],
  limit = 4
): RoomItem[] {
  const pool = allRooms.filter(
    (r) => r.id !== targetRoom.id && !checkRoomAvailability(r, checkin, checkout, bookings).isBooked
  );

  const scored = pool.map((r) => {
    let score = 0;
    if (r.capacity === targetRoom.capacity) score += 120;
    else if (Math.abs(r.capacity - targetRoom.capacity) <= 2) score += 50;
    if (r.zone === targetRoom.zone) score += 60;
    if (r.bedSize && targetRoom.bedSize && r.bedSize === targetRoom.bedSize) score += 40;
    if (r.hasSeaView === targetRoom.hasSeaView) score += 20;
    if (r.hasBalcony === targetRoom.hasBalcony) score += 15;
    score -= Math.abs(r.priceStart - targetRoom.priceStart) / 20;
    return { room: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.room);
}

/** Bookings that overlap the given one in the same room (double booking check). */
export function findConflictingBookings(
  draft: Pick<BookingRecord, 'room_id' | 'checkin_date' | 'checkout_date'> & { booking_id?: string },
  room: RoomItem | undefined,
  bookings: BookingRecord[]
): BookingRecord[] {
  return bookings.filter((b) => {
    if (b.booking_id === draft.booking_id || !isActiveBooking(b)) return false;
    const sameRoom = room ? doesBookingMatchRoom(b.room_id, room) : b.room_id === draft.room_id;
    return sameRoom && b.checkin_date < draft.checkout_date && b.checkout_date > draft.checkin_date;
  });
}

/** Clean, polite Thai summary to paste into LINE. */
export function formatBookingForLine(booking: BookingRecord, config: GuesthouseConfig, room?: RoomItem): string {
  const roomTitle = room ? `${room.displayName}` : `ห้อง ${booking.room_number || booking.room_id}`;
  const statusThai =
    booking.payment_status === 'fully_paid'
      ? 'ชำระครบแล้ว ✅'
      : booking.payment_status === 'deposit_paid'
      ? `มัดจำแล้ว (${Number(booking.deposit_amount || 0).toLocaleString()} บ.)`
      : booking.payment_status === 'cancelled'
      ? 'ยกเลิกการจอง'
      : 'รอชำระ';

  const checkinTime = booking.checkin_time || '14:00';
  const checkoutTime = booking.checkout_time || '12:00';

  let msg = `📋 รายละเอียดการจองห้องพัก - ${config.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 ผู้เข้าพัก: ${booking.guest_name || 'ลูกค้า'}\n`;
  if (booking.phone) msg += `📞 เบอร์โทรศัพท์: ${booking.phone}\n`;
  if (booking.license_plate) msg += `🚗 เลขทะเบียนรถ: ${booking.license_plate}\n`;
  msg += `🏠 ห้องพัก: ${roomTitle}\n`;
  if (booking.guest_count) msg += `👥 จำนวนผู้เข้าพัก: ${booking.guest_count} ท่าน\n`;
  // Thai dates read better for guests; odd logbook values fall back to the raw text.
  const thaiDate = (d: string) => formatThaiDate(d, true) || d;
  msg += `📅 เช็คอิน: ${thaiDate(booking.checkin_date)} (เวลา ${checkinTime} น.)\n`;
  msg += `📅 เช็คเอาท์: ${thaiDate(booking.checkout_date)} (เวลา ${checkoutTime} น.)\n`;
  if (booking.nights) msg += `🌙 จำนวน: ${booking.nights} คืน\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (booking.actual_price) {
    msg += `💰 ยอดรวม: ${Number(booking.actual_price).toLocaleString()} บาท\n`;
    msg += `💵 เงินมัดจำ: ${Number(booking.deposit_amount || 0).toLocaleString()} บาท\n`;
    const remaining = Math.max(0, (booking.actual_price || 0) - (booking.deposit_amount || 0));
    if (remaining > 0 && booking.payment_status !== 'fully_paid') {
      msg += `💳 ยอดคงเหลือชำระวันเข้าพัก: ${Number(remaining).toLocaleString()} บาท\n`;
    }
    msg += `📊 สถานะ: ${statusThai}\n`;
  }
  if (booking.notes) msg += `📝 หมายเหตุ: ${booking.notes}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📍 ที่อยู่: ${config.address}\n`;
  msg += `🗺️ Google Maps: ${config.googleMapsUrl}\n`;
  msg += `☎️ ติดต่อสอบถาม: ${config.phonePrimaryDisplay || phoneDisplayNumber(config)}\n`;
  msg += `ขอบพระคุณที่เลือกพักกับ ${config.name} ครับ/ค่ะ 🙏`;
  return msg;
}

/** Today's numbers for the admin ledger header. */
export function getTodayStats(bookings: BookingRecord[], targetDateStr?: string) {
  const today = targetDateStr || getTodayString();
  let occupiedToday = 0;
  let arrivalsToday = 0;
  let departuresToday = 0;
  let totalRevenue = 0;
  let totalDeposit = 0;

  bookings.forEach((b) => {
    if (b.stay_status === 'ยกเลิก' || b.payment_status === 'cancelled') return;
    if (b.checkin_date <= today && b.checkout_date > today) occupiedToday += 1;
    if (b.checkin_date === today) arrivalsToday += 1;
    if (b.checkout_date === today) departuresToday += 1;
    if (b.checkin_date === today || (b.checkin_date <= today && b.checkout_date >= today)) {
      totalRevenue += Number(b.actual_price || 0);
      totalDeposit += Number(b.deposit_amount || 0);
    }
  });

  return { today, occupiedToday, arrivalsToday, departuresToday, totalRevenue, totalDeposit };
}
