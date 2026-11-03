export type PricingMode = 'full' | 'weekday_only';

export interface PriceTiers {
  weekday: string;        // วันธรรมดา (อา.-ศ.) e.g. "500", "700 - 800"
  saturday: string;       // วันเสาร์ e.g. "800", "1,000 - 1,200"
  specialSaturday: string;// วันเสาร์พิเศษ / วันหยุดยาว e.g. "1,000", "1,400"
  festival: string;       // วันเทศกาล (ปีใหม่/สงกรานต์) e.g. "1,200", "1,800"
}

export type ZoneType =
  | 'seaview'        // ตึกหน้า / Seaview
  | 'building_water' // ตึกน้ำ / ระเบียง
  | 'office'         // โซน Office
  | 'building_300'   // ตึก 301-306
  | 'building_14'    // ตึก 14
  | 'building_16'    // ตึก 16
  | 'suite'          // ห้องชุด
  | 'house';         // บ้านหลัง

export interface RoomItem {
  id: string;
  roomNumber: string;       // e.g. "1 (Seaview)", "101", "204", "14 (ห้องชุด S)", "บ้านหลัง 1"
  displayName: string;      // e.g. "ห้อง 1 (Seaview วิวทะเล)"
  zone: ZoneType;
  zoneName: string;         // e.g. "ตึกหน้า (Seaview)", "ตึกน้ำ (ระเบียง)", "บ้านหลัง"
  capacity: number;         // 2, 4, 8, 10, 15
  capacityLabel: string;    // e.g. "2 ท่าน", "4 ท่าน", "8 ท่าน", "10 ท่าน", "15 ท่าน"
  bedType: string;          // e.g. "เตียง 6 ฟุต 1 เตียง"
  bedSize?: 5 | 6;          // 5 ฟุต หรือ 6 ฟุต สำหรับห้อง 2 คน
  coolingType: 'air' | 'fan';
  hasBalcony: boolean;
  hasSeaView: boolean;
  floor?: number | string;
  floorLabel?: string;
  prices: PriceTiers;
  priceStart: number;       // Numeric value for sorting e.g. 500
  images: string[];
  badges: string[];
  amenities: string[];
  description?: string;
  isHiddenFromRental?: boolean; // ปิดการปล่อยเช่าโดยแอดมิน
}

export interface RoomOverride {
  isHiddenFromRental?: boolean;
  roomNumber?: string;
  displayName?: string;
  priceStart?: number;
  prices?: PriceTiers;
  capacity?: number;
  capacityLabel?: string;
  bedType?: string;
  bedSize?: 5 | 6;
  badges?: string[];
  amenities?: string[];
  description?: string;
}

export type PaymentStatus = 'pending' | 'deposit_paid' | 'fully_paid' | 'cancelled';
export type StayStatus = 'จองล่วงหน้า' | 'กำลังพัก' | 'เช็คเอาท์แล้ว' | 'ยกเลิก';

export interface BookingRecord {
  booking_id: string;
  room_id: string;
  room_number?: string;
  guest_name?: string;
  phone?: string;
  license_plate?: string;      // เลขทะเบียนรถ e.g. "1กข 1234 กทม", "เวสป้า 888"
  guest_count?: number;
  booking_channel?: string;    // เช่น "LINE OA", "โทรศัพท์", "Walk-in", "Agoda"
  day_type?: string;
  checkin_date: string;        // "YYYY-MM-DD"
  checkin_time?: string;
  checkout_date: string;       // "YYYY-MM-DD"
  checkout_time?: string;
  nights?: number;
  actual_price?: number;       // ราคารวม
  deposit_amount?: number;     // เงินมัดจำ
  remaining_amount?: number;   // ยอดค้างชำระ
  payment_status?: PaymentStatus | string;
  notes?: string;
  stay_status?: StayStatus | string;
  is_double_booked?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RoomAvailability {
  isBooked: boolean;
  statusLabel: 'ว่าง' | 'ติดจองแล้ว';
  overlappingBookings: BookingRecord[];
}

export interface DateSelection {
  checkin: string;  // "YYYY-MM-DD"
  checkout: string; // "YYYY-MM-DD"
}

export interface GuesthouseConfig {
  name: string;
  nameEn: string;
  slogan: string;
  subSlogan: string;
  locationTitle: string;
  address: string;
  googleMapsUrl: string;
  lineId: string;
  lineOaUrl: string;
  phonePrimary: string;
  phoneSecondary: string;
  phonePrimaryDisplay: string;
  phoneSecondaryDisplay: string;
  checkInTime: string;
  checkOutTime: string;
  scooterPrice: string;
  electricScooterPrice: string;
  motorcyclePrice: string;
  /** 'on' | 'off' — show the electric motorbike rental to guests. */
  electricScooterEnabled: string;
  /** 'on' | 'off' — show the regular motorbike rental to guests. */
  motorcycleEnabled: string;
  parkingInfo: string;
}

export interface CreativeElementOverride {
  id: string;
  customText?: string;
  fontSize?: string;
  textColor?: string;
  bgColor?: string;
  padding?: string;
  borderRadius?: string;
  isHidden?: boolean;
  scale?: number;
}

export type CreativeElementsState = Record<string, CreativeElementOverride>;

export type CustomImagesMap = Record<string, string[]>;

/** Everything the server shares with the page (GET /api/state). */
export interface ServerConfig {
  roomOverrides: Record<string, RoomOverride>;
  guesthouseConfig: Partial<GuesthouseConfig>;
  pricingMode: PricingMode;
  creativeOverrides: CreativeElementsState;
  roomImages: CustomImagesMap;
  isDefaultPin: boolean;
}

export interface ServerState {
  rev: string;
  isAdmin: boolean;
  config: ServerConfig;
  bookings: BookingRecord[];
  sync: { enabled: boolean; ok: boolean };
}
