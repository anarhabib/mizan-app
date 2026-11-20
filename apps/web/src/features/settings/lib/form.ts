import { currencyMinorUnits, parsePurity, parseRate } from "@mizan/contracts";
import type { ResolverResult } from "react-hook-form";
import type { ApiError } from "@/shared/lib/api";

type PurityValues = { value: string };
export type PurityInput = { value: number };
export type RateValues = {
  purity: string;
  currency: string;
  amountPerGram: string;
};
export type RateInput = NonNullable<ReturnType<typeof parseRate>>;

function parseFineness(raw: string) {
  const text = raw.trim();
  return /^\d{1,3}$/.test(text) ? parsePurity(Number(text)) : null;
}

export function resolvePurityForm({
  value,
}: PurityValues): ResolverResult<PurityValues, PurityInput> {
  const parsed = parseFineness(value);
  return parsed === null
    ? { values: {}, errors: { value: { type: "invalidPurity" } } }
    : { values: { value: parsed }, errors: {} };
}

export function resolveRateForm(
  values: RateValues,
): ResolverResult<RateValues, RateInput> {
  const purity = parseFineness(values.purity);
  if (purity === null)
    return { values: {}, errors: { purity: { type: "invalidPurity" } } };

  const currency = values.currency.trim().toUpperCase();
  try {
    currencyMinorUnits(currency);
  } catch {
    return { values: {}, errors: { currency: { type: "invalidCurrency" } } };
  }

  const rate = parseRate({
    purity,
    currency,
    amountPerGram: values.amountPerGram.trim().replace(",", "."),
  });
  return rate
    ? { values: rate, errors: {} }
    : { values: {}, errors: { amountPerGram: { type: "invalidRate" } } };
}

export function settingsErrorKey(error: ApiError) {
  if (error.status === 403 || error.code === "ACCESS_DENIED")
    return "accessDenied";
  if (error.code === "PURITY_CONFLICT") return "purityConflict";
  if (error.code === "INVALID_SETTINGS") return "invalidSettings";
  if (error.code === "AUTH_UNAVAILABLE") return "authUnavailable";
  if (error.isNetwork) return "networkError";
  return "genericError";
}
