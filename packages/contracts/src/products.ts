import { parseDecimal, roundMoneyHalfUp } from "./decimal.js";
import { currencyMinorUnits, type MoneyInput } from "./money.js";
import { parsePurity } from "./settings.js";
import {
  categoryIdPattern,
  parseCategoryName,
  type ProductCategory,
} from "./product-categories.js";

export type ProductStatus = "IN_STOCK" | "SOLD";
export type ProductMetal = "GOLD";
export type ProductGemstoneFilter = "recorded" | "none";

export const gemstoneOrigins = [
  "NATURAL",
  "LAB_GROWN",
  "SIMULATED",
  "UNKNOWN",
] as const;
export const maxGemstoneGroups = 50;

export interface ProductGemstone {
  gemstoneType: string;
  stoneCount: number;
  origin?: (typeof gemstoneOrigins)[number];
  totalCarats?: string;
  individualCarats?: string;
  shape?: string;
  color?: string;
  clarity?: string;
  cutGrade?: string;
  treatment?: string;
  laboratory?: string;
  reportNumber?: string;
  note?: string;
}

export const acquisitionComponents = [
  "metal",
  "gemstones",
  "workmanship",
  "other",
] as const;
export type AcquisitionBreakdown = Partial<
  Record<(typeof acquisitionComponents)[number], string>
>;

export type ProductAcquisitionInput = {
  weight: string;
  netGoldWeight?: string | null;
  fixedSellingPrice?: MoneyInput | null;
} & (
  | {
      acquisitionCostPerGram: MoneyInput;
      acquisitionCost?: never;
      acquisitionBreakdown?: never;
    }
  | {
      acquisitionCost: MoneyInput;
      acquisitionBreakdown?: AcquisitionBreakdown;
      acquisitionCostPerGram?: never;
    }
);

export type ProductCreateInput = ProductAcquisitionInput & {
  code: string;
  name: string;
  category?: string;
  categoryId?: string;
  purity: number;
  metalType?: ProductMetal;
  gemstones?: ProductGemstone[];
  note?: string;
};

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  category: string;
  productCategory?: ProductCategory;
  purity: number;
  weight: string;
  status: ProductStatus;
  hasOutstandingDebt?: boolean;
  thumbnailUrl?: string;
}

export interface ProductDetail extends ProductListItem {
  metalType?: ProductMetal;
  netGoldWeight?: string;
  fineGoldWeight?: string;
  gemstones?: ProductGemstone[];
  fixedSellingPrice?: MoneyInput;
  estimatedMaterialValue?: MoneyInput;
  estimatedSellingValue?: MoneyInput;
  estimatedMetalSellingValue?: MoneyInput;
  acquisitionCost?: MoneyInput;
  acquisitionCostPerGram?: MoneyInput;
  acquisitionBreakdown?: AcquisitionBreakdown;
  canEditAcquisition?: boolean;
  canDelete?: boolean;
  note: string | null;
  createdAt: string;
  photo: { url: string; contentType: string; size: number } | null;
  movements: {
    id: string;
    kind: "PRODUCT_ADDED" | "PRODUCT_SOLD" | "OLD_GOLD_RECEIVED";
    actorId: string;
    actorName?: string | null;
    createdAt: string;
  }[];
  sale: { id: string; total: MoneyInput; createdAt: string } | null;
}

