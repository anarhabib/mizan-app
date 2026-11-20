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
