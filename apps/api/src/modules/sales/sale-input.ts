import { currencyMinorUnits, parseDecimal } from "@mizan/contracts";
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

export function parseSaleInput(body: unknown, currency: string) {
  const input = object(body, "sale");
  if (
    input.expectedCurrency !== undefined &&
    input.expectedCurrency !== currency
  )
    throw new AccessError("SALE_CONFLICT", "currency");
  const scale = currencyMinorUnits(currency);
  const lines = input.tradeIns === undefined ? [] : input.tradeIns;
  if (!Array.isArray(lines) || lines.length > 100)
    throw new AccessError("INVALID_SALE", "tradeIns");
  const tradeIns = lines.map((value: unknown) => {
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
    productId: id(input.productId, "productId"),
    saleAmount: decimal(input.saleAmount, scale, 16, "saleAmount"),
    tradeIns,
    tender,
  };
}
