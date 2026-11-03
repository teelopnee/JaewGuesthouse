import { PriceTiers, DateSelection, PricingMode } from '../types';
import { parseDate, addDays, getDaysDifference } from './dateUtils';
import { getThaiHolidayName } from './holidayUtils';

/**
 * Helper to safely extract integer price from string or number.
 * Takes the first number in the text, so "700 - 800" is 700 (not 700800) and "฿1,200.-" is 1200.
 */
export function parsePriceNumber(val: string | number | undefined, defaultVal = 0): number {
  if (typeof val === 'number') return val;
  if (!val) return defaultVal;
  const match = String(val).replace(/,/g, '').match(/\d+/);
  const num = match ? parseInt(match[0], 10) : NaN;
  return isNaN(num) || num <= 0 ? defaultVal : num;
}

/**
 * Check if a specific date string ("YYYY-MM-DD") is Saturday (day 6)
 */
export function isSaturdayDate(dateStr: string): boolean {
  try {
    const d = parseDate(dateStr);
    return d.getDay() === 6; // 6 = Saturday
  } catch {
    return false;
  }
}

/**
 * A Saturday that is part of a long weekend ("เสาร์พิเศษ / หยุดยาว"):
 * a public holiday falls on the Friday before, or the Sunday / Monday after.
 */
export function isLongWeekendSaturday(dateStr: string): boolean {
  if (!isSaturdayDate(dateStr)) return false;
  return [-1, 1, 2].some((offset) => Boolean(getThaiHolidayName(addDays(dateStr, offset))));
}

/**
 * Compute normalized numeric rates for all tiers of a room
 */
export function resolveRoomPriceTiers(prices: PriceTiers): {
  weekdayNum: number;
  saturdayNum: number;
  specialSaturdayNum: number;
  festivalNum: number;
} {
  const weekdayNum = parsePriceNumber(prices.weekday, 500);

  // Default Saturday: +50% or +300 rounded
  const defaultSat = Math.max(weekdayNum + 300, Math.round((weekdayNum * 1.5) / 100) * 100);
  const saturdayNum = parsePriceNumber(prices.saturday, defaultSat);

  // Default Special Saturday: +200 over Saturday
  const defaultSpecialSat = Math.max(saturdayNum + 200, Math.round((weekdayNum * 1.8) / 100) * 100);
  const specialSaturdayNum = parsePriceNumber(prices.specialSaturday, defaultSpecialSat);

  // Default Festival / Public Holiday: +200-400 over Saturday or x2 weekday
  const defaultFestival = Math.max(specialSaturdayNum + 200, weekdayNum * 2, 1000);
  const festivalNum = parsePriceNumber(prices.festival, defaultFestival);

  return {
    weekdayNum,
    saturdayNum,
    specialSaturdayNum,
    festivalNum,
  };
}

export interface StayNightBreakdown {
  date: string;
  isSat: boolean;
  /** Saturday of a long weekend, charged at the "เสาร์พิเศษ" rate. */
  isLongWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  price: number;
  weekdayBase: number;
  isContactOnly: boolean;
}

export interface StayTotalPriceResult {
  total: number;
  nights: number;
  hasInquiryNights: boolean;
  pricingMode: PricingMode;
  breakdown: StayNightBreakdown[];
}

/**
 * Calculate total price for a stay given checkin, checkout dates and room price tiers
 * In 'full' mode: calculates exact rates for all days including holidays and Saturdays
 * In 'weekday_only' mode: calculates exact rate for weekdays, marks Saturdays & holidays as inquiry only
 */
export function calculateStayTotalPrice(
  dates: DateSelection,
  prices: PriceTiers,
  pricingMode: PricingMode = 'full'
): StayTotalPriceResult {
  const checkinStr = dates.checkin;
  const checkoutStr = dates.checkout;
  const nights = Math.max(1, getDaysDifference(checkinStr, checkoutStr));

  const { weekdayNum, saturdayNum, specialSaturdayNum, festivalNum } = resolveRoomPriceTiers(prices);

  let total = 0;
  let hasInquiryNights = false;
  const breakdown: StayNightBreakdown[] = [];

  for (let i = 0; i < nights; i++) {
    const currDateStr = addDays(checkinStr, i);
    const isSat = isSaturdayDate(currDateStr);
    const holidayName = getThaiHolidayName(currDateStr);
    const isHoliday = Boolean(holidayName);
    const isLongWeekend = !isHoliday && isLongWeekendSaturday(currDateStr);

    const isSpecialDay = isHoliday || isSat;
    const isContactOnly = pricingMode === 'weekday_only' && isSpecialDay;

    let nightPrice = weekdayNum;
    if (isHoliday) {
      nightPrice = festivalNum;
    } else if (isLongWeekend) {
      nightPrice = specialSaturdayNum;
    } else if (isSat) {
      nightPrice = saturdayNum;
    }

    if (isContactOnly) {
      hasInquiryNights = true;
    }

    total += nightPrice;
    breakdown.push({
      date: currDateStr,
      isSat,
      isLongWeekend,
      isHoliday,
      holidayName: holidayName || undefined,
      price: nightPrice,
      weekdayBase: weekdayNum,
      isContactOnly,
    });
  }

  return {
    total,
    nights,
    hasInquiryNights,
    pricingMode,
    breakdown,
  };
}

export interface ApplicableDisplayPriceResult {
  priceLabel: string;
  isContactOnly: boolean;
  isWeekendRate: boolean;
  /** At least one Saturday in the stay is a long-weekend Saturday. */
  isLongWeekendRate: boolean;
  isHolidayRate: boolean;
  holidayName?: string;
  nights: number;
  totalPrice: number;
  displayPrice: number;
  weekdayPrice: number;
  festivalPrice: number;
  saturdayPrice: number;
  pricingMode: PricingMode;
}

/**
 * Get the currently applicable price for display on RoomCard based on selected dates and mode
 */
export function getApplicableDisplayPrice(
  dates: DateSelection,
  prices: PriceTiers,
  pricingMode: PricingMode = 'full'
): ApplicableDisplayPriceResult {
  const calc = calculateStayTotalPrice(dates, prices, pricingMode);
  const { weekdayNum, saturdayNum, specialSaturdayNum, festivalNum } = resolveRoomPriceTiers(prices);

  const activeHoliday = calc.breakdown.find((b) => b.isHoliday);
  const hasSaturday = calc.breakdown.some((b) => b.isSat);
  const hasLongWeekend = calc.breakdown.some((b) => b.isLongWeekend);

  let displayPrice = weekdayNum;
  if (activeHoliday) {
    displayPrice = festivalNum;
  } else if (hasLongWeekend) {
    displayPrice = specialSaturdayNum;
  } else if (hasSaturday) {
    displayPrice = saturdayNum;
  }

  const isSpecialDay = Boolean(activeHoliday) || hasSaturday;
  const isContactOnly = pricingMode === 'weekday_only' && isSpecialDay;

  const priceLabel = isContactOnly
    ? 'ทักสอบถามราคา'
    : `฿${displayPrice.toLocaleString()}`;

  return {
    priceLabel,
    isContactOnly,
    isWeekendRate: hasSaturday,
    isLongWeekendRate: hasLongWeekend,
    isHolidayRate: Boolean(activeHoliday),
    holidayName: activeHoliday?.holidayName,
    nights: calc.nights,
    totalPrice: calc.total,
    displayPrice,
    weekdayPrice: weekdayNum,
    festivalPrice: festivalNum,
    saturdayPrice: saturdayNum,
    pricingMode,
  };
}

