import {
  currencyMinorUnits,
  parseDecimal,
  roundMoneyHalfUp,
  type ProductDetail,
} from "@mizan/contracts";

type ProductPricing = Pick<
  ProductDetail,
  "weight" | "netGoldWeight" | "gemstones" | "fixedSellingPrice"
> & { hasGemstones?: boolean };

export function hasSeparateSellingPrice(product: ProductPricing | undefined) {
  return Boolean(
    product?.hasGemstones ||
    product?.gemstones?.length ||
    product?.fixedSellingPrice,
  );
}

export function isMetalOnlySuggestion(product: ProductPricing | undefined) {
  if (!product) return false;
  return Boolean(
    hasSeparateSellingPrice(product) ||
    (product.netGoldWeight &&
      roundMoneyHalfUp(product.netGoldWeight, 3) !==
        roundMoneyHalfUp(product.weight, 3)),
  );
}

export function initialProductSaleAmount(
  product: ProductPricing | undefined,
  currency: string,
  metalAmount: string | undefined,
) {
  if (product?.fixedSellingPrice?.currency === currency)
    return product.fixedSellingPrice.amount;
  return isMetalOnlySuggestion(product) ? undefined : metalAmount;
}

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
