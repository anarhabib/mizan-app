import { expect, test } from "vitest";
import {
  parseProductAcquisition,
  parseProductCreate,
} from "../src/products.js";

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

const jewelry = {
  code: "R-123",
  name: "Ring",
  category: "Ring",
  purity: 585,
  weight: "2.505",
  acquisitionCost: { amount: "120.1259", currency: "USD" },
  gemstones: [
    {
      gemstoneType: "Diamond",
      stoneCount: 1,
      origin: "LAB_GROWN",
      totalCarats: "0.12501",
      individualCarats: "0.12501",
      laboratory: "IGI",
      reportNumber: "001234",
    },
    { gemstoneType: "Ruby", stoneCount: 4 },
  ],
};

test("parses multiple gemstone groups without deriving metal weight or missing grades", () => {
  const parsed = parseProductCreate(jewelry);
  expect(parsed).toMatchObject({
    input: {
      gemstones: [
        jewelry.gemstones[0],
        { ...jewelry.gemstones[1], origin: "UNKNOWN" },
      ],
    },
    total: jewelry.acquisitionCost,
  });
  if ("input" in parsed) {
    expect(parsed.input).not.toHaveProperty("netGoldWeight");
    expect(parsed.input.gemstones?.[1]).not.toHaveProperty("totalCarats");
  }
});

test("checks gemstone measurements and requires a supplier total for stone-set jewelry", () => {
  expect(parseProductCreate({ ...jewelry, netGoldWeight: "2.506" })).toEqual({
    field: "netGoldWeight",
  });
  expect(parseProductCreate({ ...jewelry, metalType: "SILVER" })).toEqual({
    field: "metalType",
  });
  expect(
    parseProductCreate({
      ...jewelry,
      acquisitionCost: undefined,
      acquisitionCostPerGram: { amount: "40", currency: "USD" },
    }),
  ).toEqual({ field: "acquisitionCost" });
  for (const [field, value] of [
    ["totalCarats", "0.123456"],
    ["individualCarats", "0.12502"],
    ["stoneCount", 1.5],
    ["origin", "UNSPECIFIED_ORIGIN"],
  ]) {
    expect(
      parseProductCreate({
        ...jewelry,
        gemstones: [{ ...jewelry.gemstones[0], [field]: value }],
      }),
    ).toEqual({ field: `gemstones.0.${field}` });
  }
});

test("validates component sums exactly and applies minor units only to the selling price", () => {
  const acquisitionBreakdown = {
    metal: "20.0001",
    gemstones: "99.1258",
    workmanship: "1",
    other: "0",
  };
  const fixedSellingPrice = { amount: "193.25", currency: "AZN" };
  expect(
    parseProductCreate({ ...jewelry, acquisitionBreakdown, fixedSellingPrice }),
  ).toMatchObject({
    total: jewelry.acquisitionCost,
    input: { acquisitionBreakdown, fixedSellingPrice },
  });
  expect(
    parseProductCreate({
      ...jewelry,
      acquisitionBreakdown: { ...acquisitionBreakdown, metal: "20.0000" },
    }),
  ).toEqual({ field: "acquisitionBreakdown" });
  expect(
    parseProductCreate({ ...jewelry, acquisitionBreakdown: { other: "-1" } }),
  ).toEqual({ field: "acquisitionBreakdown.other" });
  expect(
    parseProductCreate({
      ...jewelry,
      fixedSellingPrice: { amount: "193.251", currency: "AZN" },
    }),
  ).toEqual({ field: "fixedSellingPrice" });
});
