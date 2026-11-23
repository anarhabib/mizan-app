import { isBusinessDate } from "@mizan/contracts";
import { AccessError } from "./access.errors.js";

export function businessDateRange(
  date: string | undefined,
  code: "INVALID_PRODUCT" | "INVALID_SALE",
  field: string,
) {
  if (date === undefined) return undefined;
  if (!isBusinessDate(date)) throw new AccessError(code, field);
  const gte = new Date(`${date}T00:00:00+04:00`);
  return { gte, lt: new Date(+gte + 86_400_000) };
}
