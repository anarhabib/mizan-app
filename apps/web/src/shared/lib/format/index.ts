import {
  currencyMinorUnits,
  parseDecimal,
  type MoneyInput,
} from "@mizan/contracts";

function decimal(value: string, minimum = 0, locale = "az") {
  const negative = value.startsWith("-");
  const magnitude = negative ? value.slice(1) : value;
  const fraction = magnitude.split(".")[1] ?? "";
  parseDecimal(magnitude, fraction.length);
  const separator = locale === "en" ? "," : ".";
  const point = locale === "en" ? "." : ",";
  const whole = magnitude
    .split(".")[0]
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const digits = fraction.padEnd(minimum, "0");
  return `${negative ? "-" : ""}${whole}${digits ? point + digits : ""}`;
}

export function formatMoney(money: MoneyInput, locale = "az") {
  return `${decimal(money.amount, currencyMinorUnits(money.currency), locale)} ${money.currency}`;
}
export function formatWeight(value: string, locale = "az") {
  parseDecimal(value.startsWith("-") ? value.slice(1) : value, 3);
  return `${decimal(value, 0, locale)} g`;
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
