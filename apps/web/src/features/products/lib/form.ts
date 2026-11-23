import {
  parseProductAcquisition,
  parseProductCreate,
  acquisitionComponents,
  type AcquisitionBreakdown,
  type MoneyInput,
  type ProductCreateInput,
  type ProductGemstone,
} from "@mizan/contracts";
import {
  set,
  type FieldErrors,
  type FieldPath,
  type ResolverResult,
} from "react-hook-form";
import type { ApiError } from "@/shared/lib/api";

type GemstoneValues = Omit<ProductGemstone, "stoneCount"> & {
  stoneCount: string;
};

export type ProductFormValues = Omit<
  ProductCreateInput,
  | "purity"
  | "gemstones"
  | "acquisitionCost"
  | "acquisitionBreakdown"
  | "fixedSellingPrice"
> & {
  purity: string;
  gemstones?: GemstoneValues[];
  acquisitionMode?: "PER_GRAM" | "TOTAL";
  acquisitionCostPerGram: MoneyInput;
  acquisitionCost?: MoneyInput;
  acquisitionBreakdown?: AcquisitionBreakdown;
  fixedSellingPrice?: MoneyInput;
};
type ProductField = FieldPath<ProductFormValues>;

const fields = {
  code: "code",
  name: "name",
  category: "category",
  purity: "purity",
  weight: "weight",
  netGoldWeight: "netGoldWeight",
  acquisitionCostPerGram: "acquisitionCostPerGram.amount",
  "acquisitionCostPerGram.amount": "acquisitionCostPerGram.amount",
  "acquisitionCostPerGram.currency": "acquisitionCostPerGram.currency",
  acquisitionCost: "acquisitionCost.amount",
  fixedSellingPrice: "fixedSellingPrice.amount",
  acquisitionBreakdown: "acquisitionBreakdown",
  gemstones: "gemstones",
  note: "note",
} as const satisfies Record<string, ProductField>;

function productField(field: string): ProductField | undefined {
  if (Object.hasOwn(fields, field)) return fields[field as keyof typeof fields];
  if (
    /^(acquisitionCost|fixedSellingPrice)\.(amount|currency)$/.test(field) ||
    /^acquisitionBreakdown\.(metal|gemstones|workmanship|other)$/.test(field) ||
    /^gemstones\.\d+\.(gemstoneType|stoneCount|origin|totalCarats|individualCarats|shape|color|clarity|cutGrade|treatment|laboratory|reportNumber|note)$/.test(
      field,
    )
  )
    return field as ProductField;
}

export function usesTotalAcquisition(
  mode: ProductFormValues["acquisitionMode"],
  hasGemstones: boolean,
) {
  return mode === "TOTAL" || hasGemstones;
}

function normalizeMoney(money: MoneyInput | undefined) {
  return (
    money && {
      amount: money.amount,
      currency: money.currency.trim().toUpperCase(),
    }
  );
}

export function productAcquisitionValues(
  values: Pick<
    ProductFormValues,
    | "weight"
    | "netGoldWeight"
    | "acquisitionCostPerGram"
    | "acquisitionCost"
    | "acquisitionBreakdown"
    | "fixedSellingPrice"
    | "acquisitionMode"
    | "gemstones"
  >,
  acquisitionOnly = false,
) {
  const parts = Object.fromEntries(
    acquisitionComponents.flatMap((key) => {
      const value = values.acquisitionBreakdown?.[key];
      return value ? [[key, value]] : [];
    }),
  );
  return {
    weight: values.weight,
    netGoldWeight: values.netGoldWeight || (acquisitionOnly ? null : undefined),
    fixedSellingPrice: values.fixedSellingPrice?.amount
      ? normalizeMoney(values.fixedSellingPrice)
      : acquisitionOnly
        ? null
        : undefined,
    ...(usesTotalAcquisition(
      values.acquisitionMode,
      Boolean(values.gemstones?.length),
    )
      ? {
          acquisitionCost: normalizeMoney(
            values.acquisitionCost ?? { amount: "", currency: "" },
          ),
          acquisitionBreakdown: Object.keys(parts).length ? parts : undefined,
        }
      : {
          acquisitionCostPerGram: normalizeMoney(values.acquisitionCostPerGram),
        }),
  };
}

export function resolveProductForm(
  values: ProductFormValues,
  acquisitionOnly = false,
): ResolverResult<ProductFormValues, ProductCreateInput> {
  const identity = {
    code: values.code,
    name: values.name,
    category: values.category,
    purity: Number(values.purity),
  };
  const input = {
    ...productAcquisitionValues(values, acquisitionOnly),
    ...identity,
    note: values.note,
    gemstones: values.gemstones?.length
      ? values.gemstones.map((group) => ({
          ...group,
          stoneCount: /^\d+$/.test(group.stoneCount)
            ? Number(group.stoneCount)
            : NaN,
          totalCarats: group.totalCarats || undefined,
          individualCarats: group.individualCarats || undefined,
        }))
      : undefined,
  };
  const parsed = acquisitionOnly
    ? parseProductAcquisition(input)
    : parseProductCreate(input);
  if ("input" in parsed)
    return { values: { ...identity, ...parsed.input }, errors: {} };

  const errors: FieldErrors<ProductFormValues> = {};
  set(errors, productField(parsed.field) ?? parsed.field, { type: "validate" });
  return { values: {}, errors };
}

export function productErrorField(error: ApiError) {
  if (error.code === "PRODUCT_CODE_CONFLICT") return "code";
  if (error.code === "PURITY_CONFLICT") return "purity";
  if (error.code === "INVALID_PRODUCT" && error.field)
    return productField(error.field);
}
