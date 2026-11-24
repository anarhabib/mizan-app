import { isBusinessDate } from "./dashboard.js";
import { parseDecimal } from "./decimal.js";
import { currencyMinorUnits, type MoneyInput } from "./money.js";
import { categoryIdPattern } from "./product-categories.js";
import {
  parseProductCreate,
  type ProductCreateInput,
  type ProductDetail,
  type ProductListItem,
} from "./products.js";
import { salePaymentMethods } from "./sales.js";

export interface SupplierContactInput {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxId?: string | null;
  note?: string | null;
}

export type SupplierInput = SupplierContactInput & { isActive?: boolean };

export interface SupplierOption {
  id: string;
  name: string;
}

export interface Supplier extends SupplierContactInput, SupplierOption {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOverview {
  supplier: Supplier;
  balances: {
    currency: string;
    purchased: MoneyInput;
    paid: MoneyInput;
    outstanding: MoneyInput;
  }[];
  purchaseCount: number;
  productCount: number;
  lastPurchaseDate: string | null;
  lastPaymentDate: string | null;
}

export interface SupplierPage<T> {
  items: T[];
  nextCursor?: string;
}

export const maxPurchaseItems = 100;
export const purchasePaymentStatuses = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
] as const;
export type PurchasePaymentStatus = (typeof purchasePaymentStatuses)[number];
export const supplierPaymentMethods = salePaymentMethods;
export type SupplierPaymentMethod = (typeof supplierPaymentMethods)[number];

export type PurchaseItemInput =
  { productId: string } | { product: ProductCreateInput };

export interface PurchaseInput {
  supplierId: string;
  documentNumber?: string | null;
  purchaseDate: string;
  currency: string;
  note?: string | null;
  items: PurchaseItemInput[];
}

export interface PurchaseReceipt {
  id: string;
  supplierId: string;
  productIds: string[];
}

export interface PurchaseSummary {
  id: string;
  supplier: SupplierOption;
  documentNumber: string | null;
  purchaseDate: string;
  productCount: number;
  total: MoneyInput;
  paid: MoneyInput;
  outstanding: MoneyInput;
  status: PurchasePaymentStatus;
}

export type ReceivedProduct = ProductListItem & {
  acquisitionCost: MoneyInput;
  purchaseDate: string;
};

export type PurchaseProduct = ReceivedProduct &
  Pick<
    ProductDetail,
    | "metalType"
    | "netGoldWeight"
    | "gemstones"
    | "acquisitionCostPerGram"
    | "acquisitionBreakdown"
  >;

export interface PurchaseDetail extends PurchaseSummary {
  note: string | null;
  createdAt: string;
  actorName: string | null;
  products: PurchaseProduct[];
}

export interface SupplierPaymentInput extends MoneyInput {
  method: SupplierPaymentMethod;
  paymentDate: string;
  referenceNumber?: string | null;
  note?: string | null;
}

export interface SupplierPayment extends SupplierPaymentInput {
  id: string;
  purchaseId: string;
  documentNumber: string | null;
  purchaseDate: string;
  actorName: string | null;
  createdAt: string;
}

export interface SupplierActivity {
  id: string;
  kind:
    | "CREATED"
    | "UPDATED"
    | "DEACTIVATED"
    | "REACTIVATED"
    | "PURCHASE_REGISTERED"
    | "PRODUCTS_RECEIVED"
    | "PAYMENT_RECORDED"
    | "PARTIALLY_PAID"
    | "PAID";
  purchaseId: string | null;
  productCount: number | null;
  actorName: string | null;
  createdAt: string;
}

function optionalText(value: unknown, max: number, multiline = false) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string" || value.length > max) return false;
  const text = value.trim();
  if (/\p{Cc}/u.test(multiline ? text.replace(/[\t\r\n]/g, "") : text))
    return false;
  return text || null;
}

export function isSupplierCurrency(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    currencyMinorUnits(value);
    return true;
  } catch {
    return false;
  }
}

export function isSupplierDate(value: unknown): value is string {
  return isBusinessDate(value) && !value.startsWith("0000");
}

