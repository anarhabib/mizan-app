import {
  parseProductCreate,
  type ProductCreateInput,
  type ProductRegistrationSource,
} from "./products.js";
import { categoryIdPattern } from "./product-categories.js";
import {
  maxPurchaseItems,
  parsePurchaseInput,
  parseSupplierPayment,
  type PurchaseInput,
  type SupplierPaymentInput,
} from "./suppliers.js";
import type { MoneyInput } from "./money.js";

type PurchaseMetadata = Omit<PurchaseInput, "items">;
type InitialPayment = Pick<
  SupplierPaymentInput,
  "amount" | "currency" | "method"
>;
type UnfinancedSource = Exclude<ProductRegistrationSource, "SUPPLIER_PURCHASE">;

export type ProductRegistrationInput = { products: ProductCreateInput[] } & (
  | { source: UnfinancedSource; historicalSupplierId?: string }
  | {
      source: "SUPPLIER_PURCHASE";
      purchase: PurchaseMetadata;
      initialPayment?: InitialPayment;
    }
);

export interface ProductRegistrationReceipt {
  productIds: string[];
  purchaseId?: string;
}

export type RegistrationProduct = {
  product: ProductCreateInput;
  total: MoneyInput;
};

type ParsedRegistration = { products: RegistrationProduct[] } & (
  | { source: UnfinancedSource; historicalSupplierId?: string }
  | {
      source: "SUPPLIER_PURCHASE";
      purchase: PurchaseMetadata;
      initialPayment?: SupplierPaymentInput;
    }
);

export function parseProductRegistration(
  value: unknown,
): { input: ParsedRegistration } | { field: string } {
  const raw = value as {
    source?: unknown;
    products?: unknown;
    historicalSupplierId?: unknown;
    purchase?: Partial<PurchaseMetadata>;
    initialPayment?: Partial<InitialPayment>;
  } | null;
  if (!raw || typeof raw !== "object") return { field: "source" };
  const source = raw?.source;
  if (
    source !== "OPENING_STOCK" &&
    source !== "OTHER" &&
    source !== "SUPPLIER_PURCHASE"
  )
    return { field: "source" };
  if (
    !Array.isArray(raw.products) ||
    !raw.products.length ||
    raw.products.length > maxPurchaseItems
  )
    return { field: "products" };

  if (source !== "SUPPLIER_PURCHASE") {
    if ("purchase" in raw || "initialPayment" in raw)
      return { field: "source" };
    const id = raw.historicalSupplierId;
    if (
      id !== undefined &&
      (typeof id !== "string" || !categoryIdPattern.test(id))
    )
      return { field: "historicalSupplierId" };
    const products: RegistrationProduct[] = [];
    const codes = new Set<string>();
    for (const [index, product] of raw.products.entries()) {
      const parsed = parseProductCreate(product);
      if ("field" in parsed)
        return { field: `products.${index}.${parsed.field}` };
      if (!parsed.input.categoryId)
        return { field: `products.${index}.categoryId` };
      if (codes.has(parsed.input.code))
        return { field: `products.${index}.code` };
      codes.add(parsed.input.code);
      products.push({ product: parsed.input, total: parsed.total });
    }
    return {
      input: { source, products, historicalSupplierId: id?.toLowerCase() },
    };
  }

  if ("historicalSupplierId" in raw) return { field: "historicalSupplierId" };
  const purchase = parsePurchaseInput({
    ...raw.purchase,
    items: raw.products.map((product) => ({ product })),
  });
  if ("field" in purchase) {
    const field = purchase.field.startsWith("items.")
      ? purchase.field.replace(/^items\./, "products.")
      : `purchase.${purchase.field}`;
    return { field };
  }
  const { items, ...metadata } = purchase.input;
  const products: RegistrationProduct[] = [];
  for (const [index, item] of items.entries()) {
    if (!("product" in item) || !item.product.categoryId)
      return { field: `products.${index}.categoryId` };
    products.push(item);
  }
  let initialPayment: SupplierPaymentInput | undefined;
  if (raw.initialPayment !== undefined) {
    const payment = parseSupplierPayment({
      amount: raw.initialPayment?.amount,
      method: raw.initialPayment?.method,
      currency: raw.initialPayment?.currency,
      paymentDate: metadata.purchaseDate,
    });
    if ("field" in payment) return { field: `initialPayment.${payment.field}` };
    if (payment.input.currency !== metadata.currency)
      return { field: "initialPayment.currency" };
    initialPayment = payment.input;
  }
  return { input: { source, products, purchase: metadata, initialPayment } };
}
