import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import {
  productErrorField,
  resolveProductForm,
  type ProductFormValues,
} from "./form";

const valid: ProductFormValues = {
  code: "  A-001  ",
  name: "Ring",
  category: "Jewelry",
  purity: "585",
  weight: "1.025",
  acquisitionCostPerGram: { amount: "120.05", currency: " eur " },
  note: "",
};

describe("product creation validation", () => {
  it("passes selected purity as an integer and preserves exact decimal strings", () => {
    expect(resolveProductForm(valid)).toEqual({
      errors: {},
      values: {
        code: "A-001",
        name: "Ring",
        category: "Jewelry",
        purity: 585,
        weight: "1.025",
        acquisitionCostPerGram: { amount: "120.05", currency: "EUR" },
      },
    });
  });

  it("maps invalid weight and unselected purity to their form fields", () => {
    expect(resolveProductForm({ ...valid, weight: "1.0001" }).errors).toEqual({
      weight: { type: "validate" },
    });
    expect(resolveProductForm({ ...valid, purity: "" }).errors).toEqual({
      purity: { type: "validate" },
    });
  });

  it("maps a rejected money object to a nested error", () => {
    expect(
      resolveProductForm({
        ...valid,
        acquisitionCostPerGram: {
          amount: "0.10000000000000001",
          currency: "EUR",
        },
      }).errors,
    ).toEqual({ acquisitionCostPerGram: { amount: { type: "validate" } } });
  });

  it("places duplicate codes and recognized server fields inline", () => {
    expect(
      productErrorField(new ApiError(409, "PRODUCT_CODE_CONFLICT", "")),
    ).toBe("code");
    expect(
      productErrorField(
        new ApiError(400, "INVALID_PRODUCT", "", "acquisitionCostPerGram"),
      ),
    ).toBe("acquisitionCostPerGram.amount");
    expect(
      productErrorField(
        new ApiError(
          400,
          "INVALID_PRODUCT",
          "",
          "acquisitionCostPerGram.currency",
        ),
      ),
    ).toBe("acquisitionCostPerGram.currency");
    expect(
      productErrorField(new ApiError(400, "INVALID_PRODUCT", "", "toString")),
    ).toBeUndefined();
    expect(
      productErrorField(new ApiError(500, "INTERNAL_ERROR", "", "weight")),
    ).toBeUndefined();
  });

  it("uses the supplier total for jewelry with stones and maps nested validation", () => {
    const values: ProductFormValues = {
      ...valid,
      acquisitionCost: { amount: "100.125", currency: " azn " },
      acquisitionBreakdown: { metal: "20.125", gemstones: "80", other: "" },
      gemstones: [
        { gemstoneType: "Diamond", stoneCount: "2", totalCarats: "0.50123" },
      ],
    };
    const result = resolveProductForm(values);
    expect(result).toMatchObject({
      errors: {},
      values: {
        acquisitionCost: { amount: "100.125", currency: "AZN" },
        acquisitionBreakdown: { metal: "20.125", gemstones: "80" },
        gemstones: [
          { gemstoneType: "Diamond", stoneCount: 2, totalCarats: "0.50123" },
        ],
      },
    });
    expect(result.values).not.toHaveProperty("acquisitionCostPerGram");
    expect(
      resolveProductForm({
        ...values,
        gemstones: [{ gemstoneType: "Diamond", stoneCount: "1.5" }],
      }).errors,
    ).toEqual({ gemstones: [{ stoneCount: { type: "validate" } }] });
    expect(
      resolveProductForm({ ...values, acquisitionBreakdown: { metal: "1" } })
        .errors,
    ).toEqual({ acquisitionBreakdown: { type: "validate" } });
  });
});
