import { parseDecimal, type DecimalString } from "./decimal.js";

export interface MoneyInput {
  amount: string;
  currency: string;
}

const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

export function currencyMinorUnits(currency: string): number {
  if (!supportedCurrencies.has(currency)) {
    throw new RangeError("Unsupported currency");
  }
  const precision = new Intl.NumberFormat("az", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (precision === undefined) {
    throw new RangeError("Currency precision is unavailable");
  }
  return precision;
}

export function parseMoney(input: MoneyInput): {
  amount: DecimalString;
  currency: string;
} {
  return {
    currency: input.currency,
    amount: parseDecimal(input.amount, currencyMinorUnits(input.currency)),
  };
}
