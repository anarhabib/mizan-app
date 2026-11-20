import type { SaleProfit } from "@mizan/contracts";
import type { Prisma } from "@mizan/database";
import { SaleDecimal } from "./settlement.js";

export function calculateProfit(
  saleAmount: string,
  currency: string,
  acquisitionCost: Prisma.Decimal | null,
  acquisitionCurrency: string | null,
): SaleProfit {
  const cost =
    acquisitionCost?.gt(0) && acquisitionCurrency
      ? { amount: acquisitionCost.toFixed(), currency: acquisitionCurrency }
      : null;
  const value = new SaleDecimal(saleAmount);
  const gross = cost?.currency === currency ? value.minus(cost.amount) : null;
  return {
    acquisitionCost: cost,
    grossProfit: gross?.toFixed() ?? null,
    marginPercent:
      gross && !value.isZero()
        ? gross
            .times(100)
            .div(value)
            .toDecimalPlaces(2, SaleDecimal.ROUND_HALF_UP)
            .toFixed()
        : null,
  };
}
