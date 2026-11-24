import { expect, test } from "vitest";
import { previewProduct, previewRegistration } from "./registration";
import type { ProductFormValues } from "./form";

const product: ProductFormValues = {
  code: "R1",
  name: "Ring",
  categoryId: "",
  purity: "585",
  weight: "2.001",
  netGoldWeight: "1.500",
  acquisitionCostPerGram: { amount: "50.12", currency: "AZN" },
};

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
