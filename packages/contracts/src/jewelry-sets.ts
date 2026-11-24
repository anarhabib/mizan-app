import type { MoneyInput } from "./money.js";
import type { ProductDetail, ProductListItem } from "./products.js";

export const jewelrySetLimits = {
  name: 120,
  description: 1000,
  products: 100,
} as const;

export type JewelrySetInput = {
  name: string;
  description?: string;
  productIds: string[];
};

export type JewelrySetAvailability = "available" | "unavailable";

export type JewelrySetProduct = Pick<
  ProductListItem,
  | "id"
  | "code"
  | "name"
  | "category"
  | "productCategory"
  | "purity"
  | "weight"
  | "status"
> &
  Pick<
    ProductDetail,
    | "netGoldWeight"
    | "acquisitionCost"
    | "acquisitionCostPerGram"
    | "acquisitionBreakdown"
  >;

export type JewelrySetTotals = {
  itemCount: number;
  unavailableCount: number;
  grossWeight: string;
  netGoldWeight?: string;
  acquisitionValues?: MoneyInput[];
};

export type JewelrySetSummary = {
  id: string;
  name: string;
  totals: Omit<JewelrySetTotals, "acquisitionValues">;
};

export type JewelrySetPreview = {
  products: JewelrySetProduct[];
  totals: JewelrySetTotals;
};

export type JewelrySetDetail = JewelrySetPreview & {
  id: string;
  name: string;
  description: string | null;
  revision: number;
};

export type JewelrySetList = {
  items: JewelrySetSummary[];
  nextCursor?: string;
};

export function parseJewelrySetInput(
  raw: unknown,
): { input: JewelrySetInput } | { field: keyof JewelrySetInput } {
  const value = raw as Partial<JewelrySetInput> | null | undefined;
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name || name.length > jewelrySetLimits.name || name.includes("\0"))
    return { field: "name" };
  const description = value?.description;
  if (
    description !== undefined &&
    (typeof description !== "string" ||
      description.length > jewelrySetLimits.description ||
      description.includes("\0"))
  )
    return { field: "description" };
  const productIds = parseJewelrySetProductIds(value?.productIds);
  if (!productIds) return { field: "productIds" };
  return { input: { name, description: description?.trim(), productIds } };
}

export function parseJewelrySetProductIds(raw: unknown): string[] | undefined {
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > jewelrySetLimits.products ||
    !raw.every(
      (id) =>
        typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    )
  )
    return undefined;
  const ids = raw.map((id: string) => id.toLowerCase());
  return new Set(ids).size === ids.length ? ids : undefined;
}
