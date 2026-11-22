import type { MoneyInput } from "./money.js";

export interface GoldMarketPrice {
  id: string;
  source: "GOLD_API";
  effectiveAt: string;
  retrievedAt: string;
  usdPerTroyOunce: string;
  usdAzn: string;
  exchangeDate: string;
  normalizedAznPerGram: string;
  pricePerGram: MoneyInput;
}

export interface GoldReference {
  purity: number;
  pricePerGram: MoneyInput | null;
}

export interface GoldMarketPrices {
  quote: GoldMarketPrice | null;
  stale: boolean;
  references: GoldReference[];
}

export const goldPriceKinds = [
  "RETAIL_SELL",
  "SCRAP_BUY",
  "SCRAP_SELL",
] as const;
export const goldPriceModes = ["FIXED", "PERCENTAGE", "OFFSET"] as const;
export type GoldPriceKind = (typeof goldPriceKinds)[number];
export type GoldPriceMode = (typeof goldPriceModes)[number];

export interface GoldRuleConfiguration {
  mode: GoldPriceMode;
  value: string;
}

export interface StoreGoldPriceRule {
  id: string;
  purity: number | null;
  kind: GoldPriceKind;
  configuration: GoldRuleConfiguration | null;
  effectiveAt: string;
  actorId: string;
}

export type GoldRateWarning = "SCRAP_SPREAD" | "MARKET_DEVIATION";

export interface GoldEffectiveRate {
  kind: GoldPriceKind;
  pricePerGram: MoneyInput | null;
  mode?: GoldPriceMode;
  source: "INDIVIDUAL" | "DEFAULT" | "MARKET" | null;
  status: "CURRENT" | "STALE" | "UNAVAILABLE";
  warnings: GoldRateWarning[];
}

export interface GoldPricingSettings extends GoldMarketPrices {
  rules: StoreGoldPriceRule[];
  rates: { purity: number; prices: GoldEffectiveRate[] }[];
}

export type GoldPricingDraft = {
  purity: number | null;
  kind: GoldPriceKind;
} & (GoldRuleConfiguration | { reset: true });

export type GoldPricingChange = GoldPricingDraft & {
  expectedPriceId: string | null;
  revision: string;
  quoteId?: string;
  confirmFixedDefault?: true;
};

export interface GoldPricingPreview {
  rates: (GoldEffectiveRate & { purity: number })[];
  expectedPriceId: string | null;
  revision: string;
  quoteId?: string;
}

export interface GoldPriceHistory {
  items: (Omit<GoldMarketPrice, "retrievedAt"> & {
    firstRetrievedAt: string | null;
  })[];
  nextCursor?: string;
}

export interface GoldPriceRuleHistory {
  items: (StoreGoldPriceRule & { previous: GoldRuleConfiguration | null })[];
  nextCursor?: string;
}
