export type DecimalString = string;

const unsignedDecimal = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

function validateScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError("Decimal scale must be a nonnegative integer");
  }
}

export function parseDecimal(input: string, scale: number): DecimalString {
  validateScale(scale);
  const match = unsignedDecimal.exec(input);
  if (match?.[0] !== input || (match[2]?.length ?? 0) > scale) {
    throw new RangeError("Invalid decimal or too many fractional digits");
  }
  return input;
}

export function roundMoneyHalfUp(
  amount: DecimalString,
  minorUnits: number,
): DecimalString {
  validateScale(minorUnits);
  const negative = amount.startsWith("-");
  const magnitude = negative ? amount.slice(1) : amount;
  const match = unsignedDecimal.exec(magnitude);
  if (match?.[0] !== magnitude) {
    throw new RangeError("Invalid settlement amount");
  }

  const [, whole, fraction = ""] = match;
  const retained = fraction.slice(0, minorUnits).padEnd(minorUnits, "0");
  let units = BigInt(whole + retained);
  if ((fraction[minorUnits] ?? "0") >= "5") {
    units += 1n;
  }

  const sign = negative && units !== 0n ? "-" : "";
  if (minorUnits === 0) {
    return sign + units.toString();
  }
  const digits = units.toString().padStart(minorUnits + 1, "0");
  return sign + digits.slice(0, -minorUnits) + "." + digits.slice(-minorUnits);
}
