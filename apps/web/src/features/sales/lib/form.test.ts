import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import {
  buildSalePayload,
  saleError,
  saleResolver,
  type SaleFormValues,
} from "./form";

const options = {
  currency: "AZN",
  rates: [{ id: "rate-585", purity: 585, amountPerGram: "91.125" }],
};
const values: SaleFormValues = {
  saleAmount: " 210.00 ",
  tradeIns: [],
  includePayment: false,
  payment: { currency: "AZN", amount: "invalid", exchangeRate: "invalid" },
};
const build = (form: SaleFormValues) =>
  buildSalePayload(form, "product-1", options);

describe("sale payload", () => {
  it("includes expected currency and omits unused sections", () => {
    expect(build(values)).toEqual({
      input: {
        productId: "product-1",
        expectedCurrency: "AZN",
        saleAmount: "210.00",
      },
    });
  });

  it("uses current rate IDs and keeps exact decimal strings for foreign payments and trade-ins", () => {
    expect(
      build({
        ...values,
        saleAmount: "9007199254740993.01",
        tradeIns: [
          { rateId: "rate-585", weight: "0.301", overrideAmount: "0.00" },
          { rateId: "rate-585", weight: "12.010", overrideAmount: "" },
        ],
        includePayment: true,
        payment: {
          currency: " kwd ",
          amount: "210.001",
          exchangeRate: "5.53579301",
        },
      }),
    ).toEqual({
      input: {
        productId: "product-1",
        expectedCurrency: "AZN",
        saleAmount: "9007199254740993.01",
        tradeIns: [
          {
            rateId: "rate-585",
            purity: 585,
            weight: "0.301",
            overrideAmount: "0.00",
          },
          { rateId: "rate-585", purity: 585, weight: "12.010" },
        ],
        payment: {
          currency: "KWD",
          amount: "210.001",
          exchangeRate: "5.53579301",
        },
      },
    });
  });

  it("omits the exchange rate for a same-currency payment", () => {
    expect(
      build({
        ...values,
        includePayment: true,
        payment: { currency: "AZN", amount: "210", exchangeRate: "1.500" },
      }),
    ).toMatchObject({ input: { payment: { currency: "AZN", amount: "210" } } });
    expect(
      build({
        ...values,
        includePayment: true,
        payment: { currency: "AZN", amount: "210", exchangeRate: "1.500" },
      }),
    ).not.toHaveProperty("input.payment.exchangeRate");
  });

  it("sends each final negotiated amount, including zero, without product labels", () => {
    expect(
      build({
        ...values,
        saleAmount: "0.00",
        items: [{ productId: "product-2", label: "Ring", saleAmount: "15.25" }],
      }),
    ).toEqual({
      input: {
        items: [
          { productId: "product-1", saleAmount: "0.00" },
          { productId: "product-2", saleAmount: "15.25" },
        ],
        expectedCurrency: "AZN",
      },
    });
    expect(
      build({
        ...values,
        items: [{ productId: "product-1", label: "Ring", saleAmount: "15.25" }],
      }),
    ).toEqual({ field: "items" });
  });

  it.each(["12.345", "-1", "1e2", "10000000000000000"])(
    "rejects invalid sale amount %s",
    (saleAmount) => {
      expect(build({ ...values, saleAmount })).toEqual({ field: "saleAmount" });
    },
  );

  it("requires a current rate, supported weight precision and a valid override", () => {
    const row = { rateId: "rate-585", weight: "1.005", overrideAmount: "" };
    expect(
      build({ ...values, tradeIns: [{ ...row, rateId: "old-rate" }] }),
    ).toEqual({ field: "tradeIns.0.rateId" });
    expect(
      build({ ...values, tradeIns: [{ ...row, weight: "1.0001" }] }),
    ).toEqual({ field: "tradeIns.0.weight" });
    expect(
      build({ ...values, tradeIns: [{ ...row, overrideAmount: "1.001" }] }),
    ).toEqual({ field: "tradeIns.0.overrideAmount" });
    expect(
      build({ ...values, tradeIns: Array.from({ length: 101 }, () => row) }),
    ).toEqual({ field: "tradeIns" });
  });

  it("validates payment fields and requires a positive foreign rate", () => {
    const payment = { currency: "JPY", amount: "2000", exchangeRate: "" };
    const withPayment = (changes: Partial<typeof payment>) =>
      build({
        ...values,
        includePayment: true,
        payment: { ...payment, ...changes },
      });
    expect(withPayment({ currency: "XYZ" })).toEqual({
      field: "payment.currency",
    });
    expect(withPayment({ amount: "200.1" })).toEqual({
      field: "payment.amount",
    });
    expect(withPayment({})).toEqual({ field: "payment.exchangeRate" });
    expect(withPayment({ exchangeRate: "0.00000000" })).toEqual({
      field: "payment.exchangeRate",
    });
    expect(withPayment({ exchangeRate: "0.001234567" })).toEqual({
      field: "payment.exchangeRate",
    });
  });

  it("returns nested errors to react-hook-form", async () => {
    const resolver = saleResolver("product-1", options);
    const metadata = { fields: {}, shouldUseNativeValidation: false };
    const invalid = {
      ...values,
      tradeIns: [{ rateId: "rate-585", weight: "0", overrideAmount: "" }],
    };
    expect(await resolver(invalid, undefined, metadata)).toEqual({
      values: {},
      errors: { tradeIns: { 0: { weight: { type: "validate" } } } },
    });
  });
});

