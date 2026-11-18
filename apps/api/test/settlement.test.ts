import { describe, expect, it } from "vitest";
import { calculateSettlement } from "../src/modules/sales/settlement.js";

describe("sale settlement", () => {
  it("keeps the original tender and calculates change in the default currency", () => {
    expect(
      calculateSettlement("AZN", "200", ["30"], {
        currency: "USD",
        amount: "110",
        exchangeRate: "1.70",
      }),
    ).toMatchObject({
      balance: "170.00",
      convertedPayment: "187.00",
      change: "17.00",
      payout: "0.00",
    });
  });

  it("rounds the final balance once and supports trade-in payouts", () => {
    expect(
      calculateSettlement("AZN", "100", ["100.001", "0.004"]),
    ).toMatchObject({
      balance: "-0.01",
      payout: "0.01",
      change: "0.00",
    });
  });

  it("accepts an exact converted payment and rejects underpayment", () => {
    expect(
      calculateSettlement("AZN", "170", [], {
        currency: "USD",
        amount: "100",
        exchangeRate: "1.70000000",
      }).change,
    ).toBe("0.00");
    expect(() =>
      calculateSettlement("AZN", "170", [], {
        currency: "USD",
        amount: "99",
        exchangeRate: "1.70",
      }),
    ).toThrow();
  });
});
