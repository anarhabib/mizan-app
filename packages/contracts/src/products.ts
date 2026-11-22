import { parseDecimal, roundMoneyHalfUp } from "./decimal.js";
import { currencyMinorUnits, type MoneyInput } from "./money.js";
import { parsePurity } from "./settings.js";

export type ProductStatus = "IN_STOCK" | "SOLD";

export interface ProductAcquisitionInput {
  weight: string;
  netGoldWeight?: string | null;
  acquisitionCostPerGram: MoneyInput;
}

export interface ProductCreateInput extends ProductAcquisitionInput {
  code: string;
  name: string;
  category: string;
  purity: number;
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
  hasOutstandingDebt?: boolean;
}

export interface ProductDetail extends ProductListItem {
  netGoldWeight?: string;
  estimatedMaterialValue?: MoneyInput;
  estimatedSellingValue?: MoneyInput;
  acquisitionCost?: MoneyInput;
  acquisitionCostPerGram?: MoneyInput;
  canEditAcquisition?: boolean;
  canDelete?: boolean;
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
  filters?: { categories: string[]; purities: number[] };
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
):
  | { input: ProductCreateInput; total: MoneyInput }
  | { field: keyof ProductCreateInput } {
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
  const acquisition = parseProductAcquisition(raw);
  if ("field" in acquisition) return acquisition;
  const note =
    raw.note === undefined || raw.note === ""
      ? undefined
      : cleanText(raw.note, 2000);
  if (note === null) return { field: "note" };
  return {
    input: { ...acquisition.input, code, name, category, purity, note },
    total: acquisition.total,
  };
}

const weightScale = 3;
const rateScale = 16;
const totalScale = 4;
const productScale = weightScale + rateScale;

function isPositiveDecimal(
  value: unknown,
  digits: number,
  scale: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= digits + scale + 1 &&
    value.split(".")[0].length <= digits &&
    /[1-9]/.test(parseDecimal(value, scale))
  );
}

export function parseProductAcquisition(
  value: unknown,
):
  | { input: ProductAcquisitionInput; total: MoneyInput }
  | { field: keyof ProductAcquisitionInput } {
  const raw = value as Partial<ProductAcquisitionInput> | undefined;
  const weight = raw?.weight;
  try {
    if (!isPositiveDecimal(weight, 12, weightScale)) return { field: "weight" };
  } catch {
    return { field: "weight" };
  }

  const rate = raw?.acquisitionCostPerGram;
  const netGoldWeight = raw?.netGoldWeight;
  if (netGoldWeight != null) {
    try {
      if (
        !isPositiveDecimal(netGoldWeight, 12, weightScale) ||
        BigInt(roundMoneyHalfUp(netGoldWeight, weightScale).replace(".", "")) >
          BigInt(roundMoneyHalfUp(weight, weightScale).replace(".", ""))
      )
        return { field: "netGoldWeight" };
    } catch {
      return { field: "netGoldWeight" };
    }
  }
  try {
    if (
      !isPositiveDecimal(rate?.amount, 19, rateScale) ||
      typeof rate.currency !== "string"
    )
      return { field: "acquisitionCostPerGram" };
    currencyMinorUnits(rate.currency);
    const grams = BigInt(
      roundMoneyHalfUp(weight, weightScale).replace(".", ""),
    );
    const perGram = BigInt(
      roundMoneyHalfUp(rate.amount, rateScale).replace(".", ""),
    );
    const digits = (grams * perGram).toString().padStart(productScale + 1, "0");
    const amount = roundMoneyHalfUp(
      digits.slice(0, -productScale) + "." + digits.slice(-productScale),
      totalScale,
    );
    if (!isPositiveDecimal(amount, 16, totalScale))
      return { field: "acquisitionCostPerGram" };
    return {
      input: {
        weight,
        ...(netGoldWeight !== undefined && { netGoldWeight }),
        acquisitionCostPerGram: {
          amount: rate.amount,
          currency: rate.currency,
        },
      },
      total: { amount, currency: rate.currency },
    };
  } catch {
    return { field: "acquisitionCostPerGram" };
  }
}
