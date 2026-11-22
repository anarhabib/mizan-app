import { currencyMinorUnits } from "@mizan/contracts";
import type {
  SalePaymentStatus,
  SaleTradeInInput,
  SaleTradeInPreview,
} from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";

export const SaleDecimal = Prisma.Decimal.clone({ precision: 64 });

export function outstandingSaleDebt(
  balance: Prisma.Decimal,
  convertedPayment: Prisma.Decimal | null,
) {
  return SaleDecimal.max(
    new SaleDecimal(balance).minus(convertedPayment ?? 0),
    0,
  );
}

export interface CashTender {
  currency: string;
  amount: string;
  exchangeRate: string;
}

export function paymentStatus(
  balance: Prisma.Decimal,
  debt: Prisma.Decimal,
): SalePaymentStatus {
  if (debt.isZero()) return "PAID";
  return debt.eq(balance) ? "UNPAID" : "PARTIALLY_PAID";
}

export function paidSaleAmount(balance: Prisma.Decimal, debt: Prisma.Decimal) {
  return SaleDecimal.max(new SaleDecimal(balance).minus(debt), 0).toFixed();
}

export function convertPayment(
  payment: ReturnType<typeof import("./sale-input.js").parsePayment>,
  currency: string,
  reportingRate: string,
  field: string,
) {
  const exactAzn = new SaleDecimal(payment.amount).times(payment.exchangeRate);
  const converted = (
    payment.currency === currency
      ? new SaleDecimal(payment.amount)
      : exactAzn.div(reportingRate)
  ).toDecimalPlaces(currencyMinorUnits(currency), SaleDecimal.ROUND_HALF_UP);
  if (converted.isZero())
    throw new AccessError("SALE_PAYMENT_TOO_SMALL", `${field}.amount`);
  return {
    ...payment,
    amountAzn: exactAzn.toFixed(2, SaleDecimal.ROUND_HALF_UP),
    convertedAmount: converted.toFixed(),
  };
}

export function calculateTradeIns(
  lines: SaleTradeInInput[],
  rates: { id: string; purity: number; amountPerGram: Prisma.Decimal }[],
) {
  const tradeIns: SaleTradeInPreview[] = lines.map((line) => {
    const rate = rates.find(({ purity }) => purity === line.purity);
    if (rate?.id !== line.rateId)
      throw new AccessError("SALE_CONFLICT", "rateId");
    const calculatedValue = new SaleDecimal(line.weight).times(
      rate.amountPerGram,
    );
    if (calculatedValue.gte("1e17"))
      throw new AccessError("INVALID_SALE", "weight");
    return {
      purity: line.purity,
      weight: line.weight,
      rateId: rate.id,
      appliedRate: rate.amountPerGram.toFixed(),
      calculatedValue: calculatedValue.toFixed(),
      acceptedValue: line.overrideAmount ?? calculatedValue.toFixed(),
      overridden: line.overrideAmount !== undefined,
    };
  });
  const total = tradeIns.reduce(
    (sum, line) => sum.plus(line.acceptedValue),
    new SaleDecimal(0),
  );
  if (total.gte("1e17")) throw new AccessError("INVALID_SALE", "tradeIns");
  return { tradeIns, tradeInTotal: total.toFixed() };
}

export function calculateSettlement(
  currency: string,
  saleAmount: string,
  acceptedValues: string[],
  tender?: CashTender,
  recordDebt = false,
) {
  const scale = currencyMinorUnits(currency);
  const tradeInTotal = acceptedValues.reduce(
    (total, value) => total.plus(value),
    new SaleDecimal(0),
  );
  const balance = new SaleDecimal(saleAmount)
    .minus(tradeInTotal)
    .toDecimalPlaces(scale, SaleDecimal.ROUND_HALF_UP);
  const due = SaleDecimal.max(balance, 0);
  const converted = tender
    ? new SaleDecimal(tender.amount)
        .times(tender.exchangeRate)
        .toDecimalPlaces(scale, SaleDecimal.ROUND_HALF_UP)
    : recordDebt
      ? new SaleDecimal(0)
      : due;
  if (tender && due.isZero()) {
    throw new AccessError("SALE_PAYMENT_NOT_DUE", "payment");
  }
  return {
    tradeInTotal: tradeInTotal.toFixed(),
    amountDue: due.toFixed(scale),
    balance: balance.toFixed(scale),
    convertedPayment: converted.toFixed(scale),
    change: SaleDecimal.max(converted.minus(due), 0).toFixed(scale),
    payout: SaleDecimal.max(balance.negated(), 0).toFixed(scale),
  };
}
