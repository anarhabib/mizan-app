import { describe, expect, it } from "vitest";
import { calculateProfit } from "../src/modules/sales/profit.js";
import { SaleDecimal } from "../src/modules/sales/settlement.js";

describe("sale profit", () => {
  it.each([
    ["200", "70", "130", "65"],
    ["80", "100.125", "-20.125", "-25.16"],
    ["0", "25", "-25", null],
    ["120", "120", "0", "0"],
    ["9007199254740993.01", "9007199254740993", "0.01", "0"],
  ])(
    "uses final consideration %s and snapshot cost %s",
    (amount, cost, grossProfit, marginPercent) => {
      expect(
        calculateProfit(amount, "AZN", new SaleDecimal(cost), "AZN"),
      ).toMatchObject({ grossProfit, marginPercent });
    },
  );

  it("keeps a known cost in its original currency and leaves incomparable profits unavailable", () => {
    expect(calculateProfit("200", "USD", new SaleDecimal("70"), "AZN")).toEqual(
      {
        acquisitionCost: { amount: "70", currency: "AZN" },
        grossProfit: null,
        marginPercent: null,
      },
    );
    expect(calculateProfit("200", "AZN", null, null)).toEqual({
      acquisitionCost: null,
      grossProfit: null,
      marginPercent: null,
    });
  });
});
