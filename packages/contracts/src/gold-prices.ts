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

export const goldPriceKinds = ["BUY", "SELL"] as const;
export const goldPriceModes = ["FIXED", "PERCENTAGE", "OFFSET"] as const;
export type GoldPriceKind = (typeof goldPriceKinds)[number];
export type GoldPriceMode = (typeof goldPriceModes)[number];

export interface StoreGoldPrice {
  id: string;
  purity: number;
  kind: GoldPriceKind;
  mode: GoldPriceMode;
  value: string;
  pricePerGram: MoneyInput | null;
  effectiveAt: string;
}

export interface GoldPricingSettings extends GoldMarketPrices {
  rules: StoreGoldPrice[];
}

export type GoldPricingChange = {
  purity: number;
  kind: GoldPriceKind;
  mode: GoldPriceMode;
  value: string;
  expectedPriceId: string | null;
  quoteId?: string;
};

export interface GoldPricingPreview {
  pricePerGram: MoneyInput;
  quoteId?: string;
}

export interface GoldPriceHistory {
  items: (Omit<GoldMarketPrice, "retrievedAt"> & {
    firstRetrievedAt: string | null;
  })[];
  nextCursor?: string;
}

export interface GoldPriceRuleHistory {
  items: Omit<StoreGoldPrice, "pricePerGram">[];
  nextCursor?: string;
}