export interface ProductOverview {
  available: number;
  sold: number;
  soldOnCredit: number;
  availableWeight: string;
  acquisitionValue?: MoneyInput[];
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

type ProductField =
  | keyof ProductCreateInput
  | `gemstones.${number}.${keyof ProductGemstone}`
  | `acquisitionBreakdown.${keyof AcquisitionBreakdown}`;

const gemstoneText = {
  shape: 80,
  color: 80,
  clarity: 80,
  cutGrade: 80,
  treatment: 160,
  laboratory: 80,
  reportNumber: 80,
  note: 2000,
} as const;

function parseGemstone(
  value: unknown,
  index: number,
): { gemstone: ProductGemstone } | { field: ProductField } {
  const raw = value as Partial<ProductGemstone> | null;
  const gemstoneType = cleanText(raw?.gemstoneType, 80);
  if (!gemstoneType)
    return { field: `gemstones.${index}.gemstoneType` as const };
  const stoneCount = raw?.stoneCount;
  if (
    typeof stoneCount !== "number" ||
    !Number.isInteger(stoneCount) ||
    stoneCount < 1 ||
    stoneCount > 2147483647
  )
    return { field: `gemstones.${index}.stoneCount` as const };
  const origin = raw?.origin === undefined ? "UNKNOWN" : raw.origin;
  if (!gemstoneOrigins.includes(origin))
    return { field: `gemstones.${index}.origin` as const };
  const gemstone: ProductGemstone = { gemstoneType, stoneCount, origin };
  for (const key of ["totalCarats", "individualCarats"] as const) {
    const amount = raw?.[key];
    if (amount === undefined) continue;
    if (!isPositiveDecimal(amount, 10, 5))
      return { field: `gemstones.${index}.${key}` as const };
    gemstone[key] = amount;
  }
  if (
    gemstone.totalCarats &&
    gemstone.individualCarats &&
    decimalUnits(gemstone.individualCarats, 5) >
      decimalUnits(gemstone.totalCarats, 5)
  )
    return { field: `gemstones.${index}.individualCarats` as const };
  for (const key of Object.keys(
    gemstoneText,
  ) as (keyof typeof gemstoneText)[]) {
    const value = raw?.[key];
    if (value === undefined || value === "") continue;
    const cleaned = cleanText(value, gemstoneText[key]);
    if (!cleaned) return { field: `gemstones.${index}.${key}` as const };
    gemstone[key] = cleaned;
  }
  return { gemstone };
}

export function parseProductCreate(
  value: unknown,
): { input: ProductCreateInput; total: MoneyInput } | { field: ProductField } {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const code = cleanText(raw.code, 80);
  if (!code) return { field: "code" };
  const name = cleanText(raw.name, 160);
  if (!name) return { field: "name" };
  const categoryId = raw.categoryId;
  const category = parseCategoryName(raw.category);
  if (categoryId !== undefined) {
    if (
      typeof categoryId !== "string" ||
      !categoryIdPattern.test(categoryId) ||
      raw.category !== undefined
    )
      return { field: "categoryId" };
  } else if (!category) return { field: "categoryId" };
  const purity = parsePurity(raw.purity);
  if (purity === null) return { field: "purity" };
  if (raw.metalType !== undefined && raw.metalType !== "GOLD")
    return { field: "metalType" };
  const acquisition = parseProductAcquisition(raw);
  if ("field" in acquisition) return acquisition;
  const gemstones: ProductGemstone[] = [];
  if (raw.gemstones !== undefined) {
    if (
      !Array.isArray(raw.gemstones) ||
      raw.gemstones.length > maxGemstoneGroups
    )
      return { field: "gemstones" };
    for (const [index, value] of raw.gemstones.entries()) {
      const group = parseGemstone(value, index);
      if ("field" in group) return { field: group.field };
      gemstones.push(group.gemstone);
    }
    if (gemstones.length && !acquisition.input.acquisitionCost)
      return { field: "acquisitionCost" };
  }
  const note =
    raw.note === undefined || raw.note === ""
      ? undefined
      : cleanText(raw.note, 2000);
  if (note === null) return { field: "note" };
  return {
    input: {
      ...acquisition.input,
      code,
      name,
      ...(categoryId !== undefined ? { categoryId } : { category: category! }),
      purity,
      note,
      ...(raw.metalType && { metalType: raw.metalType }),
      ...(raw.gemstones !== undefined && { gemstones }),
    },
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
  return isDecimal(value, digits, scale) && /[1-9]/.test(value);
}

function isDecimal(
  value: unknown,
  digits: number,
  scale: number,
): value is string {
  if (
    typeof value !== "string" ||
    value.length > digits + scale + 1 ||
    value.split(".")[0].length > digits
  )
    return false;
  try {
    return parseDecimal(value, scale) === value;
  } catch {
    return false;
  }
}

function decimalUnits(value: string, scale: number) {
  return BigInt(roundMoneyHalfUp(value, scale).replace(".", ""));
}

function readMoney(
  value: unknown,
  digits: number,
  scale: number,
  settlement = false,
) {
  const money = value as Partial<MoneyInput> | null;
  if (typeof money?.currency !== "string") return;
  try {
    const minorUnits = currencyMinorUnits(money.currency);
    if (
      isPositiveDecimal(
        money.amount,
        digits,
        settlement ? Math.min(scale, minorUnits) : scale,
      )
    )
      return { amount: money.amount, currency: money.currency };
  } catch {
    return;
  }
}

export function parseProductAcquisition(value: unknown):
  | { input: ProductAcquisitionInput; total: MoneyInput }
  | {
      field:
        | keyof ProductAcquisitionInput
        | `acquisitionBreakdown.${keyof AcquisitionBreakdown}`;
    } {
  const raw = value as Partial<ProductAcquisitionInput> | undefined;
  const weight = raw?.weight;
  if (!isPositiveDecimal(weight, 12, weightScale)) return { field: "weight" };
  const netGoldWeight = raw?.netGoldWeight;
  if (
    netGoldWeight != null &&
    (!isPositiveDecimal(netGoldWeight, 12, weightScale) ||
      decimalUnits(netGoldWeight, weightScale) >
        decimalUnits(weight, weightScale))
  )
    return { field: "netGoldWeight" };
  const fixedSellingPrice =
    raw?.fixedSellingPrice == null
      ? raw?.fixedSellingPrice
      : readMoney(raw.fixedSellingPrice, 16, totalScale, true);
  if (raw?.fixedSellingPrice != null && !fixedSellingPrice)
    return { field: "fixedSellingPrice" };
  const weightsAndPrice = {
    weight,
    ...(netGoldWeight !== undefined && { netGoldWeight }),
    ...(fixedSellingPrice !== undefined && { fixedSellingPrice }),
  };
  if (raw?.acquisitionCost !== undefined) {
    const total = readMoney(raw.acquisitionCost, 16, totalScale);
    if (!total || raw.acquisitionCostPerGram !== undefined)
      return { field: "acquisitionCost" };
    const breakdown = raw.acquisitionBreakdown;
    if (breakdown === undefined)
      return { input: { ...weightsAndPrice, acquisitionCost: total }, total };
    if (
      !breakdown ||
      typeof breakdown !== "object" ||
      Array.isArray(breakdown) ||
      Object.keys(breakdown).some(
        (key) => !acquisitionComponents.some((part) => part === key),
      )
    )
      return { field: "acquisitionBreakdown" };
    const acquisitionBreakdown: AcquisitionBreakdown = {};
    let sum = 0n;
    for (const part of acquisitionComponents) {
      const amount = breakdown[part];
      if (amount === undefined) continue;
      if (!isDecimal(amount, 16, totalScale))
        return { field: `acquisitionBreakdown.${part}` };
      acquisitionBreakdown[part] = amount;
      sum += decimalUnits(amount, totalScale);
    }
    if (sum !== decimalUnits(total.amount, totalScale))
      return { field: "acquisitionBreakdown" };
    return {
      input: {
        ...weightsAndPrice,
        acquisitionCost: total,
        acquisitionBreakdown,
      },
      total,
    };
  }
  if (raw?.acquisitionBreakdown !== undefined)
    return { field: "acquisitionBreakdown" };
  const rate = readMoney(raw?.acquisitionCostPerGram, 19, rateScale);
  if (!rate) return { field: "acquisitionCostPerGram" };
  const grams = decimalUnits(weight, weightScale);
  const perGram = decimalUnits(rate.amount, rateScale);
  const digits = (grams * perGram).toString().padStart(productScale + 1, "0");
  const amount = roundMoneyHalfUp(
    digits.slice(0, -productScale) + "." + digits.slice(-productScale),
    totalScale,
  );
  if (!isPositiveDecimal(amount, 16, totalScale))
    return { field: "acquisitionCostPerGram" };
  return {
    input: { ...weightsAndPrice, acquisitionCostPerGram: rate },
    total: { amount, currency: rate.currency },
  };
}
