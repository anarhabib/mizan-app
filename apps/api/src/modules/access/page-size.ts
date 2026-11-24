import { parseTablePageSize } from "@mizan/contracts";
import { AccessError } from "./access.errors.js";

export function readPageSize(
  value: unknown,
  code:
    | "INVALID_PRODUCT"
    | "INVALID_JEWELRY_SET"
    | "INVALID_SALE"
    | "INVALID_CUSTOMER"
    | "INVALID_SUPPLIER"
    | "INVALID_MEMBERSHIP"
    | "INVALID_SETTINGS",
  field = "limit",
) {
  if (value === undefined) return 50;
  const size = parseTablePageSize(value);
  if (size === undefined) throw new AccessError(code, field);
  return size;
}
