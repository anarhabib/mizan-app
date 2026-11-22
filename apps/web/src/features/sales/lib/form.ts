import {
  parseDecimal,
  parseMoney,
  parsePurity,
  maxSaleItems,
  type SalePreviewInput,
  type SaleCreateInput,
} from "@mizan/contracts";
import type { FieldErrors, FieldPath, Resolver } from "react-hook-form";
import type { ApiError } from "@/shared/lib/api";
import type { SaleOptions } from "../api/queries";

export const maxTradeIns = 100;

export type SaleFormValues = {
  customerId?: string;
  customerReportingRate?: string;
  recordDebt?: boolean;
  saleAmount: string;
  items?: { productId: string; label: string; saleAmount: string }[];
  tradeIns: { rateId: string; weight: string; overrideAmount: string }[];
  includePayment: boolean;
  payment: { currency: string; amount: string; exchangeRate: string };
};

type SaleField = FieldPath<SaleFormValues>;
type Invalid = { field: SaleField };

function validDecimal(
  value: string,
  maxDigits: number,
  parse: (value: string) => string,
  allowZero = false,
) {
  try {
    const parsed = parse(value.trim());
    if (
      parsed.split(".")[0].length > maxDigits ||
      (!allowZero && !/[1-9]/.test(parsed))
    )
      return;
    return parsed;
  } catch {
    return undefined;
  }
}

function amount(value: string, currency: string, allowZero = false) {
  return validDecimal(
    value,
    16,
    (input) => parseMoney({ amount: input, currency }).amount,
    allowZero,
  );
}

export function buildSalePayload(
  values: SaleFormValues,
  productId: string,
  { currency, rates }: SaleOptions,
): { input: SaleCreateInput } | Invalid {
  const saleAmount = amount(values.saleAmount, currency, true);
  if (saleAmount === undefined) return { field: "saleAmount" };
  const items = [{ productId, saleAmount }];
  const selected = new Set([productId]);
  if ((values.items?.length ?? 0) >= maxSaleItems) return { field: "items" };
  for (const [index, row] of (values.items ?? []).entries()) {
    if (selected.has(row.productId)) return { field: "items" };
    selected.add(row.productId);
    const finalAmount = amount(row.saleAmount, currency, true);
    if (finalAmount === undefined)
      return { field: `items.${index}.saleAmount` };
    items.push({ productId: row.productId, saleAmount: finalAmount });
  }
  if (values.tradeIns.length > maxTradeIns) return { field: "tradeIns" };

  const tradeIns: NonNullable<SaleCreateInput["tradeIns"]> = [];
  for (const [index, row] of values.tradeIns.entries()) {
    const rate = rates.find(({ id }) => id === row.rateId);
    const purity = parsePurity(rate?.purity);
    if (!rate || purity === null) return { field: `tradeIns.${index}.rateId` };
    const weight = validDecimal(row.weight, 12, (input) =>
      parseDecimal(input, 3),
    );
    if (weight === undefined) return { field: `tradeIns.${index}.weight` };
    const overrideAmount = row.overrideAmount.trim()
      ? amount(row.overrideAmount, currency, true)
      : undefined;
    if (row.overrideAmount.trim() && overrideAmount === undefined) {
      return { field: `tradeIns.${index}.overrideAmount` };
    }
    tradeIns.push({ purity, weight, rateId: rate.id, overrideAmount });
  }

  const input: SaleCreateInput =
    items.length > 1
      ? { items, expectedCurrency: currency }
      : { productId, saleAmount, expectedCurrency: currency };
  if (tradeIns.length) input.tradeIns = tradeIns;
  if (values.recordDebt && !values.customerId) return { field: "customerId" };
  if (values.customerId) {
    input.customerId = values.customerId;
    if (values.recordDebt) input.recordDebt = true;
    if (currency !== "AZN") {
      const rate = validDecimal(
        values.customerReportingRate ?? "",
        12,
        (value) => parseDecimal(value, 8),
      );
      if (rate === undefined) return { field: "customerReportingRate" };
      input.customerReportingRate = rate;
    }
  }
  if (values.includePayment) {
    const paymentCurrency = values.payment.currency.trim().toUpperCase();
    try {
      parseMoney({ amount: "0", currency: paymentCurrency });
    } catch {
      return { field: "payment.currency" };
    }
    const paymentAmount = amount(values.payment.amount, paymentCurrency);
    if (paymentAmount === undefined) return { field: "payment.amount" };
    input.payment = { currency: paymentCurrency, amount: paymentAmount };
    if (paymentCurrency !== currency) {
      const exchangeRate = validDecimal(
        values.payment.exchangeRate,
        12,
        (value) => parseDecimal(value, 8),
      );
      if (exchangeRate === undefined) return { field: "payment.exchangeRate" };
      input.payment.exchangeRate = exchangeRate;
    }
  }
  return { input };
}

