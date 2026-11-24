import { expect, test } from "vitest";
import { parseProductRegistration } from "../src/product-registration.js";

const categoryId = "10000000-0000-4000-8000-000000000000";
const supplierId = "20000000-0000-4000-8000-000000000000";
const product = {
  code: "R1",
  name: "Ring",
  categoryId,
  purity: 585,
  weight: "3.001",
  acquisitionCostPerGram: { amount: "100.0099", currency: "AZN" },
};
const purchase = { supplierId, currency: "AZN", purchaseDate: "2026-11-24" };

test("nonfinancial registration accepts scoped supplier references and excludes purchase data", () => {
  expect(
    parseProductRegistration({
      source: "OPENING_STOCK",
      historicalSupplierId: supplierId,
      products: [product],
    }),
  ).toMatchObject({
    input: {
      source: "OPENING_STOCK",
      historicalSupplierId: supplierId,
      products: [{ total: { amount: "300.1297", currency: "AZN" } }],
    },
  });
  for (const source of ["OPENING_STOCK", "OTHER"]) {
    expect(
      parseProductRegistration({ source, products: [product], purchase }),
    ).toEqual({ field: "source" });
    expect(
      parseProductRegistration({ source, products: [product, product] }),
    ).toEqual({ field: "products.1.code" });
  }
  expect(
    parseProductRegistration({
      source: "OTHER",
      products: [{ ...product, categoryId: undefined, category: "Rings" }],
    }),
  ).toEqual({ field: "products.0.categoryId" });
});

test("supplier registration uses the purchase currency and derives the initial payment date", () => {
  const body = { source: "SUPPLIER_PURCHASE", purchase, products: [product] };
  expect(parseProductRegistration(body)).toMatchObject({
    input: { source: body.source, purchase },
  });
  expect(
    parseProductRegistration({
      ...body,
      purchase: { ...purchase, currency: "USD" },
    }),
  ).toEqual({ field: "products.0.currency" });
  const payment = { amount: "150.0011", currency: "AZN", method: "CASH" };
  expect(
    parseProductRegistration({ ...body, initialPayment: payment }),
  ).toMatchObject({
    input: {
      initialPayment: { ...payment, paymentDate: purchase.purchaseDate },
    },
  });
  expect(
    parseProductRegistration({
      ...body,
      initialPayment: { ...payment, currency: "USD" },
    }),
  ).toEqual({ field: "initialPayment.currency" });
  expect(
    parseProductRegistration({
      ...body,
      initialPayment: { ...payment, amount: "-1" },
    }),
  ).toEqual({ field: "initialPayment.amount" });
  expect(
    parseProductRegistration({
      ...body,
      initialPayment: { ...payment, method: undefined },
    }),
  ).toEqual({ field: "initialPayment.method" });
});
