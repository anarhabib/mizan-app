import {
  currencyMinorUnits,
  parseDecimal,
  roundMoneyHalfUp,
} from "@mizan/contracts";

export function validGramRate(value: string) {
  try {
    return (
      value.split(".")[0].length <= 16 && parseDecimal(value, 16) === value
    );
  } catch {
    return false;
  }
}

export function suggestedItemAmount(
  rate: string,
  weight: string,
  currency: string,
) {
  if (!validGramRate(rate)) return undefined;
  try {
    parseDecimal(weight, 3);
    const grams = BigInt(roundMoneyHalfUp(weight, 3).replace(".", ""));
    if (grams <= 0n) return undefined;
    const units = BigInt(roundMoneyHalfUp(rate, 16).replace(".", ""));
    const digits = (units * grams).toString().padStart(20, "0");
    const amount = roundMoneyHalfUp(
      digits.slice(0, -19) + "." + digits.slice(-19),
      currencyMinorUnits(currency),
    );
    return amount.split(".")[0].length <= 16 ? amount : undefined;
  } catch {
    return undefined;
  }
}
