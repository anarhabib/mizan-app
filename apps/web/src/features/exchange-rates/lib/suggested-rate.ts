import {
  officialRateCurrencies,
  type ExchangeRatesResponse,
} from "@mizan/contracts";

export function suggestedExchangeRate(
  data: ExchangeRatesResponse | undefined,
  currency: string,
) {
  const official = officialRateCurrencies.find((code) => code === currency);
  return official && data?.snapshot?.rates[official];
}
