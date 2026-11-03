import { GuesthouseConfig } from '../types';
import { parsePriceNumber } from './pricingUtils';

export type RentalKey = 'electric' | 'motorcycle';

export interface RentalOption {
  key: RentalKey;
  /** "มอเตอร์ไซค์ไฟฟ้า" / "มอเตอร์ไซค์" */
  name: string;
  emoji: string;
  /** Baht per day, from the admin's price text ("200 บาท / วัน" -> 200). */
  price: number;
  enabled: boolean;
}

/** The on/off switches are stored as text so they travel with the other contact settings. */
export const isSwitchOn = (value: string | undefined) => value !== 'off';

/** Motorbike rental options as the admin set them (price + shown / hidden). */
export function getRentals(gh: Pick<GuesthouseConfig, 'electricScooterPrice' | 'motorcyclePrice' | 'electricScooterEnabled' | 'motorcycleEnabled'>) {
  const electric: RentalOption = {
    key: 'electric',
    name: 'มอเตอร์ไซค์ไฟฟ้า',
    emoji: '⚡',
    price: parsePriceNumber(gh.electricScooterPrice, 200),
    enabled: isSwitchOn(gh.electricScooterEnabled),
  };
  const motorcycle: RentalOption = {
    key: 'motorcycle',
    name: 'มอเตอร์ไซค์',
    emoji: '🛵',
    price: parsePriceNumber(gh.motorcyclePrice, 350),
    enabled: isSwitchOn(gh.motorcycleEnabled),
  };
  const available = [electric, motorcycle].filter((r) => r.enabled);
  return {
    electric,
    motorcycle,
    available,
    any: available.length > 0,
    /** "มอเตอร์ไซค์ไฟฟ้า", "มอเตอร์ไซค์" or "มอเตอร์ไซค์ไฟฟ้าและมอเตอร์ไซค์" */
    names: available.map((r) => r.name).join('และ'),
  };
}
