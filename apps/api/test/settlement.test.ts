import { describe, expect, it } from "vitest";
import {
  calculateSettlement,
  calculateTradeIns,
  SaleDecimal,
} from "../src/modules/sales/settlement.js";

describe("sale settlement", () => {
  it("calculates every trade-in with current rates and sums accepted values", () => {
    expect(
      calculateTradeIns(
        [
          { purity: 585, weight: "2.000", rateId: "rate-585" },
          {
            purity: 585,
            weight: "1.500",
            rateId: "rate-585",
            overrideAmount: "25",
          },
        ],
        [
          {
            id: "rate-585",
            purity: 585,
            amountPerGram: new SaleDecimal("15"),
          },
        ],
      ),
    ).toEqual({
      tradeIns: [
        {
          purity: 585,
          weight: "2.000",
          rateId: "rate-585",
          appliedRate: "15",
          calculatedValue: "30",
          acceptedValue: "30",
          overridden: false,
        },
        {
          purity: 585,
          weight: "1.500",
          rateId: "rate-585",
          appliedRate: "15",
          calculatedValue: "22.5",
          acceptedValue: "25",
          overridden: true,
        },
      ],
      tradeInTotal: "55",
    });
  });

  it("rejects trade-ins using stale rate IDs", () => {
    expect(() =>
      calculateTradeIns(
        [{ purity: 585, weight: "1", rateId: "old-rate" }],
        [
          {
            id: "current-rate",
            purity: 585,
            amountPerGram: new SaleDecimal("15"),
          },
        ],
      ),
    ).toThrow(
      expect.objectContaining({ code: "SALE_CONFLICT", field: "rateId" }),
    );
  });

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
    ).toThrow(
      expect.objectContaining({
        code: "SALE_PAYMENT_TOO_LOW",
        field: "payment.amount",
      }),
    );
  });

  it("requires the converted tender to cover the post-trade-in balance", () => {
    const tender = { currency: "USD", amount: "100", exchangeRate: "1.70" };
    expect(() => calculateSettlement("AZN", "750", ["150"], tender)).toThrow(
      expect.objectContaining({ code: "SALE_PAYMENT_TOO_LOW" }),
    );
    expect(
      calculateSettlement("AZN", "750", ["150"], { ...tender, amount: "353" }),
    ).toMatchObject({
      balance: "600.00",
      convertedPayment: "600.10",
      change: "0.10",
    });
    expect(() => calculateSettlement("AZN", "750", ["750"], tender)).toThrow(
      expect.objectContaining({
        code: "SALE_PAYMENT_NOT_DUE",
        field: "payment",
      }),
    );
  });
});