export function parseSupplierInput(
  value: unknown,
  editing = false,
): { input: Partial<SupplierInput> } | { field: keyof SupplierInput } {
  const raw = value as Partial<SupplierInput> | null;
  const input: Partial<SupplierInput> = {};
  if (!editing || raw?.name !== undefined) {
    const name = optionalText(raw?.name, 120);
    if (!name) return { field: "name" };
    input.name = name;
  }
  for (const [field, max] of [
    ["contactPerson", 120],
    ["phone", 40],
    ["email", 254],
    ["address", 500],
    ["taxId", 40],
    ["note", 1000],
  ] as const) {
    const text = optionalText(
      raw?.[field],
      max,
      field === "note" || field === "address",
    );
    if (text === false) return { field };
    if (
      field === "phone" &&
      text &&
      (!/^\+?[0-9 ()-]+$/.test(text) ||
        !/^\d{3,15}$/.test(text.replace(/\D/g, "")))
    )
      return { field };
    if (field === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text))
      return { field };
    if (text !== undefined) input[field] = text;
  }
  if (raw?.isActive !== undefined) {
    if (typeof raw.isActive !== "boolean") return { field: "isActive" };
    input.isActive = raw.isActive;
  }
  if (!Object.keys(input).length) return { field: "name" };
  return { input };
}

export type ParsedPurchase = Omit<PurchaseInput, "items"> & {
  items: (
    { productId: string } | { product: ProductCreateInput; total: MoneyInput }
  )[];
};

export function parsePurchaseInput(
  value: unknown,
): { input: ParsedPurchase } | { field: string } {
  const raw = value as Partial<PurchaseInput> | null;
  if (
    typeof raw?.supplierId !== "string" ||
    !categoryIdPattern.test(raw.supplierId)
  )
    return { field: "supplierId" };
  if (!isSupplierDate(raw.purchaseDate)) return { field: "purchaseDate" };
  if (!isSupplierCurrency(raw.currency)) return { field: "currency" };
  const documentNumber = optionalText(raw.documentNumber, 120);
  if (documentNumber === false) return { field: "documentNumber" };
  const note = optionalText(raw.note, 1000, true);
  if (note === false) return { field: "note" };
  if (
    !Array.isArray(raw.items) ||
    !raw.items.length ||
    raw.items.length > maxPurchaseItems
  )
    return { field: "items" };

  const items: ParsedPurchase["items"] = [];
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const [index, item] of raw.items.entries()) {
    if (!item || typeof item !== "object") return { field: `items.${index}` };
    if ("productId" in item) {
      if (
        "product" in item ||
        typeof item.productId !== "string" ||
        !categoryIdPattern.test(item.productId)
      )
        return { field: `items.${index}` };
      const productId = item.productId.toLowerCase();
      if (ids.has(productId)) return { field: `items.${index}` };
      ids.add(productId);
      items.push({ productId });
    } else {
      const parsed = parseProductCreate(item.product);
      if ("field" in parsed) return { field: `items.${index}.${parsed.field}` };
      if (parsed.total.currency !== raw.currency)
        return { field: `items.${index}.currency` };
      if (codes.has(parsed.input.code)) return { field: `items.${index}.code` };
      codes.add(parsed.input.code);
      items.push({ product: parsed.input, total: parsed.total });
    }
  }
  return {
    input: {
      supplierId: raw.supplierId.toLowerCase(),
      purchaseDate: raw.purchaseDate,
      currency: raw.currency,
      documentNumber,
      note,
      items,
    },
  };
}

export function parseSupplierPayment(
  value: unknown,
): { input: SupplierPaymentInput } | { field: keyof SupplierPaymentInput } {
  const raw = value as Partial<SupplierPaymentInput> | null;
  if (!isSupplierCurrency(raw?.currency)) return { field: "currency" };
  if (!isSupplierDate(raw?.paymentDate)) return { field: "paymentDate" };
  if (!raw?.method || !supplierPaymentMethods.includes(raw.method))
    return { field: "method" };
  const amount = raw.amount;
  if (
    typeof amount !== "string" ||
    amount.length > 25 ||
    amount.split(".")[0].length > 20
  )
    return { field: "amount" };
  try {
    // Purchase costs retain four places, including per-gram calculation results.
    // A full payment must be able to settle that exact amount.
    parseDecimal(amount, 4);
    if (!/[1-9]/.test(amount)) return { field: "amount" };
  } catch {
    return { field: "amount" };
  }
  const referenceNumber = optionalText(raw.referenceNumber, 120);
  if (referenceNumber === false) return { field: "referenceNumber" };
  const note = optionalText(raw.note, 1000, true);
  if (note === false) return { field: "note" };
  return {
    input: {
      amount,
      currency: raw.currency,
      paymentDate: raw.paymentDate,
      method: raw.method,
      referenceNumber,
      note,
    },
  };
}