export function buildSalePreviewInput(
  values: Pick<SaleFormValues, "saleAmount" | "items" | "tradeIns">,
  { currency, rates }: SaleOptions,
): SalePreviewInput | undefined {
  const { tradeIns: rows } = values;
  if (rows.length > maxTradeIns) return undefined;
  const tradeIns: NonNullable<SalePreviewInput["tradeIns"]> = [];
  for (const row of rows) {
    const rate = rates.find(({ id }) => id === row.rateId);
    const purity = parsePurity(rate?.purity);
    if (!rate || purity === null) return undefined;
    const weight = validDecimal(row.weight, 12, (input) =>
      parseDecimal(input, 3),
    );
    if (weight === undefined) return undefined;
    const overrideAmount = row.overrideAmount.trim()
      ? amount(row.overrideAmount, currency, true)
      : undefined;
    if (row.overrideAmount.trim() && overrideAmount === undefined)
      return undefined;
    tradeIns.push({ purity, weight, rateId: rate.id, overrideAmount });
  }
  let saleAmounts: string[] | undefined;
  if ((values.items?.length ?? 0) < maxSaleItems) {
    const mainAmount = amount(values.saleAmount, currency, true);
    const extraAmounts = (values.items ?? []).map((item) =>
      amount(item.saleAmount, currency, true),
    );
    if (
      mainAmount !== undefined &&
      extraAmounts.every((value) => value !== undefined)
    ) {
      saleAmounts = [
        mainAmount,
        ...extraAmounts.filter((value): value is string => value !== undefined),
      ];
    }
  }
  if (!tradeIns.length && !saleAmounts) return undefined;
  return {
    expectedCurrency: currency,
    tradeIns,
    ...(saleAmounts && { saleAmounts }),
  };
}

export function saleResolver(
  productId: string,
  options: SaleOptions,
): Resolver<SaleFormValues, unknown, SaleCreateInput> {
  return (values) => {
    const built = buildSalePayload(values, productId, options);
    if ("input" in built) return { values: built.input, errors: {} };
    const error = { type: "validate" };
    const [group, index, field] = built.field.split(".");
    const errors = (
      field
        ? { [group]: { [index]: { [field]: error } } }
        : index
          ? { [group]: { [index]: error } }
          : { [group]: error }
    ) as FieldErrors<SaleFormValues>;
    return { values: {}, errors };
  };
}

export function saleError(error: ApiError, tradeInCount: number) {
  if (
    error.isNetwork ||
    error.status >= 500 ||
    error.status === 408 ||
    error.code === "INVALID_RESPONSE"
  ) {
    return { message: "unknownOutcome", check: true } as const;
  }
  if (error.code === "SALE_CONFLICT" && error.field === "currency") {
    return { message: "currencyChanged", refresh: true } as const;
  }
  if (error.code === "SALE_PAYMENT_TOO_LOW") {
    return { message: "paymentTooLow", field: "payment.amount" } as const;
  }
  if (error.code === "SALE_CUSTOMER_REQUIRED") {
    return { message: "customerRequired", field: "customerId" } as const;
  }
  if (error.code === "CUSTOMER_NOT_FOUND") {
    return { message: "customerMissing", field: "customerId" } as const;
  }
  if (error.code === "SALE_PAYMENT_NOT_DUE") {
    return { message: "paymentNotDue" } as const;
  }
  if (error.code === "INVALID_SALE") {
    const field = error.field;
    if (
      field === "saleAmount" ||
      field === "customerReportingRate" ||
      field === "tradeIns" ||
      /^payment\.(currency|amount|exchangeRate)$/.test(field ?? "")
    ) {
      return { message: "invalid", field: field as SaleField } as const;
    }
    const trade =
      /^tradeIns(?:\[(\d+)\]|\.(\d+))?\.(purity|rateId|weight|overrideAmount)$/.exec(
        field ?? "",
      );
    if (trade) {
      const index =
        trade[1] ?? trade[2] ?? (tradeInCount === 1 ? "0" : undefined);
      const name = trade[3] === "purity" ? "rateId" : trade[3];
      const path =
        index !== undefined && Number(index) < tradeInCount
          ? (`tradeIns.${index}.${name}` as SaleField)
          : "tradeIns";
      return {
        message: "invalid",
        field: path,
        refresh: name === "rateId",
      } as const;
    }
    if (field === "payment") return { message: "invalidPayment" } as const;
    return { message: "invalid" } as const;
  }
  if (error.code === "SALE_CONFLICT") return { message: "conflict" } as const;
  if (error.code === "PRODUCT_NOT_FOUND")
    return { message: "productMissing" } as const;
  if (error.code === "SALE_NOT_FOUND")
    return { message: "saleMissing" } as const;
  return { message: "generic" } as const;
}
