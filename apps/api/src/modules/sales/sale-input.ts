import {
  currencyMinorUnits,
  maxSaleItems,
  maxSalePayments,
  parseDecimal,
  salePaymentMethods,
} from "@mizan/contracts";
import { AccessError } from "../access/access.errors.js";
import { uuidPattern } from "../access/access.service.js";

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccessError("INVALID_SALE", field);
  return value as Record<string, unknown>;
}

function id(value: unknown, field: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw new AccessError("INVALID_SALE", field);
  return value.toLowerCase();
}

function decimal(
  value: unknown,
  scale: number,
  digits: number,
  field: string,
  allowZero = false,
) {
  try {
    if (
      typeof value !== "string" ||
      value.split(".")[0].length > digits ||
      value.length > digits + scale + 1 ||
      (!allowZero && !/[1-9]/.test(value))
    )
      throw new RangeError();
    return parseDecimal(value, scale)
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
  } catch {
    throw new AccessError("INVALID_SALE", field);
  }
}

function checkCurrency(input: Record<string, unknown>, currency: string) {
  if (
    input.expectedCurrency !== undefined &&
    input.expectedCurrency !== currency
  )
    throw new AccessError("SALE_CONFLICT", "currency");
}

export function parsePayment(value: unknown, field = "payment") {
  const payment = object(value, field);
  const { currency, method } = payment;
  if (typeof currency !== "string")
    throw new AccessError("INVALID_SALE", `${field}.currency`);
  let scale;
  try {
    scale = currencyMinorUnits(currency);
  } catch {
    throw new AccessError("INVALID_SALE", `${field}.currency`);
  }
  const paymentMethod = salePaymentMethods.find((option) => option === method);
  if (!paymentMethod) throw new AccessError("INVALID_SALE", `${field}.method`);
  const exchangeRate =
    currency === "AZN" && payment.exchangeRate === undefined
      ? "1"
      : decimal(payment.exchangeRate, 8, 12, `${field}.exchangeRate`);
  if (currency === "AZN" && exchangeRate !== "1")
    throw new AccessError("INVALID_SALE", `${field}.exchangeRate`);
  return {
    currency,
    method: paymentMethod,
    amount: decimal(payment.amount, scale, 16, `${field}.amount`),
    exchangeRate,
  };
}

function parsePayments(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxSalePayments)
    throw new AccessError("INVALID_SALE", "payments");
  return value.map((line, index) => parsePayment(line, `payments.${index}`));
}

function reportingRate(value: unknown, currency: string, required: boolean) {
  if (currency === "AZN") {
    if (value !== undefined)
      throw new AccessError("INVALID_SALE", "customerReportingRate");
    return "1";
  }
  return required || value !== undefined
    ? decimal(value, 8, 12, "customerReportingRate")
    : undefined;
}

function parseTradeIns(value: unknown, currency: string) {
  const scale = currencyMinorUnits(currency);
  const lines = value === undefined ? [] : value;
  if (!Array.isArray(lines) || lines.length > 100)
    throw new AccessError("INVALID_SALE", "tradeIns");
  return lines.map((value: unknown) => {
    const line = object(value, "tradeIns");
    if (
      typeof line.purity !== "number" ||
      !Number.isInteger(line.purity) ||
      line.purity < 1 ||
      line.purity > 999
    )
      throw new AccessError("INVALID_SALE", "purity");
    return {
      purity: line.purity,
      weight: decimal(line.weight, 3, 12, "weight"),
      rateId: id(line.rateId, "rateId"),
      overrideAmount:
        line.overrideAmount === undefined
          ? undefined
          : decimal(line.overrideAmount, scale, 16, "overrideAmount", true),
    };
  });
}

export function parseSalePreview(body: unknown, currency: string) {
  const input = object(body, "sale");
  checkCurrency(input, currency);
  let saleAmounts: string[] | undefined;
  if (input.saleAmounts !== undefined) {
    if (
      !Array.isArray(input.saleAmounts) ||
      input.saleAmounts.length < 1 ||
      input.saleAmounts.length > maxSaleItems
    )
      throw new AccessError("INVALID_SALE", "saleAmounts");
    const scale = currencyMinorUnits(currency);
    saleAmounts = input.saleAmounts.map((value: unknown) =>
      decimal(value, scale, 16, "saleAmounts", true),
    );
  }
  const payments = parsePayments(input.payments);
  return {
    tradeIns: parseTradeIns(input.tradeIns, currency),
    saleAmounts,
    payments,
    reportingRate: reportingRate(
      input.customerReportingRate,
      currency,
      !!payments?.length,
    ),
  };
}

export function parseSaleInput(body: unknown, currency: string) {
  const input = object(body, "sale");
  checkCurrency(input, currency);
  const scale = currencyMinorUnits(currency);
  const parseItem = (line: Record<string, unknown>) => ({
    productId: id(line.productId, "productId"),
    saleAmount: decimal(line.saleAmount, scale, 16, "saleAmount", true),
  });
  let items;
  if (input.items === undefined) {
    items = [parseItem(input)];
  } else {
    if (
      input.productId !== undefined ||
      input.saleAmount !== undefined ||
      !Array.isArray(input.items) ||
      !input.items.length ||
      input.items.length > maxSaleItems
    )
      throw new AccessError("INVALID_SALE", "items");
    items = input.items.map((item: unknown) =>
      parseItem(object(item, "items")),
    );
    if (new Set(items.map(({ productId }) => productId)).size !== items.length)
      throw new AccessError("INVALID_SALE", "items");
  }
  const tradeIns = parseTradeIns(input.tradeIns, currency);
  const customerId =
    input.customerId === undefined
      ? undefined
      : id(input.customerId, "customerId");
  if (input.recordDebt !== undefined && typeof input.recordDebt !== "boolean")
    throw new AccessError("INVALID_SALE", "recordDebt");
  const recordDebt = input.recordDebt === true ? true : undefined;
  const payments = parsePayments(input.payments);
  if (
    payments &&
    (input.payment !== undefined || input.recordDebt !== undefined)
  )
    throw new AccessError("INVALID_SALE", "payments");
  const rate = reportingRate(
    input.customerReportingRate,
    currency,
    !!customerId || !!payments?.length,
  );
  const customerReportingRate =
    customerId || payments || input.customerReportingRate !== undefined
      ? rate
      : undefined;
  let tender;
  if (input.payment !== undefined) {
    const payment = object(input.payment, "payment");
    const paymentCurrency = payment.currency;
    if (typeof paymentCurrency !== "string")
      throw new AccessError("INVALID_SALE", "payment.currency");
    let paymentScale;
    try {
      paymentScale = currencyMinorUnits(paymentCurrency);
    } catch {
      throw new AccessError("INVALID_SALE", "payment.currency");
    }
    const exchangeRate =
      paymentCurrency === currency && payment.exchangeRate === undefined
        ? "1"
        : decimal(payment.exchangeRate, 8, 12, "payment.exchangeRate");
    if (paymentCurrency === currency && exchangeRate !== "1")
      throw new AccessError("INVALID_SALE", "payment.exchangeRate");
    tender = {
      currency: paymentCurrency,
      amount: decimal(payment.amount, paymentScale, 16, "payment.amount"),
      exchangeRate,
    };
  }
  return {
    items,
    tradeIns,
    tender,
    payments,
    customerId,
    customerReportingRate,
    recordDebt,
  };
}
