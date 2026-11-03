import { RoomItem } from '../types';

/**
 * Returns room number formatted with building/zone info for clear identification in copy texts & messages.
 * e.g.,
 *  room 1 (Seaview) -> "1 (Seaview - ตึกหน้า)"
 *  room 3 in water  -> "3 (ตึกน้ำ)"
 *  room 16 in b14   -> "16 (ตึก 14)"
 *  room 33 in b16   -> "33 (ตึกสวย)"
 *  room 102         -> "102 (ตึก Office)"
 *  room 301         -> "301 (ตึก Office - ระเบียง)"
 *  room 8           -> "8 (ตึกน้ำ - ระเบียง)"
 *  suite 1          -> "ห้องชุด 1 (โซนห้องชุด)"
 *  house 5          -> "บ้านหลัง 5 (โซนบ้านหลัง)"
 */
/** Short building / zone name, e.g. "ตึกสวย", "ตึกน้ำ", "ตึก Office". */
export function getBuildingName(room: RoomItem): string {
  switch (room.zone) {
    case 'seaview':
      return 'ตึกหน้า';
    case 'building_water':
      return 'ตึกน้ำ';
    case 'office':
    case 'building_300':
      return 'ตึก Office';
    case 'building_14':
      return 'ตึก 14';
    case 'building_16':
      return 'ตึกสวย';
    case 'suite':
      return 'โซนห้องชุด';
    case 'house':
      return 'โซนบ้านหลัง';
    default:
      return room.zoneName.replace(/\(.*\)/, '').trim();
  }
}

export function getRoomNumberWithBuilding(room: RoomItem): string {
  const num = room.roomNumber.trim();
  const building = getBuildingName(room);

  if (num.includes(building)) {
    return num;
  }

  if (num.includes('(')) {
    if (num.includes('Seaview')) {
      return `${num.replace(')', ' - ตึกหน้า)')}`;
    }
    return num.replace('(', `(${building} - `);
  }

  return `${num} (${building})`;
}
