import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/lib/api";
import {
  buildSalePayload,
  buildSalePreviewInput,
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
  noPayment: false,
  payments: [],
};
const build = (form: SaleFormValues) =>
  buildSalePayload(form, "product-1", options);

describe("sale payload", () => {
  it("keeps the agreed amount when the buying rule changes or becomes unavailable", () => {
    const form = {
      ...values,
      tradeIns: [{ purity: "585", weight: "1.025", overrideAmount: "30" }],
    };
    const refreshed = {
      currency: "AZN",
      rates: [
        {
          id: "new-rule",
          purity: 585,
          amountPerGram: "94",
          marketQuoteId: "new-quote",
        },
      ],
    };
    expect(buildSalePreviewInput(form, refreshed)?.tradeIns).toMatchObject([
      { rateId: "new-rule", marketQuoteId: "new-quote", overrideAmount: "30" },
    ]);
    const unavailable = {
      currency: "AZN",
      rates: [{ id: null, purity: 585, amountPerGram: null }],
    };
    expect(buildSalePreviewInput(form, unavailable)?.tradeIns).toMatchObject([
      { rateId: null, overrideAmount: "30" },
    ]);
    expect(
      buildSalePreviewInput(
        {
          ...form,
          tradeIns: [{ ...form.tradeIns[0], overrideAmount: "" }],
        },
        unavailable,
      ),
    ).toBeUndefined();
  });

  it("sends explicit zero payments and requires a reporting rate for linked non-AZN sales", () => {
    expect(build({ ...values, noPayment: true })).toMatchObject({
      input: { payments: [] },
    });
    const linked = { ...values, noPayment: true, customerId: "customer-1" };
    expect(build(linked)).toMatchObject({
      input: { customerId: "customer-1", payments: [] },
    });
    const foreign = { currency: "USD", rates: [] };
    expect(buildSalePayload(linked, "product-1", foreign)).toEqual({
      field: "customerReportingRate",
    });
    expect(
      buildSalePayload(
        { ...linked, customerReportingRate: "1.70512345" },
        "product-1",
        foreign,
      ),
    ).toMatchObject({ input: { customerReportingRate: "1.70512345" } });
  });
  it("builds a preview only from complete, valid trade-in rows", () => {
    expect(
      buildSalePreviewInput(
        {
          saleAmount: "100.00",
          items: [{ productId: "product-2", label: "Ring", saleAmount: "50" }],
          tradeIns: [
            { purity: "585", weight: "1.005", overrideAmount: "12.50" },
            { purity: "585", weight: "2", overrideAmount: "" },
          ],
        },
        options,
      ),
    ).toEqual({
      expectedCurrency: "AZN",
      saleAmounts: ["100.00", "50"],
      tradeIns: [
        {
          purity: 585,
          weight: "1.005",
          rateId: "rate-585",
          overrideAmount: "12.50",
        },
        {
          purity: 585,
          weight: "2",
          rateId: "rate-585",
          overrideAmount: undefined,
        },
      ],
    });
    expect(
      buildSalePreviewInput(
        {
          saleAmount: "100",
          tradeIns: [{ purity: "585", weight: "", overrideAmount: "" }],
        },
        options,
      ),
    ).toBeUndefined();
    expect(
      buildSalePreviewInput({ saleAmount: "", tradeIns: [] }, options),
    ).toBeUndefined();
    expect(
      buildSalePreviewInput({ saleAmount: "100", tradeIns: [] }, options),
    ).toEqual({
      expectedCurrency: "AZN",
      saleAmounts: ["100"],
      tradeIns: [],
    });
  });

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
          { purity: "585", weight: "0.301", overrideAmount: "0.00" },
          { purity: "585", weight: "12.010", overrideAmount: "" },
        ],
        payments: [
          {
            method: "CARD",
            currency: " kwd ",
            amount: "210.001",
            exchangeRate: "5.53579301",
          },
        ],
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
        payments: [
          {
            method: "CARD",
            currency: "KWD",
            amount: "210.001",
            exchangeRate: "5.53579301",
          },
        ],
      },
    });
  });

  it("sends all payment methods and omits the exchange rate for AZN", () => {
    expect(
      build({
        ...values,
        payments: [
          {
            method: "CASH",
            currency: "AZN",
            amount: "25",
            exchangeRate: "1.500",
          },
          {
            method: "TRANSFER",
            currency: "USD",
            amount: "10",
            exchangeRate: "1.7",
          },
        ],
      }),
    ).toEqual({
      input: {
        productId: "product-1",
        expectedCurrency: "AZN",
        saleAmount: "210.00",
        payments: [
          { method: "CASH", currency: "AZN", amount: "25" },
          {
            method: "TRANSFER",
            currency: "USD",
            amount: "10",
            exchangeRate: "1.7",
          },
        ],
      },
    });
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

  it("requires an active purity, supported weight precision and a valid override", () => {
    const row = { purity: "585", weight: "1.005", overrideAmount: "" };
    expect(build({ ...values, tradeIns: [{ ...row, purity: "333" }] })).toEqual(
      { field: "tradeIns.0.purity" },
    );
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
    const payment = {
      method: "CASH" as const,
      currency: "JPY",
      amount: "2000",
      exchangeRate: "",
    };
    const withPayment = (changes: Partial<typeof payment>) =>
      build({
        ...values,
        payments: [{ ...payment, ...changes }],
      });
    expect(withPayment({ currency: "XYZ" })).toEqual({
      field: "payments.0.currency",
    });
    expect(withPayment({ amount: "200.1" })).toEqual({
      field: "payments.0.amount",
    });
    expect(withPayment({})).toEqual({ field: "payments.0.exchangeRate" });
    expect(withPayment({ exchangeRate: "0.00000000" })).toEqual({
      field: "payments.0.exchangeRate",
    });
    expect(withPayment({ exchangeRate: "0.001234567" })).toEqual({
      field: "payments.0.exchangeRate",
    });
  });

  it("returns nested errors to react-hook-form", async () => {
    const resolver = saleResolver("product-1", options);
    const metadata = { fields: {}, shouldUseNativeValidation: false };
    const invalid = {
      ...values,
      tradeIns: [{ purity: "585", weight: "0", overrideAmount: "" }],
    };
    expect(await resolver(invalid, undefined, metadata)).toEqual({
      values: {},
      errors: { tradeIns: { 0: { weight: { type: "validate" } } } },
    });
  });
});

describe("sale errors", () => {
  it("guides the user when tender exceeds the balance or no payment is due", () => {
    expect(
      saleError(
        new ApiError(409, "SALE_PAYMENT_EXCEEDS_BALANCE", "server", "payments"),
        1,
      ),
    ).toEqual({
      message: "paymentExceedsBalance",
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
    expect(invalid("payments.1.exchangeRate")).toEqual({
      message: "invalid",
      field: "payments.1.exchangeRate",
    });
    expect(invalid("tradeIns[1].purity", 2)).toEqual({
      message: "invalid",
      field: "tradeIns.1.purity",
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
