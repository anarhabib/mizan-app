import { roundMoneyHalfUp } from "@mizan/contracts";
import type { Locale } from "../features/language/messages";

export function money(locale: Locale, amount: string, currency: string) {
  const [whole, fraction] = roundMoneyHalfUp(amount, 2).split(".");
  const localized = new Intl.NumberFormat(locale).format(BigInt(whole));
  const sign = whole === "-0" ? "-" : "";
  const separator = locale === "az" ? "," : ".";
  const unit = locale === "az" && currency === "AZN" ? "₼" : currency;
  return `${sign}${localized}${separator}${fraction} ${unit}`;
}
