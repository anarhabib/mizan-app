import {
  currencyMinorUnits,
  parseDecimal,
  roundMoneyHalfUp,
  type SaleCreateInput,
} from "@mizan/contracts";

// Three fractional weight digits times four fractional rate digits.
const tradeScale = 7;

export function saleDecimal(
  value: string,
  scale: number,
  digits: number,
  allowZero = false,
) {
  const decimal = parseDecimal(value.trim().replace(",", "."), scale);
  if (
    decimal.split(".")[0].length > digits ||
    (!allowZero && !/[1-9]/.test(decimal))
  ) {
    throw new RangeError("Invalid amount");
  }
  return decimal;
}

function units(value: string, scale: number) {
  const [whole, fraction = ""] = value.split(".");
  const fractionalUnits = BigInt(fraction.padEnd(scale, "0"));
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    (whole.startsWith("-") ? -fractionalUnits : fractionalUnits)
  );
}

function fixed(value: bigint, scale: number) {
  const digits = (value < 0n ? -value : value)
    .toString()
    .padStart(scale + 1, "0");
  return (
    (value < 0n ? "-" : "") +
    (scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits)
  );
}

export function tradeValue(weight: string, rate: string) {
  return fixed(
    units(saleDecimal(weight, 3, 12), 3) * units(parseDecimal(rate, 4), 4),
    tradeScale,
  );
}

export function previewSale(
  currency: string,
  amount: string,
  trades: Array<{ weight: string; rate: string; overrideAmount?: string }>,
  payment?: SaleCreateInput["payment"],
  minorUnits = currencyMinorUnits,
) {
  const scale = minorUnits(currency);
  const calculated = trades.map(({ weight, rate }) => tradeValue(weight, rate));
  const accepted = trades.map(({ overrideAmount }, index) =>
    overrideAmount === undefined
      ? calculated[index]
      : saleDecimal(overrideAmount, scale, 16, true),
  );
  const total = accepted.reduce(
    (sum, value) => sum + units(value, tradeScale),
    0n,
  );
  const balance = roundMoneyHalfUp(
    fixed(
      units(saleDecimal(amount, scale, 16), tradeScale) - total,
      tradeScale,
    ),
    scale,
  );
  const due = units(balance, scale);
  const paymentScale = payment ? minorUnits(payment.currency) : scale;
  const rate =
    payment && payment.currency !== currency
      ? saleDecimal(payment.exchangeRate ?? "", 8, 12)
      : "1";
  const converted = payment
    ? roundMoneyHalfUp(
        fixed(
          units(saleDecimal(payment.amount, paymentScale, 16), paymentScale) *
            units(rate, 8),
          paymentScale + 8,
        ),
        scale,
      )
    : fixed(due > 0n ? due : 0n, scale);
  const convertedUnits = units(converted, scale);
  if (payment && (due <= 0n || convertedUnits < due))
    throw new RangeError("Invalid tender");

  return {
    calculated,
    tradeInTotal: fixed(total, tradeScale),
    balance,
    converted,
    change: fixed(due > 0n ? convertedUnits - due : 0n, scale),
  };
}
