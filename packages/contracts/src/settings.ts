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
export interface TradingSettings {
  settings: OrganizationSettings;
  purities: PurityGrade[];
}

export function parsePurity(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 999
    ? value
    : null;
}
