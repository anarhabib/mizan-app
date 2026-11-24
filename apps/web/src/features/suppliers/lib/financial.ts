import { currencyMinorUnits, type MoneyInput } from "@mizan/contracts";
export { submitFinancialAttempt } from "@/shared/lib/financial-attempt";
import { formatDecimal } from "@/shared/lib/format";

export function todayInBaku() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatPayable(
  { amount, currency }: MoneyInput,
  locale: string,
) {
  const [whole, fraction = ""] = amount.split(".");
  const precision = Math.max(2, currencyMinorUnits(currency));
  const digits = fraction.replace(/0+$/, "").padEnd(precision, "0");
  return `${formatDecimal(`${whole}.${digits}`, locale)} ${currency}`;
}
