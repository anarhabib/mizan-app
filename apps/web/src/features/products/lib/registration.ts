import {
  isSupplierCurrency,
  parseDecimal,
  parseProductAcquisition,
  type MoneyInput,
  type PurchasePaymentStatus,
} from "@mizan/contracts";
import {
  productAcquisitionValues,
  productWithCurrency,
  type ProductFormValues,
} from "./form";

function units(value: string, scale: number) {
  const [whole, fraction = ""] = parseDecimal(value, scale).split(".");
  return BigInt(whole + fraction.padEnd(scale, "0"));
}

function decimal(value: bigint, scale: number) {
  const digits = value.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function weight(value: string | null | undefined) {
  try {
    if (!value || value.split(".")[0].length > 12) return;
    const measured = units(value, 3);
    return measured > 0n ? measured : undefined;
  } catch {
    return undefined;
  }
}

export function previewProduct(values: ProductFormValues, currency?: string) {
  const acquisition = parseProductAcquisition(
    productAcquisitionValues(
      productWithCurrency(
        {
          ...values,
          fixedSellingPrice: undefined,
        },
        currency,
      ),
    ),
  );
  const gross = weight(values.weight);
  const net = weight(values.netGoldWeight);
  return {
    gross,
    net: net && gross && net <= gross ? net : undefined,
    cost: "total" in acquisition ? acquisition.total : undefined,
  };
}

export type ProductPreview = ReturnType<typeof previewProduct>;

export function previewRegistration(
  rows: (ProductPreview | undefined)[],
  purchaseCurrency?: string,
  payment = "",
) {
  let gross = 0n;
  let net = 0n;
  let grossCount = 0;
  let netCount = 0;
  const costs = new Map<string, bigint>();
  for (const row of rows) {
    if (!row) continue;
    if (row.gross !== undefined) {
      gross += row.gross;
      grossCount++;
    }
    if (row.net !== undefined) {
      net += row.net;
      netCount++;
    }
    if (row.cost) {
      const { amount, currency } = row.cost;
      costs.set(currency, (costs.get(currency) ?? 0n) + units(amount, 4));
    }
  }
  const acquisition = rows.every((row) => row?.cost)
    ? Array.from(costs, ([currency, amount]) => ({
        amount: decimal(amount, 4),
        currency,
      }))
    : [];
  let paid: MoneyInput | undefined;
  let outstanding: MoneyInput | undefined;
  let status: PurchasePaymentStatus | undefined;
  let overpayment = false;
  if (isSupplierCurrency(purchaseCurrency)) {
    try {
      const paymentUnits = units(payment || "0", 4);
      paid = { amount: decimal(paymentUnits, 4), currency: purchaseCurrency };
      if (
        acquisition.length === 1 &&
        acquisition[0].currency === purchaseCurrency
      ) {
        const balance = units(acquisition[0].amount, 4) - paymentUnits;
        overpayment = balance < 0n;
        if (!overpayment) {
          outstanding = {
            amount: decimal(balance, 4),
            currency: purchaseCurrency,
          };
          status =
            balance === 0n
              ? "PAID"
              : paymentUnits === 0n
                ? "UNPAID"
                : "PARTIALLY_PAID";
        }
      }
    } catch {
      // Invalid payment input is reported by the shared parser on submit.
    }
  }
  return {
    gross: grossCount === rows.length ? decimal(gross, 3) : undefined,
    net: netCount ? decimal(net, 3) : undefined,
    netCount,
    acquisition,
    paid,
    outstanding,
    status,
    overpayment,
  };
}
