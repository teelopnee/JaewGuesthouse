/**
 * Utilities for Thai date formatting and calendar calculations.
 * All dates are "YYYY-MM-DD" strings in the guest's local calendar - never UTC,
 * so "today" is correct in Thailand before 07:00 too.
 */

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function isValidDateString(dateStr: string | undefined | null): dateStr is string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayString(): string {
  return formatDateToISO(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateToISO(d);
}

export function getTomorrowString(): string {
  return addDays(getTodayString(), 1);
}

export function getThisSaturdayString(): string {
  const now = parseDate(getTodayString());
  const diff = (6 - now.getDay() + 7) % 7;
  now.setDate(now.getDate() + diff);
  return formatDateToISO(now);
}

export function getNextSaturdayString(): string {
  return addDays(getThisSaturdayString(), 7);
}

/** Next date (today or later) that falls on the given month/day, e.g. 23 Oct or 13 Apr. */
export function getNextOccurrence(month: number, day: number): string {
  const today = getTodayString();
  const year = parseDate(today).getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  return thisYear >= today ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
}

export function formatThaiDate(dateStr: string, includeDayOfWeek = false): string {
  if (!isValidDateString(dateStr)) return '';
  const d = parseDate(dateStr);
  const dayOfWeek = THAI_DAYS_FULL[d.getDay()];
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const thaiYear = (d.getFullYear() + 543).toString().slice(-2); // e.g. 69

  if (includeDayOfWeek) {
    return `วัน${dayOfWeek}ที่ ${day} ${month} ${thaiYear}`;
  }
  return `${day} ${month} ${thaiYear}`;
}

export function formatThaiDateRange(checkinStr: string, checkoutStr: string): string {
  if (!isValidDateString(checkinStr) || !isValidDateString(checkoutStr)) return '';
  const dIn = parseDate(checkinStr);
  const dOut = parseDate(checkoutStr);
  const nights = getDaysDifference(checkinStr, checkoutStr);

  const inDay = dIn.getDate();
  const inMonth = THAI_MONTHS_SHORT[dIn.getMonth()];
  const outDay = dOut.getDate();
  const outMonth = THAI_MONTHS_SHORT[dOut.getMonth()];
  const year = (dOut.getFullYear() + 543).toString().slice(-2);

  if (dIn.getMonth() === dOut.getMonth() && dIn.getFullYear() === dOut.getFullYear()) {
    return `${inDay} - ${outDay} ${outMonth} ${year} (${nights} คืน)`;
  }
  return `${inDay} ${inMonth} - ${outDay} ${outMonth} ${year} (${nights} คืน)`;
}

/** Number of nights between two dates (minimum 1). DST-safe. */
export function getDaysDifference(checkinStr: string, checkoutStr: string): number {
  if (!isValidDateString(checkinStr) || !isValidDateString(checkoutStr)) return 1;
  const [y1, m1, d1] = checkinStr.split('-').map(Number);
  const [y2, m2, d2] = checkoutStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  return Math.max(1, diff);
}

/** Makes sure a date selection is usable: valid dates, check-in not in the past, checkout after check-in. */
export function normaliseDateSelection(checkin: string, checkout: string): { checkin: string; checkout: string } {
  const today = getTodayString();
  let ci = isValidDateString(checkin) && checkin >= today ? checkin : today;
  let co = isValidDateString(checkout) && checkout > ci ? checkout : addDays(ci, 1);
  return { checkin: ci, checkout: co };
}

export { THAI_MONTHS_SHORT, THAI_MONTHS_FULL, THAI_DAYS_SHORT, THAI_DAYS_FULL };
