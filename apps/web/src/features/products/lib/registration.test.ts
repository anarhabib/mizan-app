import { expect, test } from "vitest";
import { previewProduct, previewRegistration } from "./registration";
import { resolveProductForm, type ProductFormValues } from "./form";

const product: ProductFormValues = {
  code: "R1",
  name: "Ring",
  categoryId: "",
  purity: "585",
  weight: "2.001",
  netGoldWeight: "1.500",
  acquisitionCostPerGram: { amount: "50.12", currency: "AZN" },
};

test("stone-set products require a supplier total and validate alloy weight and stone measurements", () => {
  const stoneSet: ProductFormValues = {
    ...product,
    categoryId: "00000000-0000-4000-8000-000000000001",
    gemstones: [
      { gemstoneType: "Diamond", stoneCount: "2", totalCarats: "0.400" },
    ],
    acquisitionCost: { amount: "120.1234", currency: "AZN" },
    acquisitionBreakdown: { metal: "100.1234", gemstones: "20" },
  };
  expect(resolveProductForm(stoneSet)).toMatchObject({
    errors: {},
    values: {
      netGoldWeight: "1.500",
      acquisitionCost: stoneSet.acquisitionCost,
      gemstones: [{ gemstoneType: "Diamond", stoneCount: 2 }],
    },
  });
  expect(previewProduct(stoneSet).cost).toEqual(stoneSet.acquisitionCost);
  expect(
    previewProduct({ ...stoneSet, acquisitionCost: undefined }).cost,
  ).toBeUndefined();
  expect(
    resolveProductForm({ ...stoneSet, netGoldWeight: "2.002" }).errors,
  ).toHaveProperty("netGoldWeight");
  expect(
    resolveProductForm({
      ...stoneSet,
      gemstones: [{ ...stoneSet.gemstones![0], individualCarats: "0.500" }],
    }).errors,
  ).toHaveProperty("gemstones.0.individualCarats");
  expect(
    resolveProductForm({
      ...stoneSet,
      acquisitionBreakdown: { metal: "100", gemstones: "20" },
    }).errors,
  ).toHaveProperty("acquisitionBreakdown");
});

test("summarizes exact weights, apportioned product costs and partial supplier payment", () => {
  const rows = [
    previewProduct(product, "USD"),
    previewProduct(
      { ...product, weight: "1.002", netGoldWeight: undefined },
      "USD",
    ),
  ];
  expect(previewRegistration(rows, "USD", "150.1500")).toEqual({
    gross: "3.003",
    net: "1.500",
    netCount: 1,
    acquisition: [{ amount: "150.5103", currency: "USD" }],
    paid: { amount: "150.1500", currency: "USD" },
    outstanding: { amount: "0.3603", currency: "USD" },
    status: "PARTIALLY_PAID",
    overpayment: false,
  });
  expect(previewRegistration(rows, "USD", "150.5104")).toMatchObject({
    overpayment: true,
  });
  expect(previewRegistration(rows, "USD", "150.5103")).toMatchObject({
    status: "PAID",
  });
  expect(previewRegistration(rows, "USD")).toMatchObject({ status: "UNPAID" });
});

test("keeps currency totals separate and hides incomplete totals", () => {
  const azn = previewProduct(product);
  const eur = previewProduct(product, "EUR");
  expect(previewRegistration([azn, eur]).acquisition).toEqual([
    { amount: "100.2901", currency: "AZN" },
    { amount: "100.2901", currency: "EUR" },
  ]);
  expect(previewRegistration([azn, undefined])).toMatchObject({
    acquisition: [],
    gross: undefined,
  });
  expect(previewRegistration([azn], "A", "50")).toMatchObject({
    paid: undefined,
    outstanding: undefined,
    status: undefined,
  });
  expect(
    previewProduct({ ...product, netGoldWeight: "3" }).net,
  ).toBeUndefined();
});
