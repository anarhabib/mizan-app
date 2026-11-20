import { parseProductCreate, type ProductCreateInput } from "@mizan/contracts";
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
  acquisitionCost: "acquisitionCost.amount",
  "acquisitionCost.amount": "acquisitionCost.amount",
  "acquisitionCost.currency": "acquisitionCost.currency",
  note: "note",
} as const satisfies Record<string, ProductField>;

export function resolveProductForm(
  values: ProductFormValues,
): ResolverResult<ProductFormValues, ProductCreateInput> {
  const parsed = parseProductCreate({
    ...values,
    purity: values.purity ? Number(values.purity) : undefined,
    acquisitionCost: {
      amount: values.acquisitionCost.amount,
      currency: values.acquisitionCost.currency.trim().toUpperCase(),
    },
  });
  if ("input" in parsed) return { values: parsed.input, errors: {} };

  const error = { type: "validate" };
  return {
    values: {},
    errors:
      parsed.field === "acquisitionCost"
        ? { acquisitionCost: { amount: error } }
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
