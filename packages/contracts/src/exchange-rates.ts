export const officialRateCurrencies = ["USD", "EUR", "TRY"] as const;

export type OfficialRateCurrency = (typeof officialRateCurrencies)[number];

export type OfficialExchangeRates = {
  source: "CBAR";
  effectiveDate: string;
  retrievedAt: string;
  rates: Record<OfficialRateCurrency, string>;
};

export type ExchangeRatesResponse = {
  snapshot: OfficialExchangeRates | null;
  stale: boolean;
};
