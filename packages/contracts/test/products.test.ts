import { expect, test } from "vitest";
import { parseProductAcquisition } from "../src/products.js";

function acquisition(weight: string, amount: string, currency = "AZN") {
  return parseProductAcquisition({
    weight,
    acquisitionCostPerGram: { amount, currency },
  });
}

test("acquisition multiplies exactly and rounds the total half up to four places", () => {
  expect(acquisition("0.001", "0.15")).toMatchObject({
    total: { amount: "0.0002", currency: "AZN" },
  });
  expect(acquisition("2.345", "99.1234567890123456", "JPY")).toMatchObject({
    total: { amount: "232.4445", currency: "JPY" },
  });
  expect(acquisition("0.001", "9999999999999999999.9000")).toMatchObject({
    total: { amount: "9999999999999999.9999", currency: "AZN" },
  });
});

test("acquisition rejects invalid measurements, rates, currencies and totals", () => {
  expect(acquisition("0", "1")).toEqual({ field: "weight" });
  expect(acquisition("0.0001", "1")).toEqual({ field: "weight" });
  for (const result of [
    acquisition("1", "1.00000000000000001"),
    acquisition("1", "1", "BAD"),
    acquisition("0.001", "0.049"),
    acquisition("0.001", "9999999999999999999.9500"),
  ]) {
    expect(result).toEqual({ field: "acquisitionCostPerGram" });
  }
});
