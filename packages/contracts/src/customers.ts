import type { MoneyInput } from "./money.js";
import type { SaleReturnStatus } from "./sale-returns.js";

export interface CustomerInput {
  name: string;
  phone: string;
  note?: string | null;
}

export const maxCustomerNoteLength = 1000;

export interface CustomerContact extends Pick<CustomerInput, "name" | "phone"> {
  id: string;
}

export interface CustomerSummary extends CustomerContact {
  totalPurchases: MoneyInput;
  netPurchases?: MoneyInput;
  outstandingDebt: MoneyInput;
  lastPurchaseAt: string | null;
}

export interface CustomerDetail extends CustomerSummary {
  note: string | null;
}

export interface CustomerList {
  items: CustomerSummary[];
  nextCursor?: string;
}

export interface CustomerPurchase {
  id: string;
  createdAt: string;
  productName: string;
  itemCount: number;
  total: MoneyInput;
  tradeInCredit: MoneyInput;
  paidAmount: MoneyInput;
  outstandingDebt: MoneyInput;
  payment: MoneyInput | null;
  returnStatus?: SaleReturnStatus;
  returnedValue?: MoneyInput;
  netTotal?: MoneyInput;
  netPaidAmount?: MoneyInput;
}

export interface CustomerHistory {
  items: CustomerPurchase[];
  nextCursor?: string;
}

export function parseCustomerInput(
  value: unknown,
): { input: CustomerInput } | { field: keyof CustomerInput } {
  const fields = value as Partial<CustomerInput> | null | undefined;
  const name = typeof fields?.name === "string" ? fields.name.trim() : "";
  if (!name || name.length > 120 || /\p{Cc}/u.test(name))
    return { field: "name" };
  const phone = typeof fields?.phone === "string" ? fields.phone.trim() : "";
  if (
    phone.length > 40 ||
    !/^\+?[0-9 ()-]+$/.test(phone) ||
    !/^\d{3,15}$/.test(phone.replace(/\D/g, ""))
  )
    return { field: "phone" };
  const note = fields?.note;
  if (note === undefined) return { input: { name, phone } };
  if (
    note !== null &&
    (typeof note !== "string" ||
      note.length > maxCustomerNoteLength ||
      note.includes("\0"))
  )
    return { field: "note" };
  return { input: { name, phone, note: note?.trim() || null } };
}
