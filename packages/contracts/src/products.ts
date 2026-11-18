import { parseDecimal } from "./decimal.js";
import { parseMoney, type MoneyInput } from "./money.js";
import { parsePurity } from "./settings.js";

export type ProductStatus = "IN_STOCK" | "SOLD";

export interface ProductCreateInput {
  code: string;
  name: string;
  category: string;
  purity: number;
  weight: string;
  acquisitionCost: MoneyInput;
  note?: string;
}

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  category: string;
  purity: number;
  weight: string;
  status: ProductStatus;
}

export interface ProductDetail extends ProductListItem {
  acquisitionCost?: MoneyInput;
  note: string | null;
  createdAt: string;
  photo: { url: string; contentType: string; size: number } | null;
  movements: {
    id: string;
    kind: "PRODUCT_ADDED" | "PRODUCT_SOLD" | "OLD_GOLD_RECEIVED";
    actorId: string;
    createdAt: string;
  }[];
  sale: { id: string; total: MoneyInput; createdAt: string } | null;
}

export interface ProductList {
  items: ProductListItem[];
  nextCursor?: string;
}

export interface ProductPhotoUpload {
  uploadId: string;
  uploadUrl: string;
}

export interface ProductPhotoConfirmInput {
  uploadId: string;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.includes("\0")) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

export function parseProductCreate(
  value: unknown,
): { input: ProductCreateInput } | { field: keyof ProductCreateInput } {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const code = cleanText(raw.code, 80);
  if (!code) return { field: "code" };
  const name = cleanText(raw.name, 160);
  if (!name) return { field: "name" };
  const category = cleanText(raw.category, 80);
  if (!category) return { field: "category" };
  const purity = parsePurity(raw.purity);
  if (purity === null) return { field: "purity" };
  const weight = raw.weight;
  try {
    if (
      typeof weight !== "string" ||
      weight.length > 16 ||
      !/[1-9]/.test(parseDecimal(weight, 3)) ||
      weight.split(".")[0].length > 12
    )
      return { field: "weight" };
  } catch {
    return { field: "weight" };
  }

  const cost = raw.acquisitionCost as Partial<MoneyInput> | undefined;
  let acquisitionCost: MoneyInput;
  try {
    if (
      typeof cost?.amount !== "string" ||
      typeof cost.currency !== "string" ||
      cost.amount.length > 21 ||
      cost.amount.split(".")[0].length > 16 ||
      !/[1-9]/.test(parseDecimal(cost.amount, 4))
    )
      return { field: "acquisitionCost" };
    acquisitionCost = parseMoney({
      amount: cost.amount,
      currency: cost.currency,
    });
  } catch {
    return { field: "acquisitionCost" };
  }
  const note =
    raw.note === undefined || raw.note === ""
      ? undefined
      : cleanText(raw.note, 2000);
  if (note === null) return { field: "note" };
  return {
    input: { code, name, category, purity, weight, acquisitionCost, note },
  };
}