describe("sale errors", () => {
  it("guides the user when the tender is below the balance or no payment is due", () => {
    expect(
      saleError(
        new ApiError(400, "SALE_PAYMENT_TOO_LOW", "server", "payment.amount"),
        1,
      ),
    ).toEqual({
      message: "paymentTooLow",
      field: "payment.amount",
    });
    expect(
      saleError(
        new ApiError(400, "SALE_PAYMENT_NOT_DUE", "server", "payment"),
        1,
      ),
    ).toEqual({
      message: "paymentNotDue",
    });
  });
  it("maps simple and nested validation fields", () => {
    const invalid = (field: string, count = 1) =>
      saleError(new ApiError(400, "INVALID_SALE", "server", field), count);
    expect(invalid("saleAmount")).toEqual({
      message: "invalid",
      field: "saleAmount",
    });
    expect(invalid("payment.exchangeRate")).toEqual({
      message: "invalid",
      field: "payment.exchangeRate",
    });
    expect(invalid("tradeIns[1].purity", 2)).toEqual({
      message: "invalid",
      field: "tradeIns.1.rateId",
      refresh: true,
    });
    expect(invalid("tradeIns.weight")).toMatchObject({
      field: "tradeIns.0.weight",
    });
    expect(invalid("tradeIns.weight", 2)).toMatchObject({ field: "tradeIns" });
    expect(invalid("idempotencyKey")).toEqual({ message: "invalid" });
  });

  it("refreshes options only for the currency mismatch or outdated rate", () => {
    expect(
      saleError(new ApiError(409, "SALE_CONFLICT", "server", "currency"), 0),
    ).toEqual({ message: "currencyChanged", refresh: true });
    expect(
      saleError(new ApiError(409, "SALE_CONFLICT", "server", "productId"), 0),
    ).toEqual({ message: "conflict" });
  });

  it("maps missing products and sales", () => {
    expect(
      saleError(new ApiError(404, "PRODUCT_NOT_FOUND", "server"), 0),
    ).toEqual({ message: "productMissing" });
    expect(saleError(new ApiError(404, "SALE_NOT_FOUND", "server"), 0)).toEqual(
      { message: "saleMissing" },
    );
  });

  it.each([
    new ApiError(0, "NETWORK_ERROR", "server", undefined, true),
    new ApiError(408, "HTTP_ERROR", "server"),
    new ApiError(504, "HTTP_ERROR", "server"),
    new ApiError(201, "INVALID_RESPONSE", "server"),
  ])("requires verification after an ambiguous response", (error) => {
    expect(saleError(error, 0)).toEqual({
      message: "unknownOutcome",
      check: true,
    });
  });
});
