import { currencyMinorUnits } from "@mizan/contracts";
import { Prisma } from "@mizan/database";
import { AccessError } from "../access/access.errors.js";

export const SaleDecimal = Prisma.Decimal.clone({ precision: 64 });

export interface CashTender {
  currency: string;
  amount: string;
  exchangeRate: string;
}

export function calculateSettlement(
  currency: string,
  saleAmount: string,
  acceptedValues: string[],
  tender?: CashTender,
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
    : due;
  if (tender && due.isZero()) {
    throw new AccessError("SALE_PAYMENT_NOT_DUE", "payment");
  }
  if (converted.lessThan(due)) {
    throw new AccessError("SALE_PAYMENT_TOO_LOW", "payment.amount");
  }
  return {
    tradeInTotal: tradeInTotal.toFixed(),
    balance: balance.toFixed(scale),
    convertedPayment: converted.toFixed(scale),
    change: converted.minus(due).toFixed(scale),
    payout: SaleDecimal.max(balance.negated(), 0).toFixed(scale),
  };
}
