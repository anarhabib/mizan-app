import {
  parseProductAcquisition,
  parseProductCreate,
  type ProductCreateInput,
} from "@mizan/contracts";
import type { FieldPath, ResolverResult } from "react-hook-form";
import type { ApiError } from "@/shared/lib/api";

export type ProductFormValues = Omit<ProductCreateInput, "purity"> & {
  purity: string;
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
  note: "note",
} as const satisfies Record<string, ProductField>;

export function resolveProductForm(
  values: ProductFormValues,
  acquisitionOnly = false,
): ResolverResult<ProductFormValues, ProductCreateInput> {
  const input = {
    ...values,
    ...(values.netGoldWeight === "" && {
      netGoldWeight: acquisitionOnly ? null : undefined,
    }),
    purity: Number(values.purity),
    acquisitionCostPerGram: {
      amount: values.acquisitionCostPerGram.amount,
      currency: values.acquisitionCostPerGram.currency.trim().toUpperCase(),
    },
  };
  const parsed = acquisitionOnly
    ? parseProductAcquisition(input)
    : parseProductCreate(input);
  if ("input" in parsed)
    return { values: { ...input, ...parsed.input }, errors: {} };

  const error = { type: "validate" };
  return {
    values: {},
    errors:
      parsed.field === "acquisitionCostPerGram"
        ? { acquisitionCostPerGram: { amount: error } }
        : { [parsed.field]: error },
  };
}

export function productErrorField(error: ApiError) {
  if (error.code === "PRODUCT_CODE_CONFLICT") return "code";
  if (
    error.code === "INVALID_PRODUCT" &&
    error.field &&
    Object.hasOwn(fields, error.field)
  ) {
    return fields[error.field as keyof typeof fields];
  }
}
