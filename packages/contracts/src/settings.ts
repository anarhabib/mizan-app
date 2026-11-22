import { parseDecimal } from "./decimal.js";
import { currencyMinorUnits } from "./money.js";
import { officialRateCurrencies } from "./exchange-rates.js";

export const configuredCurrencies = ["AZN", ...officialRateCurrencies] as const;

export interface CurrencySettings {
  defaultCurrency: string;
  paymentCurrencies: string[];
}

export function checkoutCurrencies(settings: OrganizationSettings) {
  return settings.paymentCurrencies?.length
    ? settings.paymentCurrencies
    : [...new Set([settings.defaultCurrency, ...configuredCurrencies])];
}

export const defaultPurities = [375, 585, 750, 916, 999] as const;

export interface OrganizationSettings {
  defaultCurrency: string;
  paymentCurrencies?: string[];
  salespersonCanViewAcquisitionCost: boolean;
}
export interface PurityGrade {
  value: number;
  active: boolean;
}
export interface OldGoldRate {
  id: string;
  purity: number;
  currency: string;
  amountPerGram: string;
  effectiveAt: string;
  current: boolean;
}
export interface TradingSettings {
  settings: OrganizationSettings;
  purities: PurityGrade[];
  rates: OldGoldRate[];
}

export function parsePurity(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 999
    ? value
    : null;
}

export function parseRate(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const {
    purity: rawPurity,
    currency,
    amountPerGram,
  } = value as Record<string, unknown>;
  const purity = parsePurity(rawPurity);
  if (
    purity === null ||
    typeof currency !== "string" ||
    typeof amountPerGram !== "string" ||
    amountPerGram.length > 19 ||
    amountPerGram.split(".")[0].length > 14 ||
    !/[1-9]/.test(amountPerGram)
  )
    return null;
  try {
    currencyMinorUnits(currency);
    return { purity, currency, amountPerGram: parseDecimal(amountPerGram, 4) };
  } catch {
    return null;
  }
}
