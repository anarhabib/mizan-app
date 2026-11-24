import {
  currencyMinorUnits,
  parseDecimal,
  roundMoneyHalfUp,
  type MoneyInput,
} from "@mizan/contracts";

export function formatDecimal(value: string, locale: string) {
  const negative = value.startsWith("-");
  const magnitude = negative ? value.slice(1) : value;
  const [integer, fraction] = magnitude.split(".");
  const english = locale.startsWith("en");
  const russian = locale.startsWith("ru");
  const separator = english ? "," : russian ? "\u202f" : ".";
  const point = english ? "." : ",";
  const whole = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return `${negative ? "-" : ""}${whole}${fraction ? point + fraction : ""}`;
}

export function formatMoney(money: MoneyInput, locale = "az", exact = false) {
  const minorUnits = currencyMinorUnits(money.currency);
  const scale = exact
    ? Math.max(minorUnits, money.amount.split(".")[1]?.length ?? 0)
    : 2;
  return `${formatDecimal(roundMoneyHalfUp(money.amount, scale), locale)} ${money.currency}`;
}
export function formatWeight(value: string, locale = "az") {
  parseDecimal(value.startsWith("-") ? value.slice(1) : value, 3);
  return `${formatDecimal(value, locale)} ${locale.startsWith("ru") ? "г" : "g"}`;
}
export function formatPurity(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 999)
    throw new RangeError("Invalid purity");
  return String(value);
}

export function formatDateTime(value: string, locale = "az") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (locale === "az" || locale.startsWith("az-")) {
    // Some browser locale data uses month labels such as M11 for Azerbaijani.
    const twoDigits = (part: number) => String(part).padStart(2, "0");
    const day = twoDigits(date.getDate());
    const month = twoDigits(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = twoDigits(date.getHours());
    const minutes = twoDigits(date.getMinutes());
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(date);
}
