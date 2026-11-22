import { describe, expect, it } from "vitest";
import {
  calculateSettlement,
  calculateTradeIns,
  convertPayment,
  paymentStatus,
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
      amountDue: "170.00",
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

  it("preserves exact and partial converted tender", () => {
    expect(
      calculateSettlement("AZN", "170", [], {
        currency: "USD",
        amount: "100",
        exchangeRate: "1.70000000",
      }).change,
    ).toBe("0.00");
    expect(
      calculateSettlement("AZN", "170", [], {
        currency: "USD",
        amount: "99",
        exchangeRate: "1.70",
      }),
    ).toMatchObject({ convertedPayment: "168.30", change: "0.00" });
  });

  it("allows partial tender against the post-trade-in balance", () => {
    const tender = { currency: "USD", amount: "100", exchangeRate: "1.70" };
    expect(calculateSettlement("AZN", "750", ["150"], tender)).toMatchObject({
      balance: "600.00",
      convertedPayment: "170.00",
      change: "0.00",
    });
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
  it("rounds each AZN conversion half up and preserves a non-AZN settlement unit", () => {
    const tender = {
      method: "CARD" as const,
      currency: "USD",
      amount: "0.01",
      exchangeRate: "1.5",
    };
    expect(convertPayment(tender, "AZN", "1", "payment")).toMatchObject({
      amount: "0.01",
      exchangeRate: "1.5",
      convertedAmount: "0.02",
      amountAzn: "0.02",
    });
    expect(convertPayment(tender, "USD", "1.7", "payment")).toMatchObject({
      convertedAmount: "0.01",
      amountAzn: "0.02",
    });
    expect(() => convertPayment(tender, "JPY", "1.7", "payment")).toThrow(
      expect.objectContaining({ code: "SALE_PAYMENT_TOO_SMALL" }),
    );
  });

  it("derives payment status from the balance after trade-ins", () => {
    const balance = new SaleDecimal(10);
    expect(paymentStatus(balance, new SaleDecimal(10))).toBe("UNPAID");
    expect(paymentStatus(balance, new SaleDecimal(5))).toBe("PARTIALLY_PAID");
    expect(paymentStatus(balance, new SaleDecimal(0))).toBe("PAID");
  });
});
